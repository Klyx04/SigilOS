import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { DOFUSBOOK_BLOCKED_MESSAGE, isDofusbookBlockResponse } from "@/lib/dofusbook-utils";
import { isDofusbookBreakerOpen, openDofusbookBreaker } from "@/lib/dofusbook-guard";

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
type FetchBuildResult = { data: any; ok: boolean; status: number; blocked: boolean };

/** Lit (au plus 2 Ko) le corps d'une réponse en échec pour qualifier un blocage anti-bot. */
async function describeFailure(res: Response): Promise<{ blocked: boolean; detail: string }> {
    const contentType = res.headers.get("content-type");
    let body = "";
    try {
        body = (await res.text()).slice(0, 2048);
    } catch {
        /* corps illisible : on se base sur le statut */
    }
    return {
        blocked: isDofusbookBlockResponse(res.status, contentType, body),
        detail: `${res.status} ${contentType ?? ""} ${body.slice(0, 120).replace(/\s+/g, " ")}`,
    };
}

/**
 * Récupère les données brutes d'un build.
 *
 * Stratégie 1 — **CF Worker uniquement** (obligatoire) : c'est le seul émetteur autorisé
 * vers Dofusbook, car Dofusbook (Cloudflare) bloque les clients « serveur » (Node/undici,
 * .NET…) alors qu'un navigateur passe. Un appel direct depuis le VPS est donc inutile
 * **et** risque de faire flaguer son IP → désactivé par défaut.
 *
 * Stratégie 2 — appel direct VPS : uniquement si `DOFUSBOOK_ALLOW_VPS_FALLBACK=true`
 * (dépannage explicite) ; jamais après un blocage détecté.
 */
async function fetchBuildData(finalId: string, force: boolean = false): Promise<FetchBuildResult> {
    const cfWorkerUrl = process.env.DOFUSBOOK_CF_WORKER_URL;
    const cfWorkerSecret = process.env.DOFUSBOOK_WORKER_SECRET;
    const allowVpsFallback = process.env.DOFUSBOOK_ALLOW_VPS_FALLBACK === "true";

    // --- Strategy 1: CF Worker (seul émetteur vers Dofusbook) ---
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
                return { data, ok: true, status: 200, blocked: false };
            }

            const { blocked, detail } = await describeFailure(workerRes);
            logger.warn(`[Dofusbook] CF Worker ${workerRes.status} pour ${finalId}${blocked ? " (BLOCAGE anti-bot)" : ""}`, { detail });
            if (blocked && !allowVpsFallback) {
                // Inutile (et risqué pour l'IP du VPS) de retenter : on remonte le blocage.
                return { data: null, ok: false, status: workerRes.status, blocked: true };
            }
        } catch (err) {
            logger.warn(`[Dofusbook] CF Worker failed for ${finalId}`, { error: (err as Error).message });
        }
    }

    // --- Strategy 2: Direct VPS fetch — DÉSACTIVÉE par défaut (protection de l'IP) ---
    if (!allowVpsFallback) {
        return { data: null, ok: false, status: cfWorkerUrl ? 503 : 501, blocked: true };
    }

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
                return { data, ok: true, status: 200, blocked: false };
            }

            const { blocked, detail } = await describeFailure(response);
            if (blocked) {
                logger.warn(`[Dofusbook] VPS direct bloqué pour ${finalId}`, { detail });
                return { data: null, ok: false, status: response.status, blocked: true };
            }

            if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
            else return { data: null, ok: false, status: response.status, blocked: false };
        } catch {
            if (attempt === 2) return { data: null, ok: false, status: 500, blocked: false };
        }
    }

    return { data: null, ok: false, status: 500, blocked: false };
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

        // 3. Disjoncteur : si Dofusbook a bloqué récemment, on ne retente rien du tout
        // (protection de l'IP du VPS + du quota du worker).
        const breakerOpen = await isDofusbookBreakerOpen();

        // 4. Fetch (CF Worker — seul émetteur autorisé vers Dofusbook)
        const { data, ok, status, blocked } = breakerOpen
            ? { data: null as any, ok: false, status: 503, blocked: true }
            : await fetchBuildData(finalId, force);

        if (!ok || !data) {
            if (blocked) {
                // Ouvre/renouvelle le disjoncteur : plus aucun appel à Dofusbook pendant 15 min.
                await openDofusbookBreaker(`proxy build ${finalId} → statut ${status}`);

                await notifyGodOnce(
                    "🚫 Dofusbook bloque les appels serveur",
                    `Dofusbook (Cloudflare) refuse les requêtes serveur pour le stuff #${finalId} (statut ${status}) — challenge anti-bot probable. Les bakes sont gelés 15 min et le fallback direct VPS est désactivé (l'IP du VPS n'est plus exposée).`,
                    { buildId: finalId, status, source: "dofusbook-proxy" }
                );
            } else {
                // #41 — alerte God (throttle 10 min) : API injoignable pour une autre raison.
                await notifyGodOnce(
                    "🚨 Dofusbook API indisponible",
                    `Impossible de récupérer le stuff #${finalId} (statut ${status}).`,
                    { buildId: finalId, status, source: "dofusbook-proxy" }
                );
            }

            // Last resort: stale cache (7 j)
            try {
                const staleData = await redis.get(`${STALE_CACHE_KEY_PREFIX}${finalId}`);
                if (staleData) {
                    logger.warn(`[Dofusbook] Serving stale cache for ${finalId}`);
                    return NextResponse.json(JSON.parse(staleData as string), {
                        headers: { "X-Cache": "STALE", ...(blocked ? { "X-Dofusbook-Blocked": "1" } : {}) }
                    });
                }
            } catch { /* ignore */ }

            if (blocked) {
                // 503 (et non 403) : c'est un refus **temporaire** de la source, pas un accès interdit.
                return NextResponse.json(
                    { error: "dofusbook-blocked", message: DOFUSBOOK_BLOCKED_MESSAGE, status },
                    { status: 503 }
                );
            }

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
