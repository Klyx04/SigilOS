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

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const feedKey = searchParams.get("feed") ?? "news";
    const feed = FEEDS[feedKey] ?? FEEDS.news;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(feed.url, {
            headers: FETCH_HEADERS,
            signal: controller.signal,
            // NO next.js cache — always fresh, handle caching ourselves
            cache: "no-store",
        });
        clearTimeout(timeout);

        if (!res.ok) {
            return NextResponse.json(
                { error: `RSS fetch failed: ${res.status}`, items: [] },
                {
                    status: 200, // Return 200 so client handles gracefully
                    headers: { "Cache-Control": "no-store" },
                }
            );
        }

        const xml = await res.text();
        const items = parseRSSItems(xml, 8);

        return NextResponse.json(
            { items, feedKey, label: feed.label },
            {
                headers: {
                    // Cache 30 min on CDN/browser
                    "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
                },
            }
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "unknown error";
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
