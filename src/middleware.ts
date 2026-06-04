import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const { auth } = NextAuth(authConfig)

// ─── IP Rate Limiter (Redis-free, edge-compatible memory fallback) ─────────────
// Uses a sliding window counter per IP, stored in module-level Map.
// NOTE: In multi-instance prod, prefer Upstash Redis rate limiter.
const ipCounters = new Map<string, { count: number; reset: number }>()

function ipRateLimit(ip: string, limit: number, windowMs: number): boolean {
    const now = Date.now()
    const entry = ipCounters.get(ip)

    // Cleanup stale entry
    if (!entry || now > entry.reset) {
        ipCounters.set(ip, { count: 1, reset: now + windowMs })
        return true
    }

    if (entry.count >= limit) return false

    entry.count++
    return true
}

function getClientIp(req: NextRequest): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown"
    )
}

export default auth(async (req) => {
    const { nextUrl } = req;

    // ─── PERFORMANCE GAIN: Short-circuit for images and common assets ───
    if (nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf)$/) || nextUrl.pathname.startsWith("/images/") || nextUrl.pathname.startsWith("/icons/")) {
        return NextResponse.next();
    }

    const isAuthenticated = !!req.auth;

    const isPublicApi = 
        nextUrl.pathname.startsWith("/api/auth") || 
        nextUrl.pathname.startsWith("/api/health") ||
        nextUrl.pathname.startsWith("/api/god/notify") || 
        nextUrl.pathname.startsWith("/api/cron/guildaton-report") || 
        nextUrl.pathname.startsWith("/api/discord/interactions") || 
        nextUrl.pathname.startsWith("/api/storage") || 
        nextUrl.pathname.startsWith("/api/og"); 

    // ─── IP Rate Limiting on public unauthenticated API routes ────────────────
    if (isPublicApi && !nextUrl.pathname.startsWith("/api/auth")) {
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

    if (nextUrl.pathname.startsWith("/uploads/")) {
        const protectedPath = nextUrl.pathname.replace("/uploads/", "/api/storage/");
        return NextResponse.rewrite(new URL(protectedPath, req.url));
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
        try {
            const res = await fetch(`${nextUrl.origin}/api/health/maintenance`, {
                headers: { "x-middleware-check": "1" },
                signal: AbortSignal.timeout(2000),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.maintenanceMode === true) {
                    const url = nextUrl.clone();
                    url.pathname = "/maintenance";
                    return NextResponse.rewrite(url);
                }
            }
        } catch {
            // Fail open
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
    matcher: ["/((?!api/auth|api/health|api/god/notify|_next/static|_next/image|favicon.ico|images|fonts|icons|uploads|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf)$).*)"],
}
