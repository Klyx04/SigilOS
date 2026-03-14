import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

// Cache TTL: 24 hours for builds, 5 min for failed builds
const BUILD_CACHE_TTL = 86400;
const STALE_CACHE_KEY_PREFIX = "dofusbook:stale:";

// Rotate user agents to reduce bot detection
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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

    try {
        // 1. Check Redis Cache — always serve cached data first
        try {
            const cachedData = await redis.get(cacheKey);
            if (cachedData) {
                return NextResponse.json(JSON.parse(cachedData), {
                    headers: { "X-Cache": "HIT" }
                });
            }
        } catch (redisError) {
            console.warn("[Dofusbook Proxy] Redis error, bypassing cache:", redisError);
        }

        let finalId = id;

        // 2. Resolve short URL if needed
        if (!/^\d+$/.test(id)) {
            const shortUrl = `https://d-bk.net/fr/d/${id}`;
            try {
                const headRes = await fetch(shortUrl, { 
                    method: "HEAD", 
                    redirect: "manual",
                    headers: {
                        "User-Agent": getRandomUA(),
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    }
                });
                
                const location = headRes.headers.get("location");
                if (location) {
                    const idMatch = location.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
                    if (idMatch) {
                        finalId = idMatch[1];
                    } else {
                        return NextResponse.json({ error: "L'URL raccourcie ne redirige pas vers un équipement valide" }, { status: 400 });
                    }
                } else {
                    const getRes = await fetch(shortUrl, { 
                        method: "GET", 
                        redirect: "follow",
                        headers: { "User-Agent": getRandomUA() }
                    });
                    const finalUrl = getRes.url;
                    const idMatch = finalUrl.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
                    if (idMatch) {
                        finalId = idMatch[1];
                    } else {
                        return NextResponse.json({ error: "Impossible de résoudre le lien Dofusbook" }, { status: 404 });
                    }
                }
            } catch (err) {
                console.error("[Dofusbook Proxy] Redirect resolution failed:", err);
                return NextResponse.json({ error: "Resolution failed" }, { status: 500 });
            }
        }

        // 3. Fetch from Dofusbook API with anti-detection headers
        const apiUrl = `https://www.dofusbook.net/api/stuffs/dofus/public/${finalId}`;
        
        let response: Response | null = null;
        let lastError: any = null;
        const maxAttempts = 2;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                response = await fetch(apiUrl, {
                    headers: {
                        "User-Agent": getRandomUA(),
                        "Accept": "application/json, text/plain, */*",
                        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                        "Referer": `https://www.dofusbook.net/fr/equipement/${finalId}`,
                        "DNT": "1",
                        "Sec-Fetch-Dest": "empty",
                        "Sec-Fetch-Mode": "cors",
                        "Sec-Fetch-Site": "same-origin",
                    },
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (response.ok) break;
                if (response.status === 403) {
                    console.warn(`[Dofusbook Proxy] Attempt ${attempt} failed with 403 for ${finalId}`);
                }
            } catch (err) {
                clearTimeout(timeoutId);
                lastError = err;
                console.warn(`[Dofusbook Proxy] Attempt ${attempt} error for ${finalId}:`, err);
            }
            
            if (attempt < maxAttempts) {
                 await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
            }
        }

        if (!response || !response.ok) {
            const status = response?.status || 500;
            if (status === 403 && response) {
                const body = await response.text();
                console.error(`[Dofusbook Proxy] 403 Forbidden for ${finalId}. Body snippet: ${body.substring(0, 200)}`);
                
                // Try to serve stale data if we have it from a previous successful fetch
                try {
                    const staleData = await redis.get(`${STALE_CACHE_KEY_PREFIX}${finalId}`);
                    if (staleData) {
                        console.warn(`[Dofusbook Proxy] 403 for build ${finalId} — serving stale cache`);
                        return NextResponse.json(JSON.parse(staleData), {
                            headers: { "X-Cache": "STALE" }
                        });
                    }
                } catch {}
                return NextResponse.json({ error: "Dofusbook API error: 403 (Protected or Blocked)" }, { status: 403 });
            }

            if (response) {
                const body = await response.text();
                console.error(`[Dofusbook Proxy] Error ${response.status} for ${finalId}: ${body.substring(0, 100)}`);
                return NextResponse.json({ error: `Dofusbook API error: ${response.status}` }, { status: response.status });
            }
            
            return NextResponse.json({ error: "Dofusbook API unavailable", details: lastError?.message }, { status: 500 });
        }

        const data = await response.json();
        
        // 4. Save to Redis (both primary cache and a long-lived stale backup)
        try {
            await Promise.all([
                redis.setex(cacheKey, BUILD_CACHE_TTL, JSON.stringify(data)),
                redis.setex(`${STALE_CACHE_KEY_PREFIX}${finalId}`, BUILD_CACHE_TTL * 7, JSON.stringify(data)), // 7 days stale
            ]);
        } catch (redisErr) {
            console.error("[Dofusbook Proxy] Failed to cache in Redis:", redisErr);
        }

        return NextResponse.json(data, {
            headers: { "X-Cache": "MISS" }
        });

    } catch (globalError: any) {
        console.error(`[Dofusbook Proxy] Global Error:`, globalError.message);
        return NextResponse.json({ error: "Proxy internal error", details: globalError.message }, { status: 500 });
    }
}
