import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/dofusdb/search?q=...&limit=8
 * Proxy serveur pour l'API DofusDB (evite le CORS cote client).
 * Recherche via Dofusdude en amont car DofusDB ne prend plus en charge les recherches textuelles.
 *
 * #78 - recherche etendue aux 4 categories exposees par Dofusdude v1 :
 * equipment (armes & equipements), resources, consumables, cosmetics (montiliers/apparats).
 */
const DOFUSDUDE_SEARCH_TYPES = ["equipment", "resources", "consumables", "cosmetics"] as const;

const MAX_LIMIT = 24;

// ─── Cache Mémoire Serveur (In-Memory LRU/TTL 5 min) ───────────────────────────
interface SearchCacheEntry {
    data: any[];
    expiresAt: number;
}
const searchCache = new Map<string, SearchCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 500;

function getCachedSearch(key: string): any[] | null {
    const entry = searchCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        searchCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCachedSearch(key: string, data: any[]): void {
    if (searchCache.size >= MAX_CACHE_ENTRIES) {
        // Eviction du plus vieux tiers
        const keysToDelete = Array.from(searchCache.keys()).slice(0, 50);
        keysToDelete.forEach((k) => searchCache.delete(k));
    }
    searchCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Bornage defensif des donnees issues de l'API externe (RULES.md par.4). */
function extractAnkamaIds(payload: unknown): number[] {
    if (!Array.isArray(payload)) return [];
    const ids: number[] = [];
    for (const item of payload) {
        const id = item?.ankama_id;
        if (typeof id === "number" && Number.isInteger(id) && id > 0) ids.push(id);
    }
    return ids;
}

function normalizeEffects(effects: any[]) {
    if (!Array.isArray(effects)) return [];
    return effects.map((fx) => {
        const rawFrom = fx.from ?? fx.diceNum ?? fx.min ?? fx.value;
        const rawTo = fx.to ?? (fx.diceSide !== undefined && fx.diceSide !== 0 ? fx.diceSide : rawFrom) ?? fx.max ?? rawFrom;
        const from = Number(rawFrom ?? 0);
        const to = Number(rawTo ?? from);
        return {
            ...fx,
            from,
            to,
        };
    });
}

function normalizeItem(item: any) {
    if (!item) return item;
    const fx = normalizeEffects(item.effects || item.possibleEffects || []);
    return {
        ...item,
        effects: fx,
        possibleEffects: fx,
    };
}

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const rawLimit = parseInt(searchParams.get("limit") ?? "8", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : 8;

    if (!q || q.length < 2) {
        return NextResponse.json({ data: [] });
    }

    const cacheKey = `${q.toLowerCase()}:${limit}`;
    const cached = getCachedSearch(cacheKey);
    if (cached) {
        return NextResponse.json({ data: cached });
    }

    try {
        // 0. LOCAL-FIRST : Recherche d'abord dans notre base locale GameItem (0ms, zéro dépendance réseau)
        try {
            const { searchLocalGameItems } = await import("@/server/actions/game-item-actions");
            const localRes = await searchLocalGameItems(q, "all", limit);
            if (localRes.success && localRes.data && localRes.data.length > 0) {
                const formatted = localRes.data.map((item) => normalizeItem({
                    id: item.ankamaId,
                    name: { fr: item.name },
                    level: item.level,
                    type: { name: { fr: item.typeName } },
                    description: item.description ? { fr: item.description } : undefined,
                    effects: item.effects,
                    hasRecipe: item.hasRecipe,
                    img: item.iconUrl || `/uploads/assets-dofus/items/${item.ankamaId}.webp`,
                }));
                setCachedSearch(cacheKey, formatted);
                return NextResponse.json({ data: formatted });
            }
        } catch {
            // Poursuite vers le réseau si DB locale non alimentée
        }

        // 1. RECHERCHE DIRECTE DofusDB (Ultra-rapide, 1 seul appel ~150-250ms)
        const sanitizedRegex = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, ".*");
        const directUrl = `https://api.dofusdb.fr/items?name.fr[$regex]=${encodeURIComponent(sanitizedRegex)}&name.fr[$options]=i&$limit=${limit}`;
        try {
            const directRes = await fetch(directUrl, {
                headers: { Accept: "application/json", "User-Agent": "SigilOS/1.0" },
                next: { revalidate: 300 },
                signal: AbortSignal.timeout(2500),
            });
            if (directRes.ok) {
                const directData = await directRes.json();
                const items = Array.isArray(directData?.data) ? directData.data : [];
                if (items.length > 0) {
                    const normalizedItems = items.map(normalizeItem);
                    setCachedSearch(cacheKey, normalizedItems);
                    return NextResponse.json({ data: normalizedItems });
                }
            }
        } catch {
            // Poursuite vers le fallback Dofusdude en secours
        }

        // 2. Chercher les identifiants uniques via Dofusdude (toutes les catégories d'items) en secours.
        const results = await Promise.allSettled(
            DOFUSDUDE_SEARCH_TYPES.map((type) =>
                fetch(
                    "https://api.dofusdu.de/dofus3/v1/fr/items/" + type + "/search?query=" + encodeURIComponent(q) + "&limit=" + limit,
                    { signal: AbortSignal.timeout(3000) }
                ).then((res) => (res.ok ? res.json() : []))
            )
        );

        const ids: number[] = [];
        for (const result of results) {
            if (result.status === "fulfilled") {
                ids.push(...extractAnkamaIds(result.value));
            } else {
                logger.warn("[DofusDB Search Proxy] Categorie Dofusdude en echec", {
                    reason: String(result.reason),
                });
            }
        }
        const uniqueIds = [...new Set(ids)].slice(0, limit);

        // 3. Si des IDs ont été trouvés, récupérer les items complets sur DofusDB via l'opérateur $in
        if (uniqueIds.length > 0) {
            const queryParams = uniqueIds.map((id) => "id[$in][]=" + id).join("&");
            const url = "https://api.dofusdb.fr/items?" + queryParams + "&$limit=" + limit;
            const res = await fetch(url, {
                headers: {
                    Accept: "application/json",
                    "User-Agent": "SigilOS/1.0",
                },
                next: { revalidate: 300 },
            });

            if (res.ok) {
                const data = await res.json();
                const itemsMap = new Map(
                    (Array.isArray(data?.data) ? data.data : []).map((it: any) => [Number(it?.id), it])
                );
                const orderedData = uniqueIds
                    .map((id) => itemsMap.get(id))
                    .filter((it) => it !== undefined)
                    .map(normalizeItem);

                if (orderedData.length > 0) {
                    setCachedSearch(cacheKey, orderedData);
                }

                return NextResponse.json({ data: orderedData });
            }
        }

        // 4. Fallback ultime : recherche exacte par nom
        const fallbackUrl = "https://api.dofusdb.fr/items?name.fr=" + encodeURIComponent(q) + "&$limit=" + limit;
        const res = await fetch(fallbackUrl, {
            headers: {
                Accept: "application/json",
                "User-Agent": "SigilOS/1.0",
            },
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            return NextResponse.json({ data: [], error: "DofusDB returned " + res.status }, { status: 200 });
        }

        const data = await res.json();
        const fallbackData = (Array.isArray(data?.data) ? data.data : []).map(normalizeItem);
        if (fallbackData.length > 0) {
            setCachedSearch(cacheKey, fallbackData);
        }
        return NextResponse.json({ data: fallbackData });

    } catch (err) {
        logger.error("[DofusDB Search Proxy] Error", {
            err: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ data: [], error: "Proxy error" }, { status: 200 });
    }
}
