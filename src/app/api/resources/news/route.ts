import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";

// ─── Changelog DB Cache (perf #21) ───────────────────────────────────────
// Tag dédié « Dofus-Changelog » : non purgé par feed-actions (qui ne touche
// que TWITCH / « Ankama » / « DPLN ») → cache stable pour l'onglet Patch Notes.
// Lecture en stale-while-revalidate : on sert le cache immédiatement, le refresh
// externe (Ankama Haapi) ne bloque plus jamais la réponse.
const CHANGELOG_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const CHANGELOG_CREATOR_ID = "Dofus-Changelog";

interface DofusChangelogItem {
    title: string;
    link: string;
    imageUrl?: string;
    pubDate: string;
    description: string;
    category: string;
}

function mapRawDofusItem(item: { title: string; url: string; thumbnail: string | null; published: Date; description?: string }): DofusChangelogItem {
    let isoDate = new Date().toISOString();
    try {
        if (item.published && !isNaN(item.published.getTime())) {
            isoDate = item.published.toISOString();
        }
    } catch (e) { /* fallback to now */ }

    return {
        title: `[DOFUS] ${item.title}`,
        link: item.url,
        imageUrl: item.thumbnail || undefined,
        pubDate: isoDate,
        description: item.description || "",
        category: "Dofus Update"
    };
}

function mapCachedDofusItem(row: { title: string; url: string; thumbnail: string | null; published: Date; description: string | null }): DofusChangelogItem {
    return {
        title: `[DOFUS] ${row.title}`,
        link: row.url,
        imageUrl: row.thumbnail || undefined,
        pubDate: row.published.toISOString(),
        description: row.description || "",
        category: "Dofus Update"
    };
}

async function getCachedDofusChangelogs() {
    return db.contentCache.findMany({
        where: { type: "NEWS", creatorId: CHANGELOG_CREATOR_ID },
        orderBy: { published: "desc" },
        take: 10,
    });
}

async function persistDofusChangelogs(items: { title: string; url: string; thumbnail: string | null; published: Date; description?: string }[]) {
    const now = new Date();
    await Promise.all(
        items.slice(0, 10).map(item =>
            db.contentCache.upsert({
                where: {
                    type_creatorId_url: {
                        type: "NEWS",
                        creatorId: CHANGELOG_CREATOR_ID,
                        url: item.url,
                    },
                },
                update: {
                    title: item.title,
                    thumbnail: item.thumbnail,
                    description: item.description ?? null,
                    published: item.published,
                    fetchedAt: now,
                },
                create: {
                    type: "NEWS",
                    creatorId: CHANGELOG_CREATOR_ID,
                    title: item.title,
                    url: item.url,
                    thumbnail: item.thumbnail,
                    description: item.description ?? null,
                    published: item.published,
                    fetchedAt: now,
                },
            })
        )
    );
}

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
        logger.warn(`[news/route] Direct fetch failed: ${res.status}`, { url });
        return null;
    } catch (err) {
        logger.error(`[news/route] Direct fetch error`, { error: err });
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
            logger.info(`[news/route] Curl fallback succeeded`, { url });
            return stdout;
        }
    } catch (err) {
        logger.warn(`[news/route] Curl fallback failed`, { error: err });
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
            logger.debug(`[news/route] Attempting proxy #${i + 1}`, { url });
            const res = await fetch(proxyUrl, {
                headers: { "User-Agent": "SigilOS/1.0 (Research Bot)" },
                signal: controller.signal,
                cache: "no-store",
            });
            clearTimeout(timeout);

            if (!res.ok) {
                logger.warn(`[news/route] Proxy #${i + 1} returned status ${res.status}`, { url });
                continue;
            }

            const text = await res.text();

            // Handle AllOrigins structure vs others
            if (proxyUrl.includes('allorigins.win')) {
                try {
                    const json = JSON.parse(text) as { contents?: string };
                    if (json.contents) return json.contents;
                } catch (parseErr) {
                    logger.error(`[news/route] AllOrigins parse error.`, { snippet: text.substring(0, 100) });
                }
            } else if (proxyUrl.includes('htmldriven')) {
                try {
                    const json = JSON.parse(text);
                    if (json.body) return json.body;
                } catch (parseErr) {
                    logger.error(`[news/route] HTMLDriven parse error.`, { snippet: text.substring(0, 100) });
                }
            } else {
                if (text && text.length > 500) return text;
            }
        } catch (err) {
            clearTimeout(timeout);
            logger.warn(`[news/route] Proxy #${i + 1} failed`, { error: err });
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
            logger.error("DPLN Scraper error", { error: err });
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
            if (items.length > 0) {
                return NextResponse.json(
                    { items, feedKey, label: "Actualités" },
                    { headers: { "Cache-Control": "public, s-maxage=1800" } }
                );
            }
        } catch (err) {
            logger.error("Dofus News format error", { error: err });
            // fallback if it fails
        }
    }
    
    // ─── Custom Dofus Changelog Fetcher (Haapi API) ─────────────────────
    // Perf #21 : le feed Dofus est mis en cache (ContentCache, tag dédié
    // « Dofus-Changelog ») et servi en stale-while-revalidate → l'onglet
    // « Dofus Patch Notes & Correctifs » répond toujours rapidement.
    if (feedKey === "changelog") {
        try {
            const { getChangelogEntries } = await import("@/server/actions/changelog-actions");

            // 2. SigilOS Internal Changelogs (rapide, sert de base à toute réponse)
            const { getAppBaseUrl } = await import("@/lib/utils");
            const baseUrl = getAppBaseUrl();
            const sigilEntries = await getChangelogEntries(undefined, true);
            const sigilItems = sigilEntries.slice(0, 5).map(entry => ({
                title: `[SigilOS] ${entry.title}`,
                link: `${baseUrl}/changelog`,
                imageUrl: `/module-dofus/Dofus_Emeraude.png`, // User requested Emerald Dofus
                pubDate: entry.publishedAt,
                description: entry.summary || `Version ${entry.version} de votre plateforme.`,
                category: "App Update"
            }));

            const respond = (dofusItems: DofusChangelogItem[]) => {
                const items = [...sigilItems, ...dofusItems].sort((a, b) =>
                    new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
                );
                return NextResponse.json(
                    { items, feedKey, label: "Changelog" },
                    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
                );
            };

            // 1. Lire le cache (fresh → réponse immédiate)
            const cached = await getCachedDofusChangelogs();
            const newestFetchedAt = cached[0]?.fetchedAt;
            const isFresh = newestFetchedAt != null &&
                Date.now() - newestFetchedAt.getTime() < CHANGELOG_CACHE_TTL_MS;

            if (cached.length > 0 && isFresh) {
                return respond(cached.map(mapCachedDofusItem));
            }

            // 3. Refresh externe (borné par les deadlines de feed-aggregators)
            const { fetchDofusChangelogs } = await import("@/lib/feed-aggregators");
            const rawItems = await fetchDofusChangelogs();
            if (rawItems.length > 0) {
                await persistDofusChangelogs(rawItems);
                return respond(rawItems.map(mapRawDofusItem));
            }

            // 4. Fetch échoué → servir le cache périmé plutôt que rien
            if (cached.length > 0) {
                return respond(cached.map(mapCachedDofusItem));
            }

            // 5. Aucune donnée Dofus → base SigilOS uniquement
            return respond([]);
        } catch (err) {
            logger.error("Dofus Changelog format error", { error: err });
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
            logger.warn(`[news/route] Direct fetch failed (WAF), trying Curl fallback`, { url: feed.url });
            xml = await fetchWithCurl(feed.url);
        }

        // ── 3. Fallback proxy si tout le reste a échoué ─────────────────
        if (!xml || xml.length < 500) {
            logger.warn(`[news/route] Direct & Curl failed, trying proxies`, { url: feed.url });
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
        logger.error(`[news/route] Unhandled error`, { message });
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
