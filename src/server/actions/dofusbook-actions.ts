"use server";

import redis from "@/lib/redis";
import { z } from "zod";

const DOFUSBOOK_API = "https://www.dofusbook.net/api/stuffs/dofus/public/";
const CACHE_TTL = 3600 * 24; // 24 hours

export type DofusbookPreviewData = {
    id: number;
    name: string;
    level: number;
    className: string;
    classId: number;
    stats: {
        pa: number;
        pm: number;
        po: number;
        ini: number;
        invoc: number;
        vit: number;
    };
    resists: {
        neutre: number;
        terre: number;
        feu: number;
        eau: number;
        air: number;
    };
};

/**
 * Extracts the numerical ID from a Dofusbook URL.
 * Supports both full and short URLs (by following redirects).
 */
export async function getDofusbookId(url: string): Promise<string | null> {
    try {
        // 1. Direct regex for full URLs
        const fullUrlMatch = url.match(/equipement\/(\d+)/);
        if (fullUrlMatch) return fullUrlMatch[1];

        // 2. Short URL resolution
        if (url.includes("d-bk.net")) {
            const response = await fetch(url, {
                method: "HEAD",
                redirect: "follow",
                headers: {
                    "User-Agent": "SigilOS-Bot/1.0 (+https://sigilos.fr)"
                }
            });
            const finalUrl = response.url;
            const finalMatch = finalUrl.match(/equipement\/(\d+)/);
            return finalMatch ? finalMatch[1] : null;
        }

        return null;
    } catch (e) {
        console.error("[Dofusbook] ID extraction failed:", e);
        return null;
    }
}

/**
 * Fetches preview data from Dofusbook API with Redis caching.
 */
export async function getDofusbookPreview(url: string): Promise<{ success: boolean; data?: DofusbookPreviewData; error?: string }> {
    const id = await getDofusbookId(url);
    if (!id) return { success: false, error: "Identifiant Dofusbook introuvable" };

    const cacheKey = `sigilos:dofusbook:v2:${id}`;

    try {
        // 1. Check Cache
        if (redis && redis.status === "ready") {
            const cached = await redis.get(cacheKey);
            if (cached) return { success: true, data: JSON.parse(cached) };
        }

        // 2. Fetch from API
        const response = await fetch(`${DOFUSBOOK_API}${id}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Referer": "https://www.dofusbook.net/"
            },
            next: { revalidate: CACHE_TTL }
        });

        if (!response.ok) {
            // If we are blocked/forbidden, we don't want to show a big red error on the profile.
            // We'll return a "partial" success that tells the UI to show a simple link card.
            if (response.status === 403 || response.status === 401) {
                console.warn(`[Dofusbook] Access denied for build ${id}. Falling back to simple link.`);
                const data: DofusbookPreviewData = {
                    id: parseInt(id),
                    name: "Voir le build", // Default name
                    level: 200,
                    className: "Dofusbook",
                    classId: 0,
                    stats: { pa: 0, pm: 0, po: 0, ini: 0, invoc: 0, vit: 0 },
                    resists: { neutre: 0, terre: 0, feu: 0, eau: 0, air: 0 }
                };
                return { success: true, data }; // Return as success so it renders the card
            }
            if (response.status === 404) return { success: false, error: "Stuff introuvable" };
            return { success: false, error: "Erreur API Dofusbook" };
        }

        const raw = await response.json();

        // 🔍 HEURISTICS: Try to find where the stats totals are.
        let statsArray: any[] = [];
        if (Array.isArray(raw.stuffStats)) {
            statsArray = raw.stuffStats;
        } else {
            // Check if there's a 'stats' array or similar
            const potentialArray = Object.values(raw).find(v =>
                Array.isArray(v) &&
                v.length > 5 &&
                typeof v[0] === 'object' &&
                ('id' in v[0] || 'stat_id' in v[0])
            );
            if (potentialArray) statsArray = potentialArray as any[];
        }

        const getStat = (id: number) => {
            const stat = statsArray.find((s: any) => (s.id === id || s.stat_id === id));
            return stat ? (stat.total || stat.value || 0) : 0;
        };

        // Important: check if we actually have stats
        const hasStats = statsArray.length > 0;

        const data: DofusbookPreviewData = {
            id: parseInt(id),
            name: raw.stuff?.name || "Sans nom",
            level: raw.stuff?.character_level || 200,
            classId: raw.stuff?.character_class || 1,
            className: getClassName(raw.stuff?.character_class),
            stats: {
                pa: hasStats ? getStat(1) : 0,
                pm: hasStats ? getStat(2) : 0,
                po: getStat(19),
                ini: getStat(24),
                invoc: getStat(26),
                vit: getStat(11),
            },
            resists: {
                neutre: getStat(33),
                terre: getStat(34),
                feu: getStat(35),
                eau: getStat(36),
                air: getStat(37),
            }
        };

        // If stats are all 0 (except PA/PM fallbacks), we might be in "Only Base Stats" mode
        // In that case, we can't reliably show the stats block without manual item sum.
        // We still return the data, but we might want to flag it for the UI.

        // 3. Store in Cache (Only if we have some data)
        if (redis && redis.status === "ready") {
            await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL);
        }

        return { success: true, data };
    } catch (error) {
        console.error("[Dofusbook] Preview error:", error);
        return { success: false, error: "Erreur lors de la récupération du build" };
    }
}

function getClassName(id: number): string {
    const classes: Record<number, string> = {
        1: "Féca", 2: "Osamodas", 3: "Enutrof", 4: "Sram", 5: "Xélor",
        6: "Écaflip", 7: "Éniripsa", 8: "Iop", 9: "Crâ", 10: "Sadida",
        11: "Sacrieur", 12: "Pandawa", 13: "Roublard", 14: "Zobal", 15: "Steamer",
        16: "Éliotrope", 17: "Huppermage", 18: "Ouginak", 19: "Forgelance"
    };
    return classes[id] || "Inconnu";
}
