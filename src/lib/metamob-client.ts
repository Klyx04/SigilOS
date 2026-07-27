// =============================================================================
// METAMOB API CLIENT V2 - SigilOS Unified Module
// =============================================================================
// Migration from api.metamob.fr to www.metamob.fr/api/v1
// Auth: Bearer token instead of HTTP-X-APIKEY
// New features: Native matching, zones, quest templates, Kralamoure events

import { z } from "zod";
import { redis } from "./redis";

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const METAMOB_API_BASE = "https://www.metamob.fr/api";
const CACHE_TTL = 86400; // 24 hours fallback cache

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

const QuestMonsterSchema = z.object({
    id: z.coerce.number(),
    monster_id: z.coerce.number().optional(),
    name: LocalizedNameSchema,
    image: z.string().optional().nullable(),
    level_min: z.coerce.number().optional().nullable(),
    level_max: z.coerce.number().optional().nullable(),
    type: MonsterTypeSchema.optional().nullable(),
    step: z.coerce.number().optional().nullable(),
    owned: z.coerce.number().optional().nullable(),
    amount: z.coerce.number().optional().nullable(),
    quantity: z.coerce.number().optional().nullable(),
    quantite: z.coerce.number().optional().nullable(),
    status: z.coerce.number().optional().nullable(),
    want: z.coerce.number().optional().nullable(),
    offer: z.coerce.number().optional().nullable(),
    reference: z.object({
        id: z.number(),
        name: LocalizedNameSchema,
    }).optional(),
    monster: z.object({
        id: z.coerce.number(),
        owned: z.coerce.number().optional().nullable(),
        quantity: z.coerce.number().optional().nullable(),
        quantite: z.coerce.number().optional().nullable(),
        amount: z.coerce.number().optional().nullable(),
    }).optional(),
    // Zone data — present on quest template monsters, stripped without this field
    zones: z.array(z.object({
        id: z.number(),
        name: LocalizedNameSchema,
        subzones: z.array(z.object({
            id: z.number(),
            name: LocalizedNameSchema,
        })).optional(),
    })).optional(),
});

const QuestTemplateSchema = z.object({
    id: z.number(),
    monster_count: z.number().optional(),
    step_count: z.number().optional(),
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

const QuestTemplateDetailsSchema = QuestTemplateSchema.extend({
    monsters: z.array(QuestMonsterSchema),
    pagination: PaginationSchema,
});

const UserProfileSchema = z.object({
    username: z.string(),
    bio: z.string().nullable().optional(),
    avatar: AvatarSchema.nullable().optional(),
    created_at: z.string().optional(),
    last_active: z.string().optional(),
    quests: z.array(UserQuestSchema).optional(),
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
    // Expert Settings
    trade_mode: z.number().optional(),
    trade_offer_threshold: z.number().nullable().optional(),
    trade_want_threshold: z.number().nullable().optional(),
    show_trades: z.boolean().optional(),
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
        monsters: z.array(z.any()).optional(),
    })).optional(),
});

const KralamoureEventSchema = z.object({
    id: z.number(),
    event_datetime: z.string(),
    description: z.string().nullable().optional(),
    creator: z.string(),
    participants_count: z.number().optional(),
    character_count: z.number().optional(),
    messages_count: z.number().optional(),
    server: ServerSchema,
});

const KralamoureParticipantSchema = z.object({
    username: z.string(),
    character_count: z.number(),
});

const KralamoureEventDetailsSchema = KralamoureEventSchema.extend({
    participants: z.array(KralamoureParticipantSchema).optional(),
    messages: z.array(z.object({
        username: z.string(),
        content: z.string(),
        created_at: z.string(),
    })).optional(),
});

const QuestSettingsSchema = z.object({
    character_name: z.string().max(200).optional(),
    parallel_quests: z.number().min(1).max(20).optional(),
    current_step: z.number().min(1).max(34).optional(),
    show_trades: z.boolean().optional(),
    trade_mode: z.number().min(0).max(1).optional(),
    trade_offer_threshold: z.number().min(0).max(30).nullable().optional(),
    trade_want_threshold: z.number().min(0).max(30).nullable().optional(),
    never_offer_normal: z.boolean().optional(),
    never_want_normal: z.boolean().optional(),
    never_offer_boss: z.boolean().optional(),
    never_want_boss: z.boolean().optional(),
    never_offer_arch: z.boolean().optional(),
    never_want_arch: z.boolean().optional(),
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
export type QuestTemplate = z.infer<typeof QuestTemplateSchema>;
export type QuestDetails = z.infer<typeof QuestDetailsSchema>;
export type QuestMonster = z.infer<typeof QuestMonsterSchema>;
export type MatchPartner = z.infer<typeof MatchPartnerSchema>;
export type MatchMonster = z.infer<typeof MatchMonsterSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type KralamoureEvent = z.infer<typeof KralamoureEventSchema>;
export type KralamoureEventDetails = z.infer<typeof KralamoureEventDetailsSchema>;
export type QuestSettings = z.infer<typeof QuestSettingsSchema>;
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
    trade_offer?: number | null;
    trade_want?: number | null;
}

// -----------------------------------------------------------------------------
// CACHE SYSTEM (Delegated to Next.js Data Cache)
// -----------------------------------------------------------------------------

export function clearCache(pattern?: string): void {
    // No-op: handled via revalidateTag in server actions
}

export function clearMonsterCache(pseudo: string): void {
    clearCache(pseudo);
}

// -----------------------------------------------------------------------------
// API FETCH HELPERS
// -----------------------------------------------------------------------------

export interface FetchOptions {
    guildApiKey?: string | null;
    skipCache?: boolean;
    tags?: string[];
    revalidate?: number;
    offset?: number;
    cacheFirst?: boolean; // If true, return from Redis immediately if available
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
    // STRATEGY: No dynamic fallback to process.env.METAMOB_API_KEY for user-specific calls.
    // This fixed the persistent 401 errors when the global key was invalid.
    const apiKey = options.guildApiKey;

    const headers: Record<string, string> = { "Accept": "application/json" };
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const isUserResource = endpoint.includes("/quests/") || endpoint.includes("/users/");
    const cacheKey = `metamob:cache:${endpoint}`;

    // 1. [PERF] Cache-First Strategy
    // For non-user resources (public), we prioritize speed.
    if (!isUserResource && options.cacheFirst !== false && options.revalidate !== 0) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            console.error("[Metamob] Cache-First lookup failed:", e);
        }
    }

    const fetchOptions: RequestInit = {
        headers,
        next: {
            revalidate: options.skipCache ? 0 : (options.revalidate ?? 3600),
            tags: options.tags
        }
    };

    try {
        const response = await fetch(`${METAMOB_API_BASE}${endpoint}`, {
            ...fetchOptions,
            signal: AbortSignal.timeout(3000), // REDUCED: 3s timeout to avoid blocking layout
        });

        // [Robustness] Handle 401/403 gracefully
        if (response.status === 401 || response.status === 403) {
            // ... (keep logic same)
            const isUserResource = endpoint.includes("/quests/") || endpoint.includes("/users/");

            if (apiKey) {
                if (isUserResource) {
                    throw new MetamobApiError("UNAUTHORIZED", "Accès refusé : Ce compte Metamob est privé ou la clé API est invalide.");
                }

                console.warn(`[Metamob] ${response.status} with key on global resource. Retrying without Authorization...`);
                const pHeaders = { ...headers };
                delete pHeaders["Authorization"];
                const publicOptions = { ...fetchOptions, headers: pHeaders, next: { ...fetchOptions.next, revalidate: 0 } };
                const retryResponse = await fetch(`${METAMOB_API_BASE}${endpoint}`, publicOptions);

                if (retryResponse.ok) {
                    const json = await retryResponse.json();
                    const data = json.data !== undefined ? json.data : json;
                    const parsed = schema.parse(data);
                    // Cache successful public result
                    if (!isUserResource) {
                        await redis.set(`metamob:cache:${endpoint}`, JSON.stringify(parsed), "EX", CACHE_TTL).catch(() => {});
                    }
                    return parsed;
                }

                if (retryResponse.status === 401 || retryResponse.status === 403) {
                    throw new MetamobApiError("UNAUTHORIZED", "Accès refusé : Une clé API valide est requise pour cette ressource.");
                }

                throw new MetamobApiError("INVALID_API_KEY", "Clé API Metamob invalide ou expirée.");
            } else {
                throw new MetamobApiError("UNAUTHORIZED", "Accès refusé : Authentification requise.");
            }
        }

        if (response.status === 404) throw new MetamobApiError("NOT_FOUND", "Ressource introuvable");
        if (!response.ok) throw new MetamobApiError("API_ERROR", `Erreur ${response.status} de l'API`);

        const json = await response.json();
        const data = json.data !== undefined ? json.data : json;
        const result = schema.parse(data);

        // Cache successful public result
        const isUserResource = endpoint.includes("/quests/") || endpoint.includes("/users/");
        if (!isUserResource) {
            await redis.set(`metamob:cache:${endpoint}`, JSON.stringify(result), "EX", CACHE_TTL).catch(() => {});
        }

        return result;
    } catch (error) {
        if (error instanceof MetamobApiError) throw error;
        
        // --- FALLBACK CACHE LOGIC ---
        const isUserResource = endpoint.includes("/quests/") || endpoint.includes("/users/");
        if (!isUserResource && options.revalidate !== 0) {
            try {
                const cached = await redis.get(`metamob:cache:${endpoint}`);
                if (cached) {
                    console.warn(`[Metamob] API Timeout/Error. Using Redis cache for ${endpoint}`);
                    return JSON.parse(cached);
                }
            } catch (cacheErr) {
                console.error("[Metamob] Redis fallback failed:", cacheErr);
            }
        }

        if (error instanceof z.ZodError) {
            console.error("[Metamob] Schema validation failed:", error.errors);
            throw new MetamobApiError("API_ERROR", "Format de réponse API invalide");
        }
        
        console.error("[Metamob] Network error:", error);
        
        // Final fallback: If not a user resource, return null instead of throwing to avoid blocking UI
        if (!isUserResource) {
            console.warn(`[Metamob] Silent fail for public resource: ${endpoint}`);
            return null as any;
        }
        
        throw new MetamobApiError("API_UNAVAILABLE", "Metamob.fr est temporairement indisponible.");
    }
}

async function fetchPaginatedApi<T>(
    endpoint: string,
    itemSchema: z.ZodSchema<T>,
    options: FetchOptions & { limit?: number; offset?: number } = {}
): Promise<{ data: T[]; pagination: z.infer<typeof PaginationSchema> }> {
    const apiKey = options.guildApiKey;
    const params = new URLSearchParams();

    // Official doc says limit max is 200
    const finalLimit = Math.min(options.limit || 50, 200);
    params.set("limit", finalLimit.toString());
    if (options.offset) params.set("offset", options.offset.toString());
    const fullEndpoint = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${params}`;

    const headers: Record<string, string> = { "Accept": "application/json" };
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const isUserResource = endpoint.includes("/quests/") || endpoint.includes("/users/");
    const cacheKey = `metamob:cache:${fullEndpoint}`;

    // 1. [PERF] Cache-First Strategy
    if (!isUserResource && options.cacheFirst !== false && options.revalidate !== 0) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (e) {
            console.error("[Metamob] Cache-First paginated lookup failed:", e);
        }
    }

    const fetchOptions: RequestInit = {
        headers,
        next: {
            revalidate: options.skipCache ? 0 : (options.revalidate ?? 3600),
            tags: options.tags
        }
    };

    try {
        const response = await fetch(`${METAMOB_API_BASE}${fullEndpoint}`, {
            ...fetchOptions,
            signal: AbortSignal.timeout(3000), // REDUCED: 3s timeout to avoid blocking layout
        });

        // [Robustness] 401/403 handling for paginated
        if ((response.status === 401 || response.status === 403) && apiKey) {
            const isUserResource = endpoint.includes("/quests/") || endpoint.includes("/users/");

            // If it's a user resource, DO NOT fallback to anonymous.
            if (!isUserResource) {
                console.warn(`[Metamob] ${response.status} with key on global resource. Retrying without Authorization...`);
                const pHeaders = { ...headers };
                delete pHeaders["Authorization"];
                const publicOptions = { ...fetchOptions, headers: pHeaders, next: { ...fetchOptions.next, revalidate: 0 } };
                const retryResponse = await fetch(`${METAMOB_API_BASE}${fullEndpoint}`, publicOptions);

                if (retryResponse.ok) {
                    const json = await retryResponse.json();
                    const items = z.array(itemSchema).parse(json.data || []);
                    const pagination = PaginationSchema.parse(json.pagination || { total: items.length, limit: 50, offset: 0 });
                    const result = { data: items, pagination };
                    await redis.set(`metamob:cache:${fullEndpoint}`, JSON.stringify(result), "EX", CACHE_TTL).catch(() => {});
                    return result;
                }
            }

            const message = isUserResource
                ? "Accès refusé : Ce compte Metamob est privé."
                : "Accès refusé : Clé API invalide ou accès restreint.";
            throw new MetamobApiError("UNAUTHORIZED", message);
        }

        if (!response.ok) {
            if (response.status === 404) throw new MetamobApiError("NOT_FOUND", "Ressource introuvable");
            if (response.status === 401 || response.status === 403) {
                const message = apiKey
                    ? "Accès refusé : Clé API invalide ou compte privé."
                    : "Accès refusé : Ce compte Metamob est privé.";
                throw new MetamobApiError("UNAUTHORIZED", message);
            }
            throw new MetamobApiError("API_ERROR", `Erreur ${response.status} de l'API`);
        }

        const json = await response.json();
        const items = z.array(itemSchema).parse(json.data || []);
        const pagination = PaginationSchema.parse(json.pagination || { total: items.length, limit: 50, offset: 0 });
        const result = { data: items, pagination };

        // Cache successful public result
        const isUserResource = endpoint.includes("/quests/") || endpoint.includes("/users/");
        if (!isUserResource) {
            await redis.set(`metamob:cache:${fullEndpoint}`, JSON.stringify(result), "EX", CACHE_TTL).catch(() => {});
        }

        return result;
    } catch (error) {
        if (error instanceof MetamobApiError) throw error;

        // --- FALLBACK CACHE LOGIC ---
        const isUserResource = endpoint.includes("/quests/") || endpoint.includes("/users/");
        if (!isUserResource && options.revalidate !== 0) {
            try {
                const cached = await redis.get(`metamob:cache:${fullEndpoint}`);
                if (cached) {
                    console.warn(`[Metamob] API Timeout/Error (paginated). Using Redis cache for ${fullEndpoint}`);
                    return JSON.parse(cached);
                }
            } catch (cacheErr) {
                console.error("[Metamob] Redis fallback failed (paginated):", cacheErr);
            }
        }

        console.error("[Metamob] Network error (paginated):", error);

        // Final fallback for public resources: Return empty items instead of throwing
        if (!isUserResource) {
            console.warn(`[Metamob] Silent fail for public paginated resource: ${fullEndpoint}`);
            return { 
                data: [], 
                pagination: { total: 0, limit: 50, offset: 0 } 
            };
        }

        throw new MetamobApiError("API_UNAVAILABLE", "Metamob.fr est temporairement indisponible.");
    }
}

// -----------------------------------------------------------------------------
// UNIFIED PUBLIC API
// -----------------------------------------------------------------------------

export async function getUserProfile(username: string, options?: FetchOptions): Promise<UserProfile> {
    return fetchApi(`/v1/users/${encodeURIComponent(username)}`, UserProfileSchema, {
        ...options,
        tags: [`metamob-user-${username.toLowerCase()}`]
    });
}

export async function getUserQuests(username: string, options?: FetchOptions): Promise<UserQuest[]> {
    const result = await fetchPaginatedApi(`/v1/users/${encodeURIComponent(username)}/quests`, UserQuestSchema, {
        ...options,
        tags: [`metamob-user-${username.toLowerCase()}`]
    });
    return result.data;
}

export async function getQuestDetails(username: string, slug: string, options?: FetchOptions & { status?: string; offset?: number; limit?: number; skipCache?: boolean }): Promise<QuestDetails> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());
    const query = params.toString() ? `?${params}` : '';

    return fetchApi(`/v1/users/${encodeURIComponent(username)}/quests/${encodeURIComponent(slug)}${query}`, QuestDetailsSchema, {
        ...options,
        // Tag the request so that revalidateTag(`metamob-user-${username}`) properly busts
        // the Next.js Data Cache when forceRefreshOcre() is called.
        tags: [...(options?.tags || []), `metamob-user-${username.toLowerCase()}`]
    });
}

export async function getQuestZones(slug: string, options?: FetchOptions): Promise<z.infer<typeof ZoneSchema>[]> {
    const response = await fetchApi(`/v1/quests/${encodeURIComponent(slug)}/zones`, z.array(ZoneSchema), options);
    return response as any;
}

export async function getQuestTemplateMonsters(templateId: number, options?: FetchOptions & { step?: number; offset?: number; limit?: number; skipCache?: boolean }): Promise<QuestMonster[]> {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (options?.offset) params.set("offset", options.offset.toString());
    if (options?.step) params.set("step", options.step.toString());
    const endpoint = `/v1/quest-templates/${templateId}?${params}`;

    const result = await fetchApi(endpoint, QuestTemplateDetailsSchema, options);

    let allMonsters = [...result.monsters];
    let offset = allMonsters.length;

    while (allMonsters.length < result.pagination.total) {
        params.set("offset", offset.toString());
        const more = await fetchApi(`/v1/quest-templates/${templateId}?${params}`, QuestTemplateDetailsSchema, options);
        if (more.monsters.length === 0) break;
        allMonsters = [...allMonsters, ...more.monsters];
        offset += more.monsters.length;
    }

    return allMonsters;
}

export async function getPrivateQuestDetails(username: string, slug: string, options?: FetchOptions & { limit?: number; offset?: number; status?: string; step?: number }): Promise<QuestDetails> {
    try {
        return await getQuestDetails(username, slug, options);
    } catch (error) {
        // If getting user-specific quest fails with INVALID_API_KEY, it might actually be a private profile
        // because we don't know if the key is valid yet.
        if (error instanceof MetamobApiError && error.code === "INVALID_API_KEY") {
            // Rethrow as UNAUTHORIZED if it's a user quest, as we assume the key worked for templates before this.
            // But better: let the caller handle it.
            throw error;
        }
        throw error;
    }
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
    const result = await fetchPaginatedApi(`/v1/quests/${encodeURIComponent(slug)}/matches${qs ? `?${qs}` : ""}`, MatchPartnerSchema, {
        ...options,
        tags: [`metamob-quest-matches-${slug}`]
    });
    return { matches: result.data, pagination: result.pagination };
}

export async function getQuestTemplates(options?: FetchOptions): Promise<QuestTemplate[]> {
    const result = await fetchPaginatedApi(`/v1/quest-templates`, QuestTemplateSchema, options);
    return result.data;
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
    // Provide defaults for optional fields
    return result.data.map(event => ({
        ...event,
        participants_count: event.participants_count ?? 0,
        character_count: event.character_count ?? 0,
        messages_count: event.messages_count ?? 0,
    }));
}

export async function getKralamoureEventDetails(eventId: number, options?: FetchOptions): Promise<KralamoureEventDetails> {
    const result = await fetchApi(`/v1/kralove/${eventId}`, KralamoureEventDetailsSchema, options);
    // Provide defaults for optional fields
    return {
        ...result,
        participants_count: result.participants_count ?? 0,
        character_count: result.character_count ?? 0,
        messages_count: result.messages_count ?? 0,
    };
}

export async function updateQuestSettings(
    slug: string,
    settings: QuestSettings,
    options: FetchOptions & { guildApiKey: string }
): Promise<QuestSettings> {
    if (!options.guildApiKey) {
        throw new MetamobApiError("UNAUTHORIZED", "Une clé API personnelle est requise pour modifier les paramètres.");
    }

    const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${options.guildApiKey}`
    };

    try {
        const response = await fetch(`${METAMOB_API_BASE}/v1/quests/${encodeURIComponent(slug)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(settings)
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new MetamobApiError("UNAUTHORIZED", "Accès refusé. Vérifiez votre clé API personnelle.");
            }
            throw new MetamobApiError("API_ERROR", `Erreur ${response.status} lors de la mise à jour des paramètres`);
        }

        const json = await response.json();
        return QuestSettingsSchema.parse(json.data || json);
    } catch (error) {
        if (error instanceof MetamobApiError) throw error;
        throw new MetamobApiError("API_ERROR", "Erreur réseau lors de la mise à jour des paramètres");
    }
}

export async function updateMonsterTradeParams(
    slug: string,
    monsterId: number,
    params: { trade_offer?: number | null; trade_want?: number | null },
    options: FetchOptions & { guildApiKey: string }
): Promise<void> {
    if (!options.guildApiKey) {
        throw new MetamobApiError("UNAUTHORIZED", "Une clé API personnelle est requise.");
    }

    const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${options.guildApiKey}`
    };

    try {
        const response = await fetch(`${METAMOB_API_BASE}/v1/quests/${encodeURIComponent(slug)}/monsters/${monsterId}/trade`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new MetamobApiError("UNAUTHORIZED", "Accès refusé.");
            }
            throw new MetamobApiError("API_ERROR", `Erreur ${response.status} lors de la mise à jour du trade`);
        }
    } catch (error) {
        if (error instanceof MetamobApiError) throw error;
        throw new MetamobApiError("API_ERROR", "Erreur réseau");
    }
}

export async function updateMonsterQuantity(
    username: string,
    questSlug: string,
    monsterId: number,
    quantity: number,
    options: FetchOptions & { guildApiKey: string }
): Promise<void> {
    return bulkUpdateMonsters(questSlug, [{ monster_id: monsterId, quantity }], options);
}

export async function bulkUpdateMonsters(
    questSlug: string,
    monsters: { monster_id: number; quantity: number }[],
    options: FetchOptions & { guildApiKey: string }
): Promise<void> {
    if (!options.guildApiKey) {
        throw new MetamobApiError("UNAUTHORIZED", "Une clé API personnelle est requise pour modifier les quantités.");
    }
    
    const payload = { monsters };

    const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${options.guildApiKey}`
    };

    const endpoint = `/v1/quests/${encodeURIComponent(questSlug)}/monsters`;

    try {
        const response = await fetch(`${METAMOB_API_BASE}${endpoint}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new MetamobApiError("UNAUTHORIZED", "Accès refusé. Vérifiez votre clé API personnelle.");
            }
            if (response.status === 404) {
                throw new MetamobApiError("NOT_FOUND", "Quête introuvable.");
            }
            if (response.status === 429) {
                throw new MetamobApiError("RATE_LIMIT", "Trop de requêtes. Veuillez patienter.");
            }
            throw new MetamobApiError("API_ERROR", `Erreur ${response.status} lors de la mise à jour bulk`);
        }
    } catch (error) {
        if (error instanceof MetamobApiError) throw error;
        throw new MetamobApiError("API_ERROR", "Erreur réseau lors de la mise à jour bulk");
    }
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

    const quest = profile.quests.find(q =>
        q.quest_template.id === 1 || // Unity (620)
        q.quest_template.id === 2 || // Retro (450)
        (q.quest_template.monster_count ?? 0) > 200 ||
        q.slug.includes("moisson")
    ) || profile.quests[0];

    if (!quest) return [];

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

export function getMonsterTypeName(typeNameFr: string): "monstre" | "boss" | "archimonstre" {
    const formatted = typeNameFr.toLowerCase().trim();
    if (formatted.includes("archimonstre")) return "archimonstre";
    if (formatted.includes("gardien") || formatted.includes("boss")) return "boss";
    return "monstre";
}

export function normalizeQuestMonster(monster: QuestMonster, parallelQuests: number = 1): OcreMonster {
    const pq = Math.max(1, parallelQuests);
    const m = monster as any;

    // Use specific API fields from V2: quantity, owned, or amount
    let owned = Math.max(
        0,
        m.owned ?? 0,
        m.quantite ?? 0,
        m.quantity ?? 0,
        m.amount ?? 0,
        m.monster?.owned ?? 0,
        m.monster?.quantite ?? 0,
        m.monster?.quantity ?? 0,
        m.monster?.amount ?? 0
    );

    // [V2 FIX] If owned is 0/missing, infer from want/offer/status logic
    // status = owned - parallelQuests
    // Logic:
    // - Status defined: explicit.
    // - Offer > 0: means we have enough for quests + extras.
    // - Want > 0: means we are missing some.
    // - Want == 0 && Offer == 0: means we have exactly the count needed (Neutral/Green state).

    // Check if any explicit "owned" field was present (to distinguish from default 0)
    const hasExplicitOwned = m.owned !== undefined || m.quantite !== undefined || m.quantity !== undefined || m.amount !== undefined || m.monster?.owned !== undefined;

    if (!hasExplicitOwned) {
        if (m.status !== undefined) {
            owned = Math.max(0, m.status + pq);
        } else if ((m.offer ?? 0) > 0) {
            owned = pq + (m.offer ?? 0);
        } else if ((m.want ?? 0) > 0) {
            owned = Math.max(0, pq - (m.want ?? 0));
        } else {
            // Case: Want 0, Offer 0. 
            // In Metamob, this usually means "I have it" (Satisfied state).
            // Default to PQ.
            owned = pq;
        }
    }

    // Image URL construction
    const image = monster.image
        ? (monster.image.startsWith('http') ? monster.image : `https://www.metamob.fr/img/monsters/${monster.image}`)
        : "";

    const zones = (monster as any).zones?.map((z: any) => z.name?.fr).filter(Boolean) || [];
    const zoneName = zones.length > 0 ? zones.join(", ") : undefined;

    return {
        id: monster.monster_id ?? m.monster?.id ?? monster.reference?.id ?? monster.id,
        name: monster.name.fr,
        nameFr: monster.name.fr,
        nameEn: monster.name.en,
        image,
        levelMin: monster.level_min ?? 0,
        levelMax: monster.level_max ?? 0,
        type: monster.type ? getMonsterTypeName(monster.type.name.fr) : "monstre",
        typeId: monster.type?.id ?? 0,
        step: monster.step ?? 1,
        owned,
        status: monster.status ?? 0,
        state: computeMonsterState(owned, pq),
        zone: zoneName,
        trade_offer: monster.offer,
        trade_want: monster.want,
    };
}

export async function verifyMetamobUser(username: string, options?: FetchOptions): Promise<{ pseudo: string; serveur: string | null; serverId: number | null; questSlug: string | null; characterName: string | null } | null> {
    try {
        const profile = await getUserProfile(username, options);
        const ocreQuest = profile.quests?.find(q =>
            q.quest_template.id === 1 || // Unity
            q.quest_template.id === 2 || // Retro
            (q.quest_template.monster_count ?? 0) > 200
        );
        const targetQuest = ocreQuest || profile.quests?.[0];

        return {
            pseudo: profile.username,
            serveur: targetQuest?.server.name || null,
            serverId: targetQuest?.server.id || null,
            questSlug: targetQuest?.slug || null,
            characterName: targetQuest?.character_name || null,
        };
    } catch (error) {
        if (error instanceof MetamobApiError) throw error;
        return null;
    }
}
