"use server";
import { logger } from "@/lib/logger";

import redis from "@/lib/redis";
import { processDofusbookRawData, type DofusbookPreviewData } from "@/lib/dofusbook-utils";

const DOFUSBOOK_API = "https://www.dofusbook.net/api/stuffs/dofus/public/";
const CACHE_TTL = 3600 * 24; // 24 hours

/**
 * Extracts the numerical ID from a Dofusbook URL.
 * Supports both full and short URLs (by following redirects).
 */
export async function getDofusbookId(url: string): Promise<string | null> {
    try {
        // 1. Direct regex for full URLs
        const fullUrlMatch = url.match(/(?:equipement|dofus)\/(?:[a-z]+\/)?(?:private\/)?(\d+)/i);
        if (fullUrlMatch) return fullUrlMatch[1];

        // 2. Short URL resolution (d-bk.net)
        if (url.includes("d-bk.net")) {
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

    const cacheKey = `sigilos:dofusbook:v11:${id}`;

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

        // 2. Strategy 1 — CF Worker (preferred)
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
                    logger.warn(`[Dofusbook Action] CF Worker ${workerRes.status} for ${id} — VPS fallback`);
                }
            } catch (err) {
                logger.warn(`[Dofusbook Action] CF Worker failed for ${id}:`, err);
            }
        }

        // 3. Strategy 2 — Direct VPS fetch (fallback)
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
                logger.error(`[Dofusbook] API Error ${response.status} for build ${id}`);
                if (response.status === 404) return { success: false, error: "Stuff introuvable", id };
                return { success: false, error: `Dofusbook bloqué (${response.status})`, id };
            }

            raw = await response.json();
        }

        if (!raw) return { success: false, error: "Impossible de récupérer les données Dofusbook", id };

        // 4. Process and cache
        const data = processDofusbookRawData(id, raw);

        if (redis && redis.status === "ready") {
            await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL);
        }

        return { success: true, data, id };
    } catch (error) {
        logger.error("[Dofusbook] Preview error:", error);
        return { success: false, error: "Erreur lors de la récupération du build", id };
    }
}
