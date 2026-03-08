import { NextRequest, NextResponse } from "next/server";

// ─── RSS Sources Dofus ────────────────────────────────────────────────────────

const FEEDS: Record<string, { url: string; label: string }> = {
    news: {
        url: "https://www.dofus.com/fr/rss/news.xml",
        label: "Actualités",
    },
    changelog: {
        url: "https://www.dofus.com/fr/rss/changelog.xml",
        label: "Changelog",
    },
    devblog: {
        url: "https://www.dofus.com/fr/rss/devblog.xml",
        label: "Devblog",
    },
    dpln: {
        url: "https://www.dofuspourlesnoobs.com/news/feed",
        label: "Dofus pour les Noobs",
    },
};

// ─── RSS Parser ───────────────────────────────────────────────────────────────

function extractCdata(content: string, tag: string): string | null {
    const cdataMatch = content.match(new RegExp(`<${tag}>[\\s]*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>[\\s]*<\\/${tag}>`));
    if (cdataMatch) return cdataMatch[1];
    const plainMatch = content.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`));
    return plainMatch ? plainMatch[1].trim() : null;
}

function parseRSSItems(xml: string, limit = 8) {
    const items: Array<{
        title: string;
        link: string;
        pubDate: string;
        description: string;
        imageUrl?: string;
        category?: string;
    }> = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        if (items.length >= limit) break;
        const content = match[1];

        const title = extractCdata(content, "title") ?? "Titre inconnu";

        // Link: CDATA → plain https → guid
        const linkCdata = content.match(/<link>[\s]*<!\[CDATA\[(.*?)\]\]>[\s]*<\/link>/);
        const linkPlain = content.match(/<link>\s*(https?:\/\/[^\s<]+)\s*<\/link>/);
        const guid = content.match(/<guid[^>]*>\s*(https?:\/\/[^\s<]+)\s*<\/guid>/);
        const link = linkCdata?.[1] ?? linkPlain?.[1] ?? guid?.[1] ?? null;

        // skip items without valid link
        if (!link) continue;

        const pubDate = extractCdata(content, "pubDate") ??
            content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
        const category = extractCdata(content, "category") ?? undefined;

        // Description: strip HTML for preview
        const descHtml = extractCdata(content, "description") ?? "";
        const description = descHtml
            .replace(/<[^>]+>/g, "")
            .replace(/&[a-z#0-9]+;/gi, " ")
            .trim()
            .substring(0, 180);

        // Image: media:content > media:thumbnail > enclosure > img in desc
        const mediaContent = content.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1];
        const mediaThumbnail = content.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
        const enclosure = content.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1];
        const imgInDesc = descHtml.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
        const imageUrl = mediaContent ?? mediaThumbnail ?? enclosure ?? imgInDesc ?? undefined;

        items.push({ title, link, pubDate, description, imageUrl, category });
    }

    return items;
}

// ─── Headers that actually work with Ankama CloudFront ───────────────────────

const FETCH_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: "https://www.google.com/",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
};

// ─── Direct fetch with browser-like headers ───────────────────────────────

async function fetchDirect(url: string, signal: AbortSignal): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: FETCH_HEADERS,
            signal,
            cache: "no-store",
        });
        if (res.ok) {
            const text = await res.text();
            if (text.length > 500) return text;
        }
        console.warn(`[news/route] Direct fetch failed: ${res.status} for ${url}`);
        return null;
    } catch (err) {
        console.error(`[news/route] Direct fetch error: ${err instanceof Error ? err.message : err}`);
        return null;
    }
}

// ─── Curl Fallback (Sometimes better fingerprint than Node fetch) ─────────────

async function fetchWithCurl(url: string): Promise<string | null> {
    try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        const userAgent = FETCH_HEADERS["User-Agent"];
        const { stdout } = await execAsync(
            `curl -L "${url}" -A "${userAgent}" -H "Accept: application/rss+xml" --max-time 15 --compressed`
        );

        if (stdout && stdout.length > 500) {
            console.log(`[news/route] Curl fallback succeeded for ${url}`);
            return stdout;
        }
    } catch (err) {
        console.warn(`[news/route] Curl fallback failed: ${err instanceof Error ? err.message : 'timeout'}`);
    }
    return null;
}

// ─── Multi-Proxy System (bypass datacenter IP blocking) ──────────────────────

const PROXIES = [
    // 1. AllOrigins (usually very reliable)
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    // 2. Codetabs (good alternative)
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    // 3. Keep-alive proxy (another fallback)
    (url: string) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
    // 4. Cors proxy (desperate fallback)
    (url: string) => `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
];

async function fetchWithProxy(url: string): Promise<string | null> {
    for (let i = 0; i < PROXIES.length; i++) {
        const proxyUrl = PROXIES[i](url);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);

        try {
            console.log(`[news/route] Attempting proxy #${i + 1} for: ${url}`);
            const res = await fetch(proxyUrl, {
                headers: { "User-Agent": "SigilOS/1.0 (Research Bot)" },
                signal: controller.signal,
                cache: "no-store",
            });
            clearTimeout(timeout);

            if (!res.ok) {
                console.warn(`[news/route] Proxy #${i + 1} returned status ${res.status} for ${url}`);
                continue;
            }

            const text = await res.text();

            // Handle AllOrigins structure vs others
            if (proxyUrl.includes('allorigins.win')) {
                try {
                    const json = JSON.parse(text) as { contents?: string };
                    if (json.contents) return json.contents;
                } catch (parseErr) {
                    console.error(`[news/route] AllOrigins parse error. Text snippet: ${text.substring(0, 100)}`);
                }
            } else if (proxyUrl.includes('htmldriven')) {
                try {
                    const json = JSON.parse(text);
                    if (json.body) return json.body;
                } catch (parseErr) {
                    console.error(`[news/route] HTMLDriven parse error. Text snippet: ${text.substring(0, 100)}`);
                }
            } else {
                if (text && text.length > 500) return text;
            }
        } catch (err) {
            clearTimeout(timeout);
            console.warn(`[news/route] Proxy #${i + 1} failed: ${err instanceof Error ? err.message : 'timeout'}`);
        }
    }
    return null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const feedKey = searchParams.get("feed") ?? "news";

    // ─── Custom DPLN Scraper ─────────────────────────────────────────────
    if (feedKey === "dpln") {
        try {
            const { fetchDPLNNews } = await import("@/lib/feed-aggregators");
            const rawItems = await fetchDPLNNews();
            const items = rawItems.map(item => ({
                title: item.title,
                link: item.url,
                imageUrl: item.thumbnail || undefined,
                pubDate: item.published.toISOString(),
                description: item.description || "",
                category: "Guide"
            }));
            return NextResponse.json(
                { items, feedKey, label: "DPLN" },
                { headers: { "Cache-Control": "public, s-maxage=1800" } }
            );
        } catch (err) {
            console.error("DPLN Scraper error", err);
            // fallback if scraper fails
        }
    }

    // ─── Custom Dofus News Fetcher (Haapi API) ───────────────────────────
    if (feedKey === "news") {
        try {
            const { fetchDofusNews } = await import("@/lib/feed-aggregators");
            const rawItems = await fetchDofusNews();
            const items = rawItems.map(item => ({
                title: item.title,
                link: item.url,
                imageUrl: item.thumbnail || undefined,
                pubDate: item.published.toISOString(),
                description: item.description || "",
                category: "Actualité"
            }));
            return NextResponse.json(
                { items, feedKey, label: "Actualités" },
                { headers: { "Cache-Control": "public, s-maxage=1800" } }
            );
        } catch (err) {
            console.error("Dofus News format error", err);
            // fallback if it fails
        }
    }

    const feed = FEEDS[feedKey] ?? FEEDS.news;

    try {
        // ── 1. Tentative directe ─────────────────────────────────────────
        let xml: string | null = null;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        xml = await fetchDirect(feed.url, controller.signal);
        clearTimeout(timeout);

        // ── 2. Fallback Curl (souvent plus probant que fetch sur VPS) ───
        if (!xml || xml.length < 500) {
            console.warn(`[news/route] Direct fetch failed (WAF), trying Curl fallback: ${feed.url}`);
            xml = await fetchWithCurl(feed.url);
        }

        // ── 3. Fallback proxy si tout le reste a échoué ─────────────────
        if (!xml || xml.length < 500) {
            console.warn(`[news/route] Direct & Curl failed, trying proxies for: ${feed.url}`);
            xml = await fetchWithProxy(feed.url);
        }

        if (!xml) {
            return NextResponse.json(
                { error: "RSS indisponible (direct + proxy échoués)", items: [] },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        const items = parseRSSItems(xml, feedKey === "dpln" ? 6 : 8);

        return NextResponse.json(
            { items, feedKey, label: feed.label },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
                },
            }
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error(`[news/route] Unhandled error: ${message}`);
        return NextResponse.json(
            { error: message, items: [] },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    }
}

// Also expose the available feeds for the dropdown
export async function HEAD() {
    return NextResponse.json(
        { feeds: Object.entries(FEEDS).map(([key, v]) => ({ key, label: v.label })) },
        { status: 200 }
    );
}
