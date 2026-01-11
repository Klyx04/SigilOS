// =============================================================================
// METAMOB API CLIENT - Proxy & Cache for Archimonstre Module
// =============================================================================

import { z } from "zod";

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const METAMOB_API_BASE = "https://api.metamob.fr";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure
const API_KEY = process.env.METAMOB_API_KEY; // REQUIRED - L'API Metamob exige une clé

// Vérifie que la clé API est configurée
function checkApiKey(): boolean {
    if (!API_KEY) {
        console.error("[Metamob] METAMOB_API_KEY is not configured. API calls will fail with 401.");
        return false;
    }
    return true;
}

// -----------------------------------------------------------------------------
// TYPES & SCHEMAS
// -----------------------------------------------------------------------------

// Raw response from Metamob API
const MetamobUserSchema = z.object({
    pseudo: z.string(),
    contact: z.string().optional().nullable(),
    presentation: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    image_url: z.string().optional().nullable(),
    etape: z.union([z.string(), z.number()]).optional().nullable(), // API returns number
    serveur: z.string().optional().nullable(),
    derniere_connexion: z.string().optional().nullable(),
    lien: z.string().optional().nullable(),
});

const MetamobMonsterRawSchema = z.object({
    id: z.number(),
    nom: z.string(),
    slug: z.string().optional(),
    type: z.string(),
    image_url: z.string().optional().nullable(),
    etape: z.union([z.string(), z.number()]).optional().nullable(), // API returns number
    zone: z.string().optional().nullable(),
    souszone: z.string().optional().nullable(),
    quantite: z.number(),
    recherche: z.number().optional(),
    propose: z.number().optional(),
    nom_normal: z.string().optional().nullable(),
});

export type MetamobUserRaw = z.infer<typeof MetamobUserSchema>;
export type MetamobMonsterRaw = z.infer<typeof MetamobMonsterRawSchema>;

// Normalized monster for internal use
export type MonsterState = "MANQUANT" | "POSSEDE" | "DOUBLON";

export interface MetamobMonster {
    id: number;
    nom: string;
    slug: string;
    type: string;
    imageUrl: string;
    zone: string;
    souszone: string;
    quantite: number;
    etat: MonsterState;
    recherche: boolean;
    propose: boolean;
}

export interface MetamobUserInfo {
    pseudo: string;
    serveur: string | null;
    etape: string | null;
    avatar: string | null;
    derniereConnexion: string | null;
}

// -----------------------------------------------------------------------------
// CACHE SYSTEM (In-Memory with TTL)
// -----------------------------------------------------------------------------

interface CachedData<T> {
    data: T;
    fetchedAt: number;
}

// Cache stores: pseudo -> cached data
const userCache = new Map<string, CachedData<MetamobUserInfo>>();
const monstersCache = new Map<string, CachedData<MetamobMonster[]>>();

function isCacheValid<T>(cached: CachedData<T> | undefined): cached is CachedData<T> {
    if (!cached) return false;
    return Date.now() - cached.fetchedAt < CACHE_TTL_MS;
}

export function clearMonsterCache(pseudo?: string): void {
    if (pseudo) {
        monstersCache.delete(pseudo.toLowerCase());
        userCache.delete(pseudo.toLowerCase());
    } else {
        monstersCache.clear();
        userCache.clear();
    }
}

export function getCacheStats(): { users: number; monsters: number } {
    return {
        users: userCache.size,
        monsters: monstersCache.size,
    };
}

// -----------------------------------------------------------------------------
// API HELPERS
// -----------------------------------------------------------------------------

/**
 * Internal fetch wrapper with per-guild API key support.
 * @param endpoint API endpoint (e.g., /utilisateurs/pseudo)
 * @param guildApiKey Optional per-guild API key (falls back to global METAMOB_API_KEY)
 */
async function fetchMetamob<T>(endpoint: string, guildApiKey?: string | null): Promise<T | null> {
    // Determine which key to use: guild-specific or global fallback
    const apiKey = guildApiKey || API_KEY;

    if (!apiKey) {
        console.error("[Metamob] No API key available (neither guild-specific nor global).");
        throw new Error("API_KEY_MISSING");
    }

    try {
        const headers: HeadersInit = {
            "Accept": "application/json",
            "HTTP-X-APIKEY": apiKey,
        };

        const response = await fetch(`${METAMOB_API_BASE}${endpoint}`, {
            method: "GET",
            headers,
            next: { revalidate: 0 }, // No Next.js cache, we handle our own
        });

        if (response.status === 404) {
            return null; // User not found or profile private
        }

        if (response.status === 401) {
            console.error("[Metamob] API key is invalid or expired. Got 401 Unauthorized.");
            throw new Error("API_KEY_INVALID");
        }

        if (response.status === 429) {
            console.warn("[Metamob] Rate limit hit. Retry after:", response.headers.get("Retry-After"));
            throw new Error("RATE_LIMIT");
        }

        if (!response.ok) {
            console.error(`[Metamob] API error ${response.status}:`, await response.text());
            throw new Error(`API_ERROR_${response.status}`);
        }

        return await response.json() as T;
    } catch (error) {
        if (error instanceof Error &&
            (error.message === "RATE_LIMIT" ||
                error.message === "API_KEY_MISSING" ||
                error.message === "API_KEY_INVALID")) {
            throw error;
        }
        console.error("[Metamob] Fetch error:", error);
        throw new Error("NETWORK_ERROR");
    }
}

// -----------------------------------------------------------------------------
// NORMALIZATION
// -----------------------------------------------------------------------------

function normalizeMonster(raw: MetamobMonsterRaw): MetamobMonster {
    const quantite = raw.quantite;
    let etat: MonsterState = "MANQUANT";
    if (quantite > 1) etat = "DOUBLON";
    else if (quantite === 1) etat = "POSSEDE";

    return {
        id: raw.id,
        nom: decodeHtmlEntities(raw.nom),
        slug: raw.slug || raw.nom.toLowerCase().replace(/\s+/g, "-"),
        type: raw.type,
        imageUrl: raw.image_url || "",
        zone: decodeHtmlEntities(raw.zone || "Inconnue"),
        souszone: decodeHtmlEntities(raw.souszone || ""),
        quantite,
        etat,
        recherche: raw.recherche === 1,
        propose: raw.propose === 1,
    };
}

function normalizeUser(raw: MetamobUserRaw): MetamobUserInfo {
    return {
        pseudo: raw.pseudo,
        serveur: raw.serveur || null,
        etape: raw.etape != null ? String(raw.etape) : null, // API can return number
        avatar: raw.image_url || raw.image || null,
        derniereConnexion: raw.derniere_connexion || null,
    };
}

// Decode HTML entities from external API data
function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
}

// -----------------------------------------------------------------------------
// PUBLIC API
// -----------------------------------------------------------------------------

/**
 * Verify if a Metamob user exists and their profile is public.
 * Returns user info if found, null if not found or private.
 */
export async function verifyMetamobUser(pseudo: string): Promise<MetamobUserInfo | null> {
    // Validate pseudo format (alphanum + underscore + hyphen, 2-30 chars)
    const pseudoRegex = /^[a-zA-Z0-9_-]{2,30}$/;
    if (!pseudoRegex.test(pseudo)) {
        return null;
    }

    const cacheKey = pseudo.toLowerCase();
    const cached = userCache.get(cacheKey);

    if (isCacheValid(cached)) {
        return cached.data;
    }

    const raw = await fetchMetamob<MetamobUserRaw>(`/utilisateurs/${encodeURIComponent(pseudo)}`);

    if (!raw) {
        return null;
    }

    const parsed = MetamobUserSchema.safeParse(raw);
    if (!parsed.success) {
        console.error("[Metamob] Invalid user response:", parsed.error);
        return null;
    }

    const normalized = normalizeUser(parsed.data);
    userCache.set(cacheKey, { data: normalized, fetchedAt: Date.now() });

    return normalized;
}

/**
 * Get monsters for a specific Metamob user.
 * Returns cached data if available and valid.
 */
export async function getUserMonsters(pseudo: string): Promise<MetamobMonster[]> {
    const pseudoRegex = /^[a-zA-Z0-9_-]{2,30}$/;
    if (!pseudoRegex.test(pseudo)) {
        return [];
    }

    const cacheKey = pseudo.toLowerCase();
    const cached = monstersCache.get(cacheKey);

    if (isCacheValid(cached)) {
        return cached.data;
    }

    const raw = await fetchMetamob<MetamobMonsterRaw[]>(
        `/utilisateurs/${encodeURIComponent(pseudo)}/monstres?type=archimonstre`
    );

    if (!raw || !Array.isArray(raw)) {
        return [];
    }

    const monsters = raw
        .map(m => {
            const parsed = MetamobMonsterRawSchema.safeParse(m);
            return parsed.success ? normalizeMonster(parsed.data) : null;
        })
        .filter((m): m is MetamobMonster => m !== null);

    monstersCache.set(cacheKey, { data: monsters, fetchedAt: Date.now() });

    return monsters;
}

/**
 * Get monsters filtered by state.
 */
export async function getUserMonstersByState(
    pseudo: string,
    state: MonsterState
): Promise<MetamobMonster[]> {
    const monsters = await getUserMonsters(pseudo);
    return monsters.filter(m => m.etat === state);
}

/**
 * Get all archimonstres from the reference list.
 * This is the complete list without user-specific quantities.
 */
export async function getAllArchimonstres(): Promise<MetamobMonster[]> {
    const cacheKey = "__ALL_ARCHIMONSTRES__";
    const cached = monstersCache.get(cacheKey);

    if (isCacheValid(cached)) {
        return cached.data;
    }

    const raw = await fetchMetamob<MetamobMonsterRaw[]>("/monstres?type=archimonstre");

    if (!raw || !Array.isArray(raw)) {
        return [];
    }

    const monsters = raw
        .map(m => {
            const parsed = MetamobMonsterRawSchema.safeParse(m);
            if (!parsed.success) return null;
            // For reference list, set quantity to 0 and state to MANQUANT
            return {
                ...normalizeMonster({ ...parsed.data, quantite: 0 }),
                quantite: 0,
                etat: "MANQUANT" as MonsterState,
            };
        })
        .filter((m): m is MetamobMonster => m !== null);

    monstersCache.set(cacheKey, { data: monsters, fetchedAt: Date.now() });

    return monsters;
}

/**
 * Find which guild members have a specific monster as doublon (available for trade).
 */
export interface MonsterOwner {
    metamobPseudo: string;
    profileId: string;
    displayName: string;
    quantite: number;
}

export async function findMonsterOwners(
    monsterId: number,
    memberPseudos: { metamobPseudo: string; profileId: string; displayName: string }[]
): Promise<MonsterOwner[]> {
    const owners: MonsterOwner[] = [];

    // Batch fetch for all members (uses cache)
    for (const member of memberPseudos) {
        try {
            const monsters = await getUserMonsters(member.metamobPseudo);
            const monster = monsters.find(m => m.id === monsterId);

            if (monster && monster.quantite > 1) {
                owners.push({
                    metamobPseudo: member.metamobPseudo,
                    profileId: member.profileId,
                    displayName: member.displayName,
                    quantite: monster.quantite,
                });
            }
        } catch {
            // Skip members with fetch errors
            continue;
        }
    }

    return owners.sort((a, b) => b.quantite - a.quantite);
}
