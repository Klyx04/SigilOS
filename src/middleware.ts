import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const { auth } = NextAuth(authConfig)

// ─── IP Rate Limiter (Redis-free, edge-compatible memory fallback) ─────────────
// Uses a sliding window counter per IP, stored in module-level Map.
// NOTE: In multi-instance prod, prefer Upstash Redis rate limiter.
// SECURITY FIX: cap the map size to prevent memory-exhaustion DoS via spoofed IPs.
const MAX_IP_COUNTER_ENTRIES = 10_000
const ipCounters = new Map<string, { count: number; reset: number }>()

// ─── Maintenance Mode Cache (30s TTL, avoids a DB fetch on every request) ───
let _maintenanceCache: { value: boolean; expiresAt: number } | null = null
const MAINTENANCE_CACHE_TTL_MS = 30_000

function ipRateLimit(ip: string, limit: number, windowMs: number): boolean {
    const now = Date.now()
    const entry = ipCounters.get(ip)

    // Cleanup stale entry
    if (!entry || now > entry.reset) {
        // SECURITY FIX: prevent unbounded memory growth from spoofed/random IPs
        // by evicting expired entries before allocating new keys.
        if (ipCounters.size >= MAX_IP_COUNTER_ENTRIES) {
            for (const [key, val] of ipCounters) {
                if (val.reset < now) ipCounters.delete(key)
            }
        }
        // If still saturated and this is a brand-new key, do not allocate more
        // memory — treat as allowed this once; the sweep above frees space next tick.
        if (ipCounters.size >= MAX_IP_COUNTER_ENTRIES) return true

        ipCounters.set(ip, { count: 1, reset: now + windowMs })
        return true
    }

    if (entry.count >= limit) return false

    entry.count++
    return true
}

function getClientIp(req: NextRequest): string {
    const raw = (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown"
    )
    // SECURITY FIX: only trust well-formed IPv4 values (Caddy sets the real client
    // IP first). Rejects malformed/spoofed values, preventing both rate-limit
    // bypass and unbounded map growth with garbage keys.
    if (raw !== "unknown" && !/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) {
        return "untrusted"
    }
    return raw
}

export default auth(async (req) => {
    const { nextUrl } = req;

    // ─── REWRITE UPLOADS: Must happen before any performance short-circuit ───
    if (nextUrl.pathname.startsWith("/uploads/")) {
        const protectedPath = nextUrl.pathname.replace("/uploads/", "/api/storage/");
        return NextResponse.rewrite(new URL(protectedPath, req.url));
    }

    // ─── PERFORMANCE GAIN: Short-circuit for images and common assets ───
    if (nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf)$/) || nextUrl.pathname.startsWith("/images/") || nextUrl.pathname.startsWith("/icons/")) {
        return NextResponse.next();
    }

    const isAuthenticated = !!req.auth;

    const isPublicApi = 
        nextUrl.pathname.startsWith("/api/auth") || 
        nextUrl.pathname.startsWith("/api/health") ||
        nextUrl.pathname.startsWith("/api/god/notify") || 
        nextUrl.pathname.startsWith("/api/cron/") ||       // ✅ Protected by verifyCronSecret (x-cron-secret header)
        nextUrl.pathname.startsWith("/api/discord/interactions") || 
        nextUrl.pathname.startsWith("/api/storage") || 
        nextUrl.pathname.startsWith("/api/og"); 

    // ─── IP Rate Limiting on public unauthenticated API routes ────────────────
    if (isPublicApi && !nextUrl.pathname.startsWith("/api/auth") && !nextUrl.pathname.startsWith("/api/storage")) {
        const ip = getClientIp(req)
        // Discord interactions: 30 req/min (bots can legitimately hit this fast)
        // All other public routes: 60 req/min
        const limit = nextUrl.pathname.startsWith("/api/discord/interactions") ? 30 : 60
        const allowed = ipRateLimit(`${ip}:${nextUrl.pathname.split("/")[2]}`, limit, 60_000)

        if (!allowed) {
            return NextResponse.json(
                { error: "Too Many Requests" },
                {
                    status: 429,
                    headers: {
                        "Retry-After": "60",
                        "X-RateLimit-Limit": String(limit),
                        "X-RateLimit-Reset": String(Math.floor((Date.now() + 60_000) / 1000)),
                    },
                }
            )
        }
    }

    if (nextUrl.pathname.startsWith("/api")) {
        if (!isPublicApi && !isAuthenticated) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    // --- MAINTENANCE MODE CHECK ---
    const isMaintenanceBypassPath = nextUrl.pathname.startsWith("/maintenance") || nextUrl.pathname.startsWith("/god") || nextUrl.pathname.startsWith("/api");
    const isGodUser = req.cookies.get("sigil-god-bypass")?.value;

    if (!isMaintenanceBypassPath && !isGodUser) {
        // 1. Fast path: read env var set by the admin panel action (no network, no Turbopack cold-start 404)
        const envMaintenance = process.env.MAINTENANCE_MODE;
        let isInMaintenance = envMaintenance === "true";

        // 2. Slow path (prod only): if env var not explicitly set, fallback to cached DB check
        if (envMaintenance === undefined && process.env.NODE_ENV === "production") {
            const now = Date.now()
            if (_maintenanceCache && now < _maintenanceCache.expiresAt) {
                // Cache hit: reuse last known value
                isInMaintenance = _maintenanceCache.value
            } else {
                // Cache miss: fetch from API and store result for 30s
                try {
                    const res = await fetch(`${nextUrl.origin}/api/health/maintenance`, {
                        headers: { "x-middleware-check": "1" },
                        signal: AbortSignal.timeout(2000),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        isInMaintenance = data.maintenanceMode === true;
                        _maintenanceCache = { value: isInMaintenance, expiresAt: now + MAINTENANCE_CACHE_TTL_MS }
                    }
                } catch {
                    // Fail open — keep last cached value if any
                    if (_maintenanceCache) isInMaintenance = _maintenanceCache.value
                }
            }
        }

        if (isInMaintenance) {
            const url = nextUrl.clone();
            url.pathname = "/maintenance";
            return NextResponse.rewrite(url);
        }
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", nextUrl.pathname);

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
})

export const config = {
    matcher: ["/((?!api/auth|api/health|api/god/notify|_next/static|_next/image|favicon.ico|images|fonts|icons|(?!uploads/).*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf)$).*)"],
}
