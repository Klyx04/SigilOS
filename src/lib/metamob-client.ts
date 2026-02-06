// =============================================================================
// METAMOB API CLIENT V2 - SigilOS Unified Module
// =============================================================================
// Migration from api.metamob.fr to www.metamob.fr/api/v1
// Auth: Bearer token instead of HTTP-X-APIKEY
// New features: Native matching, zones, quest templates, Kralamoure events

import { z } from "zod";

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const METAMOB_API_BASE = "https://www.metamob.fr/api";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// -----------------------------------------------------------------------------
// ZOD SCHEMAS - API V2 Response Formats
// -----------------------------------------------------------------------------

const LocalizedNameSchema = z.object({
    fr: z.string(),
    en: z.string(),
    es: z.string(),
});

const PaginationSchema = z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
});

const GameVersionSchema = z.object({
    id: z.number(),
    name: z.string(),
});

const ServerSchema = z.object({
    id: z.number(),
    name: z.string(),
    community: z.string(),
    game_version: GameVersionSchema,
});

const AvatarSchema = z.object({
    id: z.number(),
    name: LocalizedNameSchema,
    image: z.string(),
});

const MonsterTypeSchema = z.object({
    id: z.number(),
    name: LocalizedNameSchema,
});

const MonsterSchema = z.object({
    id: z.number(),
    name: LocalizedNameSchema,
    image: z.string(),
    level_min: z.number(),
    level_max: z.number(),
    type: MonsterTypeSchema,
    reference: z.object({
        id: z.number(),
        name: LocalizedNameSchema,
    }).optional(),
    zones: z.array(z.object({
        id: z.number(),
        name: LocalizedNameSchema,
        subzones: z.array(z.object({
            id: z.number(),
            name: LocalizedNameSchema,
        })),
    })).optional(),
});

const QuestTemplateSchema = z.object({
    id: z.number(),
    monster_count: z.number(),
    step_count: z.number(),
    game_version: GameVersionSchema.optional(),
});

const UserQuestSchema = z.object({
    slug: z.string(),
    character_name: z.string(),
    current_step: z.number(),
    parallel_quests: z.number(),
    wanted_count: z.number().optional(),
    offered_count: z.number().optional(),
    server: ServerSchema,
    quest_template: QuestTemplateSchema,
});

const UserProfileSchema = z.object({
    username: z.string(),
    bio: z.string().nullable().optional(),
    avatar: AvatarSchema.nullable().optional(),
    created_at: z.string().optional(),
    last_active: z.string().optional(),
    quests: z.array(UserQuestSchema).optional(),
});

const QuestMonsterSchema = z.object({
    id: z.number(),
    name: LocalizedNameSchema,
    image: z.string(),
    level_min: z.number(),
    level_max: z.number(),
    type: MonsterTypeSchema,
    step: z.number().optional(),
    owned: z.number().optional(),
    status: z.number().optional(),
    want: z.number().optional(),
    offer: z.number().optional(),
});

const QuestDetailsSchema = z.object({
    slug: z.string(),
    character_name: z.string(),
    current_step: z.number(),
    parallel_quests: z.number(),
    server: ServerSchema,
    quest_template: QuestTemplateSchema,
    monsters: z.array(QuestMonsterSchema),
    pagination: PaginationSchema,
});

const MatchMonsterSchema = z.object({
    id: z.number(),
    name: LocalizedNameSchema,
    available: z.number(),
    needed: z.number(),
    covers_need: z.boolean(),
});

const MatchPartnerSchema = z.object({
    user: z.object({
        username: z.string(),
        avatar: AvatarSchema.nullable().optional(),
        last_active: z.string().optional(),
    }),
    quest: z.object({
        slug: z.string(),
        character_name: z.string(),
        parallel_quests: z.number(),
    }),
    matches: z.object({
        they_have_you_want: z.array(MatchMonsterSchema),
        you_have_they_want: z.array(MatchMonsterSchema),
    }),
    match_score: z.number(),
});

const ZoneSchema = z.object({
    id: z.number(),
    name: LocalizedNameSchema,
    subzones: z.array(z.object({
        id: z.number(),
        name: LocalizedNameSchema,
    })).optional(),
});

const KralamoureEventSchema = z.object({
    id: z.number(),
    event_datetime: z.string(),
    description: z.string().nullable().optional(),
    creator: z.string(),
    participants_count: z.number(),
    character_count: z.number(),
    messages_count: z.number(),
    server: ServerSchema,
});

// -----------------------------------------------------------------------------
// EXPORTED TYPES
// -----------------------------------------------------------------------------

export type LocalizedName = z.infer<typeof LocalizedNameSchema>;
export type GameVersion = z.infer<typeof GameVersionSchema>;
export type Server = z.infer<typeof ServerSchema>;
export type Monster = z.infer<typeof MonsterSchema>;
export type MonsterType = z.infer<typeof MonsterTypeSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserQuest = z.infer<typeof UserQuestSchema>;
export type QuestDetails = z.infer<typeof QuestDetailsSchema>;
export type QuestMonster = z.infer<typeof QuestMonsterSchema>;
export type MatchPartner = z.infer<typeof MatchPartnerSchema>;
export type MatchMonster = z.infer<typeof MatchMonsterSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type KralamoureEvent = z.infer<typeof KralamoureEventSchema>;
export type MonsterState = "MANQUANT" | "POSSEDE" | "DOUBLON";

/** Legacy Compatibility Types */
export interface MetamobMonster extends OcreMonster {
    nom: string;
    slug: string;
    etat: MonsterState;
    quantite: number;
    imageUrl: string;
    souszone: string;
    recherche: boolean;
    propose: boolean;
}

export interface MonsterOwner {
    metamobPseudo: string;
    profileId: string;
    displayName: string;
    quantite: number;
}

export interface OcreMonster {
    id: number;
    name: string;
    nameFr: string;
    nameEn: string;
    image: string;
    levelMin: number;
    levelMax: number;
    type: "monstre" | "boss" | "archimonstre";
    typeId: number;
    step: number;
    owned: number;
    status: number;
    state: MonsterState;
    zone?: string;
    subzone?: string;
}

// -----------------------------------------------------------------------------
// CACHE SYSTEM
// -----------------------------------------------------------------------------

interface CachedData<T> {
    data: T;
    fetchedAt: number;
}

const cache = new Map<string, CachedData<unknown>>();

function isCacheValid<T>(key: string): CachedData<T> | null {
    const cached = cache.get(key) as CachedData<T> | undefined;
    if (!cached) return null;
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return cached;
}

function setCache<T>(key: string, data: T): void {
    cache.set(key, { data, fetchedAt: Date.now() });
}

export function clearCache(pattern?: string): void {
    if (pattern) {
        const lowerPattern = pattern.toLowerCase();
        for (const key of cache.keys()) {
            if (key.toLowerCase().includes(lowerPattern)) {
                cache.delete(key);
            }
        }
    } else {
        cache.clear();
    }
}

/** Legacy alias */
export function clearMonsterCache(pseudo: string): void {
    clearCache(pseudo);
}

// -----------------------------------------------------------------------------
// API FETCH HELPERS
// -----------------------------------------------------------------------------

export interface FetchOptions {
    guildApiKey?: string | null;
    skipCache?: boolean;
}

export class MetamobApiError extends Error {
    public readonly code: string;
    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

async function fetchApi<T>(
    endpoint: string,
    schema: z.ZodSchema<T>,
    options: FetchOptions = {}
): Promise<T> {
    const apiKey = options.guildApiKey || process.env.METAMOB_API_KEY;

    if (!apiKey) throw new MetamobApiError("API_KEY_MISSING", "Clé API Metamob non configurée");

    const cacheKey = `metamob:${endpoint}`;
    if (!options.skipCache) {
        const cached = isCacheValid<T>(cacheKey);
        if (cached) return cached.data;
    }

    try {
        const response = await fetch(`${METAMOB_API_BASE}${endpoint}`, {
            headers: { "Accept": "application/json", "Authorization": `Bearer ${apiKey}` },
            next: { revalidate: 0 },
        });

        if (response.status === 404) throw new MetamobApiError("NOT_FOUND", "Ressource introuvable");
        if (response.status === 401) throw new MetamobApiError("API_KEY_INVALID", "Clé API invalide");
        if (!response.ok) throw new MetamobApiError("API_ERROR", `Erreur ${response.status}`);

        const json = await response.json();
        const data = json.data !== undefined ? json.data : json;
        const parsed = schema.parse(data);

        setCache(cacheKey, parsed);
        return parsed;
    } catch (error) {
        if (error instanceof MetamobApiError) throw error;
        if (error instanceof z.ZodError) {
            console.error("[Metamob] Schema validation failed:", error.errors);
            throw new MetamobApiError("API_ERROR", "Format de réponse API invalide");
        }
        throw error;
    }
}

async function fetchPaginatedApi<T>(
    endpoint: string,
    itemSchema: z.ZodSchema<T>,
    options: FetchOptions & { limit?: number; offset?: number } = {}
): Promise<{ data: T[]; pagination: z.infer<typeof PaginationSchema> }> {
    const apiKey = options.guildApiKey || process.env.METAMOB_API_KEY;
    if (!apiKey) throw new MetamobApiError("API_KEY_MISSING", "Clé API Metamob non configurée");

    const params = new URLSearchParams();
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.offset) params.set("offset", options.offset.toString());

    const fullEndpoint = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${params}`;
    const cacheKey = `metamob:${fullEndpoint}`;

    if (!options.skipCache) {
        const cached = isCacheValid<{ data: T[]; pagination: z.infer<typeof PaginationSchema> }>(cacheKey);
        if (cached) return cached.data;
    }

    const response = await fetch(`${METAMOB_API_BASE}${fullEndpoint}`, {
        headers: { "Accept": "application/json", "Authorization": `Bearer ${apiKey}` },
        next: { revalidate: 0 },
    });

    if (!response.ok) throw new MetamobApiError("API_ERROR", `Erreur ${response.status}`);

    const json = await response.json();
    const items = z.array(itemSchema).parse(json.data || []);
    const pagination = PaginationSchema.parse(json.pagination || { total: items.length, limit: 50, offset: 0 });

    const result = { data: items, pagination };
    setCache(cacheKey, result);
    return result;
}

// -----------------------------------------------------------------------------
// UNIFIED PUBLIC API
// -----------------------------------------------------------------------------

export async function getUserProfile(username: string, options?: FetchOptions): Promise<UserProfile> {
    return fetchApi(`/v1/users/${encodeURIComponent(username)}`, UserProfileSchema, options);
}

export async function getUserQuests(username: string, options?: FetchOptions): Promise<UserQuest[]> {
    const result = await fetchPaginatedApi(`/v1/users/${encodeURIComponent(username)}/quests`, UserQuestSchema, options);
    return result.data;
}

export async function getQuestDetails(
    username: string,
    slug: string,
    options?: FetchOptions & { limit?: number; offset?: number; status?: string; step?: number }
): Promise<QuestDetails> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());
    if (options?.status) params.set("status", options.status);
    if (options?.step) params.set("step", options.step.toString());
    const qs = params.toString();
    return fetchApi(`/v1/users/${encodeURIComponent(username)}/quests/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`, QuestDetailsSchema, options);
}

export async function getPrivateQuestDetails(username: string, slug: string, options?: FetchOptions & { limit?: number; offset?: number; status?: string; step?: number }): Promise<QuestDetails> {
    return getQuestDetails(username, slug, options);
}

export async function getQuestMatches(
    slug: string,
    options?: FetchOptions & { direction?: string; activeWithinDays?: number; limit?: number; offset?: number }
): Promise<{ matches: MatchPartner[]; pagination: z.infer<typeof PaginationSchema> }> {
    const params = new URLSearchParams();
    if (options?.direction) params.set("direction", options.direction);
    if (options?.activeWithinDays) params.set("active_within_days", options.activeWithinDays.toString());
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());
    const qs = params.toString();
    const result = await fetchPaginatedApi(`/v1/quests/${encodeURIComponent(slug)}/matches${qs ? `?${qs}` : ""}`, MatchPartnerSchema, options);
    return { matches: result.data, pagination: result.pagination };
}

export async function getMonsters(options?: FetchOptions & { q?: string; type?: number; limit?: number; offset?: number }): Promise<{ monsters: Monster[]; pagination: z.infer<typeof PaginationSchema> }> {
    const params = new URLSearchParams();
    if (options?.q) params.set("q", options.q);
    if (options?.type) params.set("type", options.type.toString());
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());
    const qs = params.toString();
    const result = await fetchPaginatedApi(`/v1/monsters${qs ? `?${qs}` : ""}`, MonsterSchema, options);
    return { monsters: result.data, pagination: result.pagination };
}

export async function getMonster(monsterId: number, options?: FetchOptions): Promise<Monster> {
    return fetchApi(`/v1/monsters/${monsterId}`, MonsterSchema, options);
}

export async function getZones(options?: FetchOptions & { q?: string }): Promise<Zone[]> {
    const params = new URLSearchParams();
    if (options?.q) params.set("q", options.q);
    const qs = params.toString();
    const result = await fetchPaginatedApi(`/v1/zones${qs ? `?${qs}` : ""}`, ZoneSchema, options);
    return result.data;
}

export async function getZone(zoneId: number, options?: FetchOptions): Promise<Zone> {
    return fetchApi(`/v1/zones/${zoneId}`, ZoneSchema, options);
}

export async function getSubzoneMonsters(zoneId: number, subzoneId: number, options?: FetchOptions): Promise<Monster[]> {
    const result = await fetchPaginatedApi(`/v1/zones/${zoneId}/subzones/${subzoneId}/monsters`, MonsterSchema, options);
    return result.data;
}

export async function getKralamoureEvents(options?: FetchOptions & { serverId?: number; from?: string }): Promise<KralamoureEvent[]> {
    const params = new URLSearchParams();
    if (options?.serverId) params.set("server", options.serverId.toString());
    if (options?.from) params.set("from", options.from);
    const qs = params.toString();
    const result = await fetchPaginatedApi(`/v1/kralove${qs ? `?${qs}` : ""}`, KralamoureEventSchema, options);
    return result.data;
}

export async function getServers(options?: FetchOptions): Promise<Server[]> {
    const result = await fetchPaginatedApi(`/v1/servers`, ServerSchema, options);
    return result.data;
}

export async function getGameVersions(options?: FetchOptions): Promise<GameVersion[]> {
    const result = await fetchPaginatedApi(`/v1/game-versions`, GameVersionSchema, options);
    return result.data;
}

/** Legacy Compatibility: getUserMonsters */
export async function getUserMonsters(username: string, options?: FetchOptions): Promise<MetamobMonster[]> {
    const profile = await getUserProfile(username, options);
    if (!profile.quests || profile.quests.length === 0) return [];

    // Find first Ocre-like quest or use the first one
    const quest = profile.quests[0];
    const details = await getQuestDetails(username, quest.slug, { ...options, limit: 500 });

    return details.monsters.map(m => {
        const normalized = normalizeQuestMonster(m, details.parallel_quests);
        return {
            ...normalized,
            nom: normalized.nameFr,
            slug: normalized.nameFr.toLowerCase().replace(/\s+/g, "-"),
            etat: normalized.state,
            quantite: normalized.owned,
            imageUrl: normalized.image,
            souszone: "",
            recherche: normalized.state === "MANQUANT",
            propose: normalized.state === "DOUBLON",
        };
    });
}

/** Legacy Compatibility: findMonsterOwners */
export async function findMonsterOwners(
    monsterId: number,
    memberPseudos: { metamobPseudo: string; profileId: string; displayName: string }[]
): Promise<MonsterOwner[]> {
    const owners: MonsterOwner[] = [];
    for (const member of memberPseudos) {
        try {
            const monsters = await getUserMonsters(member.metamobPseudo);
            const m = monsters.find(x => x.id === monsterId);
            if (m && m.quantite > 1) {
                owners.push({ ...member, quantite: m.quantite });
            }
        } catch { continue; }
    }
    return owners.sort((a, b) => b.quantite - a.quantite);
}

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

export function computeMonsterState(owned: number, parallelQuests: number = 1): MonsterState {
    const pq = Math.max(1, parallelQuests);
    if (owned <= 0) return "MANQUANT";
    if (owned > pq) return "DOUBLON";
    return "POSSEDE";
}

export function getMonsterTypeName(typeId: number): "monstre" | "boss" | "archimonstre" {
    if (typeId === 1) return "monstre";
    if (typeId === 2) return "boss";
    if (typeId === 3) return "archimonstre";
    return "monstre";
}

export function normalizeQuestMonster(monster: QuestMonster, parallelQuests: number = 1): OcreMonster {
    const pq = Math.max(1, parallelQuests);
    let owned = 0;

    if (monster.owned !== undefined) {
        owned = monster.owned;
    } else if (monster.want !== undefined || monster.offer !== undefined) {
        const want = monster.want ?? 0;
        const offer = monster.offer ?? 0;
        // Logic: if I need 1 (parallelQuests) and I want 0, I have 1. Plus extras (offer).
        owned = Math.max(0, pq - want) + offer;
    }

    return {
        id: monster.id,
        name: monster.name.fr,
        nameFr: monster.name.fr,
        nameEn: monster.name.en,
        image: monster.image ? `https://www.metamob.fr/img/monsters/${monster.image}` : "",
        levelMin: monster.level_min,
        levelMax: monster.level_max,
        type: getMonsterTypeName(monster.type.id),
        typeId: monster.type.id,
        step: monster.step ?? 1,
        owned,
        status: monster.status ?? 0,
        state: computeMonsterState(owned, pq),
    };
}

export async function verifyMetamobUser(username: string, options?: FetchOptions): Promise<any> {
    try {
        const profile = await getUserProfile(username, options);
        return { pseudo: profile.username, serveur: profile.quests?.[0]?.server.name || null };
    } catch { return null; }
}
