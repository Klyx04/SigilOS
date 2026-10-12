"use server";
import { logger } from "@/lib/logger";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/ratelimit";
import { buildDofusbookClientFetchUrl } from "@/lib/dofusbook-sign";

import redis from "@/lib/redis";
import { processDofusbookRawData, extractDofusbookBuildId, isDofusbookBlockResponse, DOFUSBOOK_BLOCKED_MESSAGE, type DofusbookPreviewData } from "@/lib/dofusbook-utils";
import { isDofusbookBreakerOpen, openDofusbookBreaker } from "@/lib/dofusbook-guard";
import { assertSafeUrl } from "@/lib/image-downloader";

const DOFUSBOOK_API = "https://www.dofusbook.net/api/stuffs/dofus/public/";
const CACHE_TTL = 3600 * 24; // 24 hours

// =============================================================================
// #41bis — Surveillance API Dofusbook : si l'API change de schéma ou bloque les
// imports (403/429/5xx répétés), le God est notifié une fois par fenêtre.
// Circuit breaker module-level (reset si une récupération aboutit).
// =============================================================================
const DOFUSBOOK_ALERT_WINDOW_MS = 60 * 60 * 1000; // 1 notif max / heure
const DOFUSBOOK_FAILURE_THRESHOLD = 5; // 5 échecs consécutifs avant alerte

let dofusbookFailureCount = 0;
let dofusbookLastAlertAt = 0;

async function trackDofusbookFailure(kind: string, detail: string): Promise<void> {
    dofusbookFailureCount += 1;
    logger.warn(`[Dofusbook #41bis] Failure #${dofusbookFailureCount} (${kind}): ${detail}`);

    const now = Date.now();
    if (dofusbookFailureCount >= DOFUSBOOK_FAILURE_THRESHOLD && now - dofusbookLastAlertAt > DOFUSBOOK_ALERT_WINDOW_MS) {
        dofusbookLastAlertAt = now;
        dofusbookFailureCount = 0;
        try {
            const { notifyGod } = await import("@/server/actions/god-notif-actions");
            await notifyGod({
                title: "⚠️ API Dofusbook en difficulté",
                message: `L'API Dofusbook semble avoir changé ou bloquer les imports (${DOFUSBOOK_FAILURE_THRESHOLD}+ échecs : ${kind} — ${detail}). Les nouveaux stuffs importés peuvent être cassés. Vérifier le schéma de réponse ou le WAF Cloudflare.`,
                type: "SYSTEM",
                success: false,
                ping: true,
                metadata: { kind, detail, count: dofusbookFailureCount },
            } as any);
        } catch (err) {
            logger.error("[Dofusbook #41bis] Échec envoi notif God:", err);
        }
    }
}

function resetDofusbookFailures(): void {
    if (dofusbookFailureCount > 0) dofusbookFailureCount = 0;
}

/**
 * Extracts the numerical ID from a Dofusbook URL.
 * Supports both full and short URLs (by following redirects).
 */
export async function getDofusbookId(url: string): Promise<string | null> {
    try {
        // 1. URL complète : extraction **partagée** avec le formulaire client
        //    (`extractDofusbookBuildId`), donc tolérante aux variantes d'interface
        //    (`/desktop/fr/equipement/<id>-slug/objets`, `/perso/`, `/private/`…).
        const buildId = extractDofusbookBuildId(url);
        if (buildId) return buildId;

        // 2. Short URL resolution (d-bk.net)
        if (url.includes("d-bk.net")) {
            // 🔐 SSRF guard (F-03) : n'autoriser que d-bk.net / dofusbook.net en
            // http(s) + bloquer IP internes et DNS rebinding via assertSafeUrl.
            try {
                const parsed = new URL(url);
                const host = parsed.hostname.toLowerCase();
                const allowedHost = host === "d-bk.net" || host.endsWith(".d-bk.net") ||
                    host === "dofusbook.net" || host === "www.dofusbook.net" || host.endsWith(".dofusbook.net");
                if (!allowedHost) throw new Error("Hôte Dofusbook non autorisé");
                await assertSafeUrl(url);
            } catch {
                return null;
            }
            const response = await fetch(url, {
                method: "GET",
                redirect: "follow",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                }
            });
            const finalUrl = response.url;
            const finalMatch = finalUrl.match(/equipement\/(\d+)/);
            return finalMatch ? finalMatch[1] : null;
        }

        return null;
    } catch (e) {
        logger.error("[Dofusbook] ID extraction failed:", e);
        return null;
    }
}

/**
 * Renvoie l'URL **signée** (worker Cloudflare `/s/{id}`) que le NAVIGATEUR du membre doit
 * appeler pour récupérer les données d'un build.
 *
 * Pourquoi passer par le navigateur ? Dofusbook (Cloudflare) refuse les requêtes dont le
 * client d'origine est un serveur (Node/.NET → 403/5xx « Attention Required! ») alors
 * qu'un vrai navigateur passe. Le serveur ne fait donc que **signer** (jeton HMAC 5 min) :
 * la requête part de l'edge Cloudflare via le navigateur du membre, le worker reste le
 * seul émetteur vers Dofusbook et **l'IP du VPS n'est jamais exposée**.
 */
export async function getDofusbookClientFetchUrl(buildUrl: string): Promise<{
    success: boolean;
    url?: string;
    id?: string;
    error?: string;
}> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Non authentifié" };

    const limited = await rateLimit(`dofusbook-client-url:${userId}`, 60, 60_000);
    if (!limited.success) return { success: false, error: "Trop de requêtes — réessaie dans une minute." };

    const id = await getDofusbookId(buildUrl);
    if (!id) return { success: false, error: "Identifiant Dofusbook introuvable" };

    const url = buildDofusbookClientFetchUrl(id);
    if (!url) return { success: false, error: "Proxy Dofusbook non configuré (DOFUSBOOK_CF_WORKER_URL)." };

    return { success: true, url, id };
}

/**
 * Fetches and processes Dofusbook build data.
 * Strategy 1: CF Worker (Cloudflare edge IPs — bypasses VPS ban)
 * Strategy 2: VPS direct fetch (fallback — may be blocked by Cloudflare WAF)
 *
 * Caches processed DofusbookPreviewData in Redis.
 * Cache is invalidated if stored data has no items (was cached during a block).
 */
export async function getDofusbookPreview(url: string, force: boolean = false): Promise<{
    success: boolean;
    data?: DofusbookPreviewData;
    error?: string;
    id?: string;
}> {
    const id = await getDofusbookId(url);
    if (!id) return { success: false, error: "Identifiant Dofusbook introuvable" };

    const cacheKey = `sigilos:dofusbook:v12:${id}`;

    try {
        // 1. Redis cache — skip if items were empty (cached during a CF block)
        if (!force && redis && redis.status === "ready") {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached as string) as DofusbookPreviewData;
                const hasItems = parsed?.items && Object.values(parsed.items).some(Boolean);
                if (hasItems) return { success: true, data: parsed, id };
                // else: fall through to re-fetch (was cached empty)
            }
        }

        let raw: any = null;
        const allowVpsFallback = process.env.DOFUSBOOK_ALLOW_VPS_FALLBACK === "true";

        // Disjoncteur partagé avec la route proxy : si Dofusbook a bloqué récemment,
        // on ne rappelle rien (l'IP du VPS ne touche plus jamais dofusbook.net).
        if (await isDofusbookBreakerOpen()) {
            return { success: false, error: DOFUSBOOK_BLOCKED_MESSAGE, id };
        }

        // 2. Strategy 1 — CF Worker (seul émetteur autorisé vers Dofusbook)
        const cfWorkerUrl = process.env.DOFUSBOOK_CF_WORKER_URL;
        const cfWorkerSecret = process.env.DOFUSBOOK_WORKER_SECRET;

        if (cfWorkerUrl) {
            try {
                const urlWithForce = force ? `${cfWorkerUrl}/${id}?force=true` : `${cfWorkerUrl}/${id}`;
                const workerRes = await fetch(urlWithForce, {
                    headers: {
                        "Accept": "application/json",
                        ...(cfWorkerSecret ? { "X-SigilOS-Key": cfWorkerSecret } : {}),
                    },
                    cache: force ? "no-store" : "default",
                    signal: AbortSignal.timeout(12000),
                });
                if (workerRes.ok) {
                    raw = await workerRes.json();
                } else {
                    const contentType = workerRes.headers.get("content-type");
                    const body = await workerRes.text().catch(() => "");
                    if (isDofusbookBlockResponse(workerRes.status, contentType, body)) {
                        // Challenge anti-bot Cloudflare : on gèle les bakes 15 min.
                        await openDofusbookBreaker(`bake build ${id} → statut ${workerRes.status}`);
                        await trackDofusbookFailure("blocked", `${workerRes.status} sur build ${id} (challenge Cloudflare)`);
                        return { success: false, error: DOFUSBOOK_BLOCKED_MESSAGE, id };
                    }
                    if (workerRes.status === 404) return { success: false, error: "Stuff introuvable", id };
                    logger.warn(`[Dofusbook Action] CF Worker ${workerRes.status} for ${id}`, { detail: body.slice(0, 120) });
                }
            } catch (err) {
                logger.warn(`[Dofusbook Action] CF Worker failed for ${id}:`, err);
            }
        }

        // 3. Strategy 2 — VPS direct : DÉSACTIVÉE par défaut (Dofusbook bloque les IP
        // serveur et on ne veut pas faire flaguer celle du VPS). Dépannage explicite :
        // DOFUSBOOK_ALLOW_VPS_FALLBACK=true.
        if (!raw && !allowVpsFallback) {
            return { success: false, error: DOFUSBOOK_BLOCKED_MESSAGE, id };
        }

        if (!raw) {
            const response = await fetch(`${DOFUSBOOK_API}${id}`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "fr-FR,fr;q=0.9",
                    "Referer": "https://www.dofusbook.net/fr/equipement/",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                },
                cache: "no-store", // Strategy 2 is always no-store as it's the fallback
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                const body = await response.text().catch(() => "");
                if (isDofusbookBlockResponse(response.status, contentType, body)) {
                    await openDofusbookBreaker(`bake VPS ${id} → statut ${response.status}`);
                    await trackDofusbookFailure("blocked", `${response.status} sur build ${id} (blocage anti-bot)`);
                    return { success: false, error: DOFUSBOOK_BLOCKED_MESSAGE, id };
                }
                logger.error(`[Dofusbook] API Error ${response.status} for build ${id}`);
                if (response.status === 404) return { success: false, error: "Stuff introuvable", id };
                await trackDofusbookFailure("http", `${response.status} sur build ${id}`);
                return { success: false, error: `Dofusbook bloqué (${response.status})`, id };
            }

            raw = await response.json();
        }

        if (!raw) {
            await trackDofusbookFailure("unreachable", `Aucune stratégie n'a abouti pour ${id}`);
            return { success: false, error: "Impossible de récupérer les données Dofusbook", id };
        }

        // 4. Process and cache
        const data = processDofusbookRawData(id, raw);
        resetDofusbookFailures();

        // #41bis — si le schéma de réponse a changé, la sortie peut être vide :
        // les nouveaux stuffs importés seraient cassés silencieusement.
        const hasAnyItem = data?.items && Object.values(data.items).some(Boolean);
        if (!hasAnyItem) {
            await trackDofusbookFailure("schema", `Réponse sans item exploitable pour ${id} (API changée ?)`);
        }

        if (redis && redis.status === "ready") {
            await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL);
        }

        return { success: true, data, id };
    } catch (error) {
        logger.error("[Dofusbook] Preview error:", error);
        return { success: false, error: "Erreur lors de la récupération du build", id };
    }
}
