import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const BUILD_CACHE_TTL = 86400; // 24h
const STALE_CACHE_KEY_PREFIX = "dofusbook:stale:";

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

            console.warn(`[Dofusbook] CF Worker ${workerRes.status} for ${finalId} — fallback VPS`);
        } catch (err) {
            console.warn(`[Dofusbook] CF Worker failed for ${finalId}:`, err);
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
        // 1. Redis cache — serve first, always (skip if force)
        if (!force) {
            try {
                const cachedData = await redis.get(cacheKey);
                if (cachedData) {
                    return NextResponse.json(JSON.parse(cachedData as string), {
                        headers: { "X-Cache": "HIT" }
                    });
                }
            } catch (redisError) {
                console.warn("[Dofusbook] Redis error:", redisError);
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
            // Last resort: stale cache
            try {
                const staleData = await redis.get(`${STALE_CACHE_KEY_PREFIX}${finalId}`);
                if (staleData) {
                    console.warn(`[Dofusbook] Serving stale cache for ${finalId}`);
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

        // 4. Cache in Redis
        try {
            await Promise.all([
                redis.setex(cacheKey, BUILD_CACHE_TTL, JSON.stringify(data)),
                redis.setex(`${STALE_CACHE_KEY_PREFIX}${finalId}`, BUILD_CACHE_TTL * 7, JSON.stringify(data)),
            ]);
        } catch (redisErr) {
            console.error("[Dofusbook] Redis write failed:", redisErr);
        }

        return NextResponse.json(data, { headers: { "X-Cache": "MISS" } });

    } catch (globalError: any) {
        console.error("[Dofusbook] Global Error:", globalError.message);
        return NextResponse.json({ error: "Proxy internal error" }, { status: 500 });
    }
}
