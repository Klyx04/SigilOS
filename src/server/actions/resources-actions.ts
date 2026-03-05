"use server";

import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlmanaxItem {
    date: string;
    bonus: {
        description: string;
        type: { name: string };
    };
    tribute: {
        item: {
            name: string;
            image_urls: { icon: string; sd: string };
        };
        quantity: number;
    };
    reward_kamas?: number;
}

export interface RSSNewsItem {
    title: string;
    link: string;
    pubDate: string;
    description: string;
    imageUrl?: string;
    category?: string;
}

// ─── Almanax (7 prochains jours) ─────────────────────────────────────────────

export async function getUpcomingAlmanax(): Promise<AlmanaxItem[]> {
    try {
        // 90 jours = ~3 mois pour le filtre par type
        const url = "https://api.dofusdu.de/dofus3/v1/fr/almanax?timezone=Europe/Paris&limit=90";
        const res = await fetch(url, {
            headers: { Accept: "application/json" },
            next: { revalidate: 3600 * 6 }, // Cache 6h
        });
        if (!res.ok) {
            logger.error("Failed to fetch Almanax", { status: res.status });
            return [];
        }
        return (await res.json()) as AlmanaxItem[];
    } catch (e: unknown) {
        logger.error("Error fetching Almanax", { error: (e as Error).message });
        return [];
    }
}

// ─── Flux RSS Dofus (Actualités Ankama) ───────────────────────────────────────

export async function getDofusRSSNews(): Promise<RSSNewsItem[]> {
    try {
        const res = await fetch("https://www.dofus.com/fr/rss/news.xml", {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; SigilOS/1.0; +https://sigilos.fr)",
                Accept: "application/rss+xml, application/xml, text/xml",
            },
            next: { revalidate: 3600 }, // Cache 1h
        });

        if (!res.ok) return [];
        const xml = await res.text();

        const items: RSSNewsItem[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            if (items.length >= 6) break;
            const content = match[1];

            const titleMatch =
                content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                content.match(/<title>(.*?)<\/title>/);

            // Link: try CDATA, plain, then <guid> as fallback
            const linkCdata = content.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/);
            const linkPlain = content.match(/<link>\s*(https?:\/\/[^\s<]+)\s*<\/link>/);
            const guidMatch = content.match(/<guid[^>]*>\s*(https?:\/\/[^\s<]+)\s*<\/guid>/);
            const rawLink = linkCdata?.[1] ?? linkPlain?.[1] ?? guidMatch?.[1] ?? null;
            // Skip articles with no valid URL (prevents localhost links)
            if (!rawLink) continue;

            const pubDateMatch = content.match(/<pubDate>(.*?)<\/pubDate>/);
            const descRaw =
                content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                content.match(/<description>([\s\S]*?)<\/description>/);
            const categoryMatch =
                content.match(/<category><!\[CDATA\[(.*?)\]\]><\/category>/) ||
                content.match(/<category>(.*?)<\/category>/);

            // Try ALL possible image locations used by Ankama
            const mediaContent = content.match(/<media:content[^>]+url=["']([^"']+)["']/i);
            const mediaThumbnail = content.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
            const enclosure = content.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
            const descHtml = descRaw ? descRaw[1] : "";
            const imgInDesc = descHtml.match(/<img[^>]+src=["']([^"']+)["']/i);

            const imageUrl =
                mediaContent?.[1] ||
                mediaThumbnail?.[1] ||
                enclosure?.[1] ||
                imgInDesc?.[1] ||
                undefined;

            // Strip HTML for plain description
            const plainDesc = descHtml
                .replace(/<[^>]+>/g, "")
                .replace(/&[a-z#0-9]+;/gi, " ")
                .trim()
                .substring(0, 180);

            items.push({
                title: titleMatch?.[1] ?? "Titre inconnu",
                link: rawLink,
                pubDate: pubDateMatch?.[1] ?? "",
                description: plainDesc,
                imageUrl,
                category: categoryMatch?.[1],
            });
        }

        return items;
    } catch (e: unknown) {
        logger.error("Error parsing Dofus RSS", { error: (e as Error).message });
        return [];
    }
}
