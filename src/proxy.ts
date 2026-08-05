import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getGodRoutePrefix, isValidGodSecret } from "./lib/god-route"
import { logger } from "@/lib/logger"

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

// ─── God route prefix (R3 anti-scout, computed at build — env inlined) ─────
const GOD_PREFIX = getGodRoutePrefix()

// ─── God anti-scout route helpers (R3) ──────────────────────────────────────
// Le panel vit sur une route secrète (GOD_ROUTE). Le proxy réécrit le
// trafic secret → /god interne. /god direct → laissé passer (le layout serveur
// fait la vérif fine des scopes + 404). Fail-closed : si GOD_ROUTE absent en
// prod, GOD_PREFIX == "/__god-route-missing__" ne matche rien → 404.
function isGodPanelPath(pathname: string): boolean {
    return pathname === "/god" || pathname.startsWith("/god/")
}
function isGodApiPath(pathname: string): boolean {
    return pathname === "/api/god" || pathname.startsWith("/api/god/")
}
function isGodSecretPath(pathname: string): boolean {
    if (GOD_PREFIX === "/god") return false // dev fallback, géré par isGodPanelPath
    return pathname.startsWith(GOD_PREFIX)
}
function isGodRoute(pathname: string): boolean {
    return isGodPanelPath(pathname) || isGodApiPath(pathname) || isGodSecretPath(pathname)
}

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
    // SECURITY (F-04): Only trust x-real-ip, which Caddy now sets/overwrites for
    // every proxied request. We do NOT trust x-forwarded-for because a client can
    // inject its own first value (spoofing the limiter per-IP).
    // Fallback to "untrusted" (rate-limited much lower) when the header is absent.
    const realIp = req.headers.get("x-real-ip") || "unknown"
    if (realIp !== "unknown" && !/^\d{1,3}(\.\d{1,3}){3}$/.test(realIp)) {
        return "untrusted"
    }
    return realIp
}

export default auth(async (req) => {
    const { nextUrl } = req;

    // Session JWT fiable dans le Proxy : `getToken` décode le cookie Auth.js
    // avec le même AUTH_SECRET que le serveur. `req.auth` (du wrapper NextAuth
    // à providers vides) ne décode PAS le cookie ici → ne pas s'y fier pour la
    // garde God.
    // NOTE: `segurança` — ne jamás logger le token ni le secret.
    // `getToken` infère le nom du cookie via AUTH_URL/NEXTAUTH_URL ; s'il est
    // absent ou non reconnu derrière Caddy, il pourrait chercher le mauvais
    // cookie (authjs.session-token au lieu de __Secure-...). On force donc
    // explicitement le même nom/secure que défini dans auth.config.ts, pour
    // garantir que le proxy lit le même cookie que le serveur.
    const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET,
        secureCookie: process.env.NODE_ENV === "production",
        cookieName: "__Secure-authjs.session-token",
    });
    const hasSession = !!token?.sub;

    // ─── REWRITE UPLOADS: Must happen before any performance short-circuit ───
    if (nextUrl.pathname.startsWith("/uploads/")) {
        const protectedPath = nextUrl.pathname.replace("/uploads/", "/api/storage/");
        return NextResponse.rewrite(new URL(protectedPath, req.url));
    }

    // ─── PERFORMANCE GAIN: Short-circuit for images and common assets ───
    if (nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf)$/) || nextUrl.pathname.startsWith("/images/") || nextUrl.pathname.startsWith("/icons/")) {
        return NextResponse.next();
    }

    // ─── R3 ANTI-SCOUT: route secrète → vérifier le secret DANS le proxy ────
    // Ex: /mng-aZ9rT3/delegates → /god/delegates ; /mng-aZ9rT3 → /god
    // Le proxy tourne en Node runtime (voir config) → lit process.env.GOD_ROUTE
    // AU RUNTIME (pas inliné au build). On compare le secret reçu directement à
    // GOD_ROUTE AVANT le rewrite. Fail-closed : mauvais secret → 404 immédiat,
    // rien n'atteint les RSC God. Aucun header n'est transmis (le layout ne
    // vérifie plus le secret — c'est le proxy qui est la porte).
    if (isGodSecretPath(nextUrl.pathname)) {
        // (DEBUG LOG décision) pathname + présence session, sans loguer le secret.
        logger.info(`[GodProxy] /mng-* path`, {
            pathname: nextUrl.pathname,
            hasAuth: hasSession,
            hasCookie: !!req.cookies.get("__Secure-authjs.session-token")?.value || !!req.cookies.get("authjs.session-token")?.value,
        });
        // Chemin interne = /god + ce qui suit le secret.
        const secondSlash = nextUrl.pathname.indexOf("/", GOD_PREFIX.length);
        const rest = secondSlash === -1 ? "" : nextUrl.pathname.slice(secondSlash);
        const secretPart = nextUrl.pathname.slice(GOD_PREFIX.length).split("/")[0] || "";
        if (!isValidGodSecret(secretPart)) {
            logger.warn(`[GodProxy] secret refusé → 404`, { pathname: nextUrl.pathname, hasAuth: hasSession });
            return new NextResponse(null, { status: 404 });
        }
        logger.info(`[GodProxy] secret accepté → rewrite /god`, { pathname: nextUrl.pathname });
        const url = nextUrl.clone();
        url.pathname = "/god" + rest;
        return NextResponse.rewrite(url);
    }

    // ─── R3 ANTI-SCOUT: /god direct en production → 404 si pas authentifié ──
    // La vérification fine des scopes (getActiveScopes) se fait dans le layout
    // serveur. Ici, fail-closed minimal : pas de session → 404.
    if ((nextUrl.pathname === "/god" || nextUrl.pathname === "/god/") && process.env.NODE_ENV === "production" && !hasSession) {
        logger.warn(`[GodProxy] /god direct sans session → 404`, { pathname: nextUrl.pathname, hasAuth: hasSession });
        return new NextResponse(null, { status: 404 });
    }
    if (nextUrl.pathname === "/god" || nextUrl.pathname === "/god/") {
        logger.info(`[GodProxy] /god direct avec session → pass-through au layout`, { pathname: nextUrl.pathname, hasAuth: hasSession });
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

    // ─── R3 ANTI-SCOUT: rate-limit strict + IP allowlist optionnelle sur god ──
    // Uniquement sur les routes god (pages + API hors notify). /api/god/notify
    // est public et protégé par CRON_SECRET → exclu ici.
    if (isGodRoute(nextUrl.pathname)) {
        const ip = getClientIp(req)

        // 🔒 IP allowlist OPTIONNELLE (désactivable) : si GOD_IP_ALLOWLIST est
        // défini et non vide → SEULES ces IPs accèdent au panel. Fail-closed.
        const allowlist = process.env.GOD_IP_ALLOWLIST;
        if (allowlist && allowlist.trim().length > 0) {
            const allowedIps = allowlist.split(",").map(s => s.trim()).filter(Boolean);
            if (allowedIps.length > 0 && !allowedIps.includes(ip)) {
                return new NextResponse(null, { status: 403 });
            }
        }

        // Rate-limit strict sur les routes god (10 req/min).
        if (!nextUrl.pathname.startsWith("/api/god/notify")) {
            const allowed = ipRateLimit(`${ip}:god`, 10, 60_000);
            if (!allowed) {
                return new NextResponse(null, { status: 429, headers: { "Retry-After": "60" } });
            }
        }
    }

    // --- MAINTENANCE MODE CHECK ---
    const isMaintenanceBypassPath = nextUrl.pathname.startsWith("/maintenance") || isGodRoute(nextUrl.pathname) || nextUrl.pathname.startsWith("/api");
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

    // ─── R3 ANTI-SCOUT: X-Robots-Tag noindex/nofollow sur les routes god ─────
    // Couvre pages (/god*, /mng-*) + API (/api/god/*) d'un coup.
    if (isGodRoute(nextUrl.pathname)) {
        requestHeaders.set("X-Robots-Tag", "noindex, nofollow");
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
})

export const config = {
    // Le proxy Next 16 (anciennement middleware) tourne TOUJOURS sur Node.js
    // (imposé par Next) — contrairement à l'ancienne convention middleware.ts
    // qui était imposée en Edge (env inlinés au build → secret GOD_ROUTE du
    // .env VPS invisible au runtime). Ici, process.env.GOD_ROUTE est lu AU
    // RUNTIME. (La prop `runtime` est interdite dans un fichier proxy.)
    matcher: ["/((?!api/auth|api/health|api/god/notify|_next/static|_next/image|favicon.ico|images|fonts|icons|(?!uploads/).*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf)$).*)"],
}
