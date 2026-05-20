/**
 * Utility to generate and verify Dofus pour les Noobs URLs.
 * Handles accent stripping, special characters, and verifies the URL via a HEAD request.
 * Caches results in memory to avoid repeated network hits.
 */

const dplnUrlCache = new Map<string, string>();

/**
 * Generate alternative slug candidates for Dofus pour les Noobs
 */
export function generateDPLNSlugs(questName: string): string[] {
    const baseClean = questName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // strip accents

    // Candidate 1: Replace apostrophes with hyphens (DPLN standard for "C'est ton destin" -> "c-est-ton-destin")
    const slug1 = baseClean
        .replace(/['’]/g, "-")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    // Candidate 2: Remove apostrophes completely (e.g. "l'etoile" -> "letoile")
    const slug2 = baseClean
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    return Array.from(new Set([slug1, slug2])).filter(Boolean);
}

/**
 * Verifies if a DPLN URL exists using a HEAD request.
 * Falls back to search-results.html if none are found.
 */
export async function getVerifiedDPLNUrl(questName: string): Promise<string> {
    if (!questName) return "";
    
    const trimmedName = questName.trim();
    if (dplnUrlCache.has(trimmedName)) {
        return dplnUrlCache.get(trimmedName)!;
    }

    const slugs = generateDPLNSlugs(trimmedName);

    for (const slug of slugs) {
        const url = `https://www.dofuspourlesnoobs.com/${slug}.html`;
        try {
            // Fast HEAD request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);

            const res = await fetch(url, {
                method: "HEAD",
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            });

            clearTimeout(timeoutId);

            if (res.status === 200) {
                dplnUrlCache.set(trimmedName, url);
                return url;
            }
        } catch (error) {
            // Fall through to next candidate
        }
    }

    // Ultimate fallback: Search via Google site search
    const fallback = `https://www.google.com/search?q=site:dofuspourlesnoobs.com+${encodeURIComponent(`"${trimmedName}"`)}`;
    dplnUrlCache.set(trimmedName, fallback);
    return fallback;
}
