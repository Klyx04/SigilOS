import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

const BUILD_CACHE_TTL = 86400; // 24h
const STALE_CACHE_KEY_PREFIX = "dofusbook:stale:";
// #40/#41 — alerte God throttle (1 max / 10 min) quand l'API Dofusbook casse ou
// que le schéma change (le FM ne remonte plus) → détection précoce.
const ALERT_KEY = "dofusbook:god-alert-throttle";
const ALERT_TTL = 600;

/**
 * Alerte God (notifyGod) throttlée en Redis — déclenchée en cas de panne
 * Dofusbook répétée ou de réponse au schéma inattendu (API cassée → FM KO).
 * Fail-closed : si Redis est KO, on ne notifie pas (pas bloquant pour la requête).
 */
async function notifyGodOnce(title: string, message: string, metadata: Record<string, unknown>) {
    try {
        const ok = await redis.set(ALERT_KEY, "1", "EX", ALERT_TTL, "NX");
        if (!ok) return; // déjà notifié récemment
        const { notifyGod } = await import("@/server/actions/god-notif-actions");
        await notifyGod({ title, message, type: "SECURITY_ALERT", success: false, metadata });
    } catch {
        /* non bloquant */
    }
}

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Fetch build data via CF Worker (preferred) or VPS direct (fallback).
 *
 * CF Worker runs on Cloudflare edge network — different IPs from our VPS,
 * may bypass Cloudflare WAF rules protecting Dofusbook's API.
 *
 * Set DOFUSBOOK_CF_WORKER_URL in .env to enable.
 */
async function fetchBuildData(finalId: string, force: boolean = false): Promise<{ data: any; ok: boolean; status: number }> {
    const cfWorkerUrl = process.env.DOFUSBOOK_CF_WORKER_URL;
    const cfWorkerSecret = process.env.DOFUSBOOK_WORKER_SECRET;

    // --- Strategy 1: CF Worker ---
    if (cfWorkerUrl) {
        try {
            const urlWithForce = force ? `${cfWorkerUrl}/${finalId}?force=true` : `${cfWorkerUrl}/${finalId}`;
            const workerRes = await fetch(urlWithForce, {
                headers: {
                    "Accept": "application/json",
                    ...(cfWorkerSecret ? { "X-SigilOS-Key": cfWorkerSecret } : {}),
                },
                cache: force ? "no-store" : "default",
                signal: AbortSignal.timeout(12000),
            });

            if (workerRes.ok) {
                const data = await workerRes.json();
                return { data, ok: true, status: 200 };
            }

            logger.warn(`[Dofusbook] CF Worker ${workerRes.status} for ${finalId} — fallback VPS`);
        } catch (err) {
            logger.warn(`[Dofusbook] CF Worker failed for ${finalId}`, { error: (err as Error).message });
        }
    }

    // --- Strategy 2: Direct VPS fetch (may be blocked by Cloudflare) ---
    const apiUrl = `https://www.dofusbook.net/api/stuffs/dofus/public/${finalId}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                headers: {
                    "User-Agent": getRandomUA(),
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "fr-FR,fr;q=0.9",
                    "Referer": `https://www.dofusbook.net/fr/equipement/${finalId}`,
                    "DNT": "1",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                },
                signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
                const data = await response.json();
                return { data, ok: true, status: 200 };
            }

            if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
            else return { data: null, ok: false, status: response.status };
        } catch {
            if (attempt === 2) return { data: null, ok: false, status: 500 };
        }
    }

    return { data: null, ok: false, status: 500 };
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const cacheKey = `dofusbook:build:${id}`;

    const force = request.headers.get("cache-control") === "no-cache" || 
                  request.headers.get("pragma") === "no-cache";

    try {
        // 1. Redis cache — serve first, always
        // If force is TRUE, we check a "rate-limit" key instead of serving cache immediately.
        if (force) {
            const limitKey = `dofusbook:limit:force:${id}`;
            const isLimited = await redis.get(limitKey);
            
            if (isLimited) {
                // Throttled! Serve cache if it exists, otherwise just fall through to normal logic (non-force)
                const cachedData = await redis.get(cacheKey);
                if (cachedData) {
                    return NextResponse.json(JSON.parse(cachedData as string), {
                        headers: { "X-Cache": "HIT", "X-Throttled": "true" }
                    });
                }
                // If no cache at all, we proceed without force to avoid double-hitting the worker
            } else {
                // Not limited, but let's set a 60s cooldown for the next force request
                await redis.setex(limitKey, 60, "1");
            }
        }

        if (!force) {
            try {
                const cachedData = await redis.get(cacheKey);
                if (cachedData) {
                    return NextResponse.json(JSON.parse(cachedData as string), {
                        headers: { "X-Cache": "HIT" }
                    });
                }
            } catch (redisError) {
                logger.warn("[Dofusbook] Redis error:", { error: (redisError as Error).message });
            }
        }

        // 2. Resolve short URL (d-bk.net) if needed
        let finalId = id;
        if (!/^\d+$/.test(id)) {
            try {
                const headRes = await fetch(`https://d-bk.net/fr/d/${id}`, {
                    method: "HEAD",
                    redirect: "manual",
                    headers: { "User-Agent": getRandomUA() }
                });
                const location = headRes.headers.get("location");
                if (location) {
                    const idMatch = location.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
                    if (idMatch) finalId = idMatch[1];
                }
            } catch {
                // Continue with original ID
            }
        }

        // 3. Fetch (CF Worker → VPS fallback)
        const { data, ok, status } = await fetchBuildData(finalId, force);

        if (!ok || !data) {
            // #41 — alerte God (throttle 10 min) : l'API Dofusbook est injoignable
            // (CF Worker + VPS échoués) → les builds FM ne remontent plus.
            await notifyGodOnce(
                "🚨 Dofusbook API indisponible",
                `Impossible de récupérer le stuff #${finalId} (CF Worker + VPS). Le FM ne remonte plus sur la galerie.`,
                { buildId: finalId, status, source: "dofusbook-proxy" }
            );

            // Last resort: stale cache
            try {
                const staleData = await redis.get(`${STALE_CACHE_KEY_PREFIX}${finalId}`);
                if (staleData) {
                    logger.warn(`[Dofusbook] Serving stale cache for ${finalId}`);
                    return NextResponse.json(JSON.parse(staleData as string), {
                        headers: { "X-Cache": "STALE" }
                    });
                }
            } catch { /* ignore */ }

            return NextResponse.json(
                { error: `Dofusbook unavailable (${status})` },
                { status }
            );
        }

        // #41 — contrôle de schéma : si l'API Dofusbook change sa structure
        // (ex. plus de champ `stuff`), les builds remontent « vides » sans erreur.
        // On détecte le changement ET on alerte le God (throttle 10 min).
        if (typeof data !== "object" || data === null || typeof (data as any).stuff !== "object" || (data as any).stuff === null) {
            await notifyGodOnce(
                "⚠️ Schéma Dofusbook changé (FM KO)",
                `La réponse Dofusbook pour le build #${finalId} n'a plus de champ « stuff » — l'API a probablement changé. Les builds FM ne remontent plus correctement sur la galerie.`,
                { buildId: finalId, sampleKeys: data && typeof data === "object" ? Object.keys(data).slice(0, 10) : null, source: "dofusbook-proxy" }
            );
        }

        // 4. Cache in Redis
        try {
            await Promise.all([
                redis.setex(cacheKey, BUILD_CACHE_TTL, JSON.stringify(data)),
                redis.setex(`${STALE_CACHE_KEY_PREFIX}${finalId}`, BUILD_CACHE_TTL * 7, JSON.stringify(data)),
            ]);
        } catch (redisErr) {
            logger.error("[Dofusbook] Redis write failed:", { error: (redisErr as Error).message });
        }

        return NextResponse.json(data, { headers: { "X-Cache": "MISS" } });

    } catch (globalError: any) {
        logger.error("[Dofusbook] Global Error:", { error: globalError?.message });
        return NextResponse.json({ error: "Proxy internal error" }, { status: 500 });
    }
}
