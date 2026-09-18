/**
 * SigilOS — Dofusbook Proxy Worker
 * Deployed on Cloudflare Workers (edge network)
 *
 * Routes :
 *   GET  /:id                    → id numérique, protégé par `X-SigilOS-Key` (appel SERVEUR)
 *   GET  /s/:id?e=<exp>&t=<hmac> → route PUBLIQUE signée, appelée par le NAVIGATEUR
 *   OPTIONS (CORS preflight)
 *
 * Pourquoi une route « navigateur » ?
 *   Dofusbook (derrière Cloudflare) refuse désormais les requêtes dont le client
 *   d'origine est un serveur (Node/undici, .NET → 403/5xx « Attention Required! »)
 *   alors qu'un VRAI NAVIGATEUR passe. Le navigateur du membre appelle donc `/s/:id`
 *   avec un jeton HMAC courte durée généré côté SigilOS : le worker reste le SEUL
 *   émetteur vers Dofusbook (l'IP du VPS n'est jamais exposée) et garde le cache edge.
 *
 * Variables d'environnement (Cloudflare → Worker → Settings → Variables) :
 *   WORKER_SECRET       (obligatoire) secret de la route serveur `/:id`
 *   WORKER_SIGN_SECRET  (optionnel)   secret de signature de `/s/:id` (défaut : WORKER_SECRET)
 */

// Constant-time string comparison helper (avoids timing side-channel on secrets)
function timingSafeEqualStr(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/** HMAC-SHA256 hex (même recette que `src/lib/dofusbook-sign.ts` côté SigilOS). */
async function hmacHex(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Rate-limit best effort par isolate (le vrai plafond est aussi côté SigilOS/Redis).
const RATE_BUCKETS = new Map();
function rateLimitOk(ip, bucket, limit, windowMs) {
    const key = `${bucket}:${ip}`;
    const now = Date.now();
    const entry = RATE_BUCKETS.get(key);
    if (!entry || now > entry.reset) {
        if (RATE_BUCKETS.size > 5000) RATE_BUCKETS.clear();
        RATE_BUCKETS.set(key, { count: 1, reset: now + windowMs });
        return true;
    }
    if (entry.count >= limit) return false;
    entry.count += 1;
    return true;
}

const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
};

function jsonError(message, status) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}

/** Récupère le build chez Dofusbook et le renvoie tel quel (jamais de cache d'un échec). */
async function proxyBuild(buildId, ctx) {
    const dofusbookUrl = `https://www.dofusbook.net/api/stuffs/dofus/public/${buildId}`;
    // Clé de cache STABLE (indépendante du jeton du navigateur qui, lui, change à chaque
    // signature) → sinon on rappellerait Dofusbook à chaque rafraîchissement.
    const cacheKey = new Request(dofusbookUrl, { method: "GET" });

    let cached = null;
    try {
        cached = await caches.default.match(cacheKey);
    } catch {
        /* Cache indisponible : on continue sans */
    }
    if (cached) return buildResponse(cached.status, await cached.text(), cached.headers.get("Content-Type"), "HIT");

    const response = await fetch(dofusbookUrl, {
        headers: {
            ...BROWSER_HEADERS,
            "Referer": `https://www.dofusbook.net/fr/equipement/${buildId}`,
            "Origin": "https://www.dofusbook.net",
        },
    });

    const body = await response.text();

    // ⚠️ On ne met en cache QUE les succès : un 403/5xx est un challenge anti-bot, il ne
    // doit jamais être figé 24 h (sinon plus personne ne reçoit les données).
    if (response.status >= 200 && response.status < 300) {
        try {
            ctx?.waitUntil(
                caches.default.put(
                    cacheKey,
                    new Response(body, {
                        status: 200,
                        headers: {
                            "Content-Type": response.headers.get("Content-Type") || "application/json",
                            "Cache-Control": "public, max-age=86400",
                        },
                    })
                )
            );
        } catch {
            /* le cache est un bonus, jamais bloquant */
        }
    }

    return buildResponse(response.status, body, response.headers.get("Content-Type"), "MISS");
}

/** Construit la réponse renvoyée au client (navigateur ou SigilOS). */
function buildResponse(status, body, contentType, cacheState) {
    const ok = status >= 200 && status < 300;
    return new Response(body, {
        status,
        headers: {
            "Content-Type": contentType || "application/json",
            "Access-Control-Allow-Origin": "*",
            // Le vrai cache est celui du worker (ci-dessus, clé stable) : ici on ne parle
            // qu'au navigateur, et jamais de mise en cache d'un échec.
            "Cache-Control": ok ? "private, max-age=60" : "no-store",
            "X-Proxied-By": "SigilOS-CF-Worker",
            "X-Dofusbook-Status": String(status),
            "X-SigilOS-Cache": cacheState,
        },
    });
}

export default {
    async fetch(request, env, ctx) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET",
                    "Access-Control-Allow-Headers": "X-SigilOS-Key",
                }
            });
        }

        if (request.method !== "GET") {
            return new Response("Method not allowed", { status: 405 });
        }

        // 🔐 Secret de la route serveur — FAIL-CLOSED (F-19) : si WORKER_SECRET n'est pas
        // défini, on refuse tout au lieu d'ouvrir le worker à l'Internet.
        const workerSecret = env.WORKER_SECRET;
        if (!workerSecret) {
            return jsonError("Server misconfigured", 500);
        }

        const url = new URL(request.url);
        const pathParts = url.pathname.split("/").filter(Boolean);
        const isPublicSignedRoute = pathParts[0] === "s";
        const buildId = pathParts[pathParts.length - 1];

        if (!buildId || !/^\d+$/.test(buildId)) {
            // `/s/:id` n'accepte QUE l'id numérique : SigilOS résout les liens courts
            // (d-bk.net) avant de signer l'URL.
            return jsonError("Invalid build ID", 400);
        }

        if (isPublicSignedRoute) {
            // --- Route NAVIGATEUR : jeton HMAC courte durée (id + expiration) ---
            const signSecret = env.WORKER_SIGN_SECRET || workerSecret;
            const exp = Number(url.searchParams.get("e") || 0);
            const token = (url.searchParams.get("t") || "").toLowerCase();
            const nowSec = Math.floor(Date.now() / 1000);

            if (!Number.isFinite(exp) || exp <= nowSec) {
                return jsonError("Token expired", 403);
            }
            const expected = await hmacHex(signSecret, `${buildId}.${exp}`);
            if (!timingSafeEqualStr(token, expected)) {
                return jsonError("Invalid signature", 403);
            }

            const ip = request.headers.get("CF-Connecting-IP") || "unknown";
            if (!rateLimitOk(ip, "public", 60, 60_000)) {
                return jsonError("Too many requests", 429);
            }
        } else {
            // --- Route SERVEUR : `X-SigilOS-Key` (usage interne SigilOS) ---
            const providedSecret = request.headers.get("X-SigilOS-Key") || "";
            // Constant-time comparison to avoid timing side-channel
            if (providedSecret.length !== workerSecret.length ||
                !timingSafeEqualStr(providedSecret, workerSecret)) {
                return jsonError("Unauthorized", 401);
            }
        }

        // NOTE: Do NOT forward X-SigilOS-Key to Dofusbook — only used between us and the Worker
        try {
            return await proxyBuild(buildId, ctx);
        } catch (err) {
            // F-27: neutral error — no internal details leaked
            return jsonError("Worker fetch failed", 500);
        }
    }
};
