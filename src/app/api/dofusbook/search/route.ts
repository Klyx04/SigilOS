import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

// Cache TTL: 1 hour for searches
const SEARCH_CACHE_TTL = 3600;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase().trim();
    const category = searchParams.get("category");
    const minLevel = searchParams.get("minLevel") || "1";
    const maxLevel = searchParams.get("maxLevel") || "200";

    if (!query || query.length < 2) {
        return NextResponse.json({ error: "Query too short" }, { status: 400 });
    }

    const cacheKey = `dofusbook:search:${query}:${category || 'all'}:${minLevel}-${maxLevel}`;

    try {
        // 1. Check Redis Cache first
        const cachedResults = await redis.get(cacheKey);
        if (cachedResults) {
            return NextResponse.json(JSON.parse(cachedResults), {
                headers: { "X-Cache": "HIT" }
            });
        }

        // 2. Fetch from Dofusbook if not in cache
        // 🔒 SSRF/injection fix: replace exec(curl) with native fetch. All query
        // params are URI-encoded so they cannot break out of the URL string.
        const safeCategory = category ? encodeURIComponent(category) : "";
        const url = `https://www.dofusbook.net/api/items/dofus/search/equipment?keywords=${encodeURIComponent(query)}&context=item&page=1&sort=desc${safeCategory ? `&include=${safeCategory}` : ""}&level_min=${encodeURIComponent(minLevel)}&level_max=${encodeURIComponent(maxLevel)}`;

        // Advanced Browser Simulation Headers (Best practices 2026)
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
        const referer = "https://www.dofusbook.net/fr/encyclopedie/items";

        const response = await fetch(url, {
            headers: {
                "User-Agent": userAgent,
                "Referer": referer,
                "x-lang": "fr",
                "Accept": "application/json, text/plain, */*",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Upstream HTTP ${response.status}` }, { status: 502 });
        }
        const stdout = await response.text();

        if (!stdout) {
            return NextResponse.json({ error: "Empty response from source" }, { status: 502 });
        }

        // Handle Cloudflare/WAF HTML instead of JSON
        if (stdout.trim().startsWith("<!DOCTYPE html>")) {
            return NextResponse.json({ error: "Access denied by provider" }, { status: 403 });
        }

        const data = JSON.parse(stdout);

        // 3. Save to Redis for future requests
        await redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(data));

        return NextResponse.json(data, {
            headers: { "X-Cache": "MISS" }
        });

    } catch {
        return NextResponse.json({ error: "Request processing failed" }, { status: 500 });
    }
}
