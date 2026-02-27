// =============================================================================
// DOFUSDUDE API CLIENT — SigilOS Services Module
// =============================================================================
// API: https://api.dofusdu.de/dofus3/v1/fr/
// Free, no key required, but rate-limited. Cache prevents flooding.

import { DOFUS_JOBS as _DOFUS_JOBS_SRC } from "@/lib/dofus-assets";

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface DofusItem {
    ankamaId: number;
    name: string;
    level: number;
    type: string;
    iconUrl: string;
}

export interface DofusQuest {
    id: number;
    name: string;
    levelMin: number | null;
    levelMax: number | null;
    isDungeonQuest: boolean;
    dofusdbUrl: string;
}

export interface DofusJob {
    id: number;
    name: string;
    iconUrl: string;
}

export type DofusItemCategory = "equipment" | "resources" | "consumables" | "all";

// -----------------------------------------------------------------------------
// CACHE (In-Memory, TTL 5 minutes)
// -----------------------------------------------------------------------------

interface CacheEntry {
    data: DofusItem[];
    expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): DofusItem[] | null {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        _cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key: string, data: DofusItem[]): void {
    _cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

// -----------------------------------------------------------------------------
// API BASE
// -----------------------------------------------------------------------------

const DOFUSDUDE_BASE = "https://api.dofusdu.de/dofus3/v1/fr";

// Maps category → endpoint path
const CATEGORY_ENDPOINTS: Record<DofusItemCategory, string[]> = {
    equipment: ["/items/equipment/search"],
    resources: ["/items/resources/search"],
    consumables: ["/items/consumables/search"],
    all: ["/items/equipment/search", "/items/resources/search"],
};

// Dofusdude image CDN base
const IMG_BASE = "https://api.dofusdu.de";

function normalizeIconUrl(raw: string | undefined | null): string {
    if (!raw) return "/images/placeholder-item.png";
    if (raw.startsWith("http")) return raw;
    return `${IMG_BASE}${raw}`;
}

// -----------------------------------------------------------------------------
// SEARCH
// -----------------------------------------------------------------------------

interface DofusdudeSingleItemResponse {
    ankama_id?: number;
    name?: string;
    level?: number;
    type?: { name?: string };
    image_urls?: { icon?: string };
    items?: Array<{
        ankama_id?: number;
        name?: string;
        level?: number;
        type?: { name?: string };
        image_urls?: { icon?: string };
    }>;
}

function parseItems(json: DofusdudeSingleItemResponse): DofusItem[] {
    // Dofusdude returns { items: [...] } for search endpoints
    const rawItems = json.items ?? (Array.isArray(json) ? json : []);
    return (rawItems as typeof json.items ?? []).map((raw) => ({
        ankamaId: raw?.ankama_id ?? 0,
        name: raw?.name ?? "Inconnu",
        level: raw?.level ?? 0,
        type: raw?.type?.name ?? "Item",
        iconUrl: normalizeIconUrl(raw?.image_urls?.icon),
    })).filter((item) => item.ankamaId > 0);
}

export async function searchDofusItems(
    query: string,
    category: DofusItemCategory = "all",
    limit: number = 10
): Promise<DofusItem[]> {
    if (!query || query.trim().length < 2) return [];

    const cacheKey = `${category}:${query.trim().toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const endpoints = CATEGORY_ENDPOINTS[category] ?? CATEGORY_ENDPOINTS.all;

    const results: DofusItem[] = [];
    const seen = new Set<number>();

    await Promise.all(
        endpoints.map(async (endpoint) => {
            try {
                const url = `${DOFUSDUDE_BASE}${endpoint}?query=${encodeURIComponent(query.trim())}&limit=${limit}`;
                const res = await fetch(url, {
                    signal: AbortSignal.timeout(8_000),
                    headers: { Accept: "application/json" },
                    next: { revalidate: 300 }, // Next.js cache 5min
                });

                if (!res.ok) return;

                const json = await res.json() as DofusdudeSingleItemResponse;
                const items = parseItems(json);

                for (const item of items) {
                    if (!seen.has(item.ankamaId)) {
                        seen.add(item.ankamaId);
                        results.push(item);
                    }
                }
            } catch {
                // Silently fail per endpoint — partial results are better than error
            }
        })
    );

    // Sort by level asc, deduplicated
    results.sort((a, b) => a.level - b.level);

    setCache(cacheKey, results);
    return results;
}

// ---------------------------------------------------------------------------
// QUEST SEARCH — api.dofusdb.fr
// ---------------------------------------------------------------------------

const DOFUSDB_BASE = "https://api.dofusdb.fr";

interface DofusDBQuestRaw {
    id?: number;
    name?: { fr?: string };
    levelMin?: number;
    levelMax?: number;
    isDungeonQuest?: boolean;
    slug?: { fr?: string };
}

const _questCache = new Map<string, { data: DofusQuest[]; expiresAt: number }>();

export async function searchDofusQuests(query: string, limit = 15): Promise<DofusQuest[]> {
    if (!query || query.trim().length < 2) return [];

    const cacheKey = `quests:${query.trim().toLowerCase()}`;
    const cached = _questCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    try {
        const encoded = encodeURIComponent(query.trim());
        // DofusDB supports searching on the "name.fr" field with regex
        const url = `${DOFUSDB_BASE}/quests?lang=fr&name.fr[$regex]=${encoded}&name.fr[$options]=i&$limit=${limit}&$select[]=id&$select[]=name&$select[]=levelMin&$select[]=levelMax&$select[]=isDungeonQuest&$select[]=slug`;
        const res = await fetch(url, {
            signal: AbortSignal.timeout(8_000),
            headers: { Accept: "application/json" },
            next: { revalidate: 300 },
        });
        if (!res.ok) return [];

        const json = await res.json() as { data?: DofusDBQuestRaw[] };
        const data: DofusQuest[] = (json.data ?? []).map((q) => ({
            id: q.id ?? 0,
            name: q.name?.fr ?? "Inconnue",
            levelMin: q.levelMin ?? null,
            levelMax: q.levelMax ?? null,
            isDungeonQuest: q.isDungeonQuest ?? false,
            dofusdbUrl: q.slug?.fr
                ? `https://www.dofusdb.fr/fr/database/quests/${q.id}-${q.slug.fr.replace(/\s+/g, "-")}`
                : `https://www.dofusdb.fr/fr/database/quests/${q.id}`,
        })).filter((q) => q.id > 0);

        _questCache.set(cacheKey, { data, expiresAt: Date.now() + TTL_MS });
        return data;
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// JOBS / MÉTIERS — local assets from /assets/dofus/jobs/ (from dofus-assets.ts)
// ---------------------------------------------------------------------------

// Using the same canonical local assets as the profile artisanat module.
export { getJob } from "@/lib/dofus-assets";

export const DOFUS_JOBS: DofusJob[] = (Object.values(_DOFUS_JOBS_SRC) as ReadonlyArray<ReadonlyArray<{ id: string; name: string; icon: string }>>)
    .flatMap((category, catIdx) => category.map((j, i) => ({ id: catIdx * 100 + i + 1, name: j.name, iconUrl: j.icon })));

