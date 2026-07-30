"use server";

/**
 * Calendar Module V2 - Server Actions
 * Handles guild events with 5 Dofus types, roster management, and Discord sync.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { deleteChannelMessage } from "@/server/discord";

// ============================================
// LOCAL ENUM DEFINITIONS (mirrors Prisma schema)
// ============================================

const GUILD_EVENT_TYPES = [
    "RAID_OFFICIAL",
    "EVENT_GUILD",
    "SESSION_MISSIONS",
    "SORTIE_FARM",
    "ALMANAX_BONUS",
    "GUILD_MISSION",
    "SONGES_RUN",
    "DUNGEON_FARM",
    "SOCIAL",
    "OFFICIAL_RESET",
    "OTHERS"
] as const;

const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"] as const;
const RECURRENCE_TYPES = ["UNIQUE", "WEEKLY", "MONTHLY"] as const;

// ============================================
// SCHEMAS
// ============================================

const GuildEventSchema = z.object({
    title: z.string().min(3, "Le titre doit faire au moins 3 caractères").max(100),
    description: z.string().max(2000).optional(),
    type: z.enum(GUILD_EVENT_TYPES),
    status: z.enum(EVENT_STATUSES).optional().default("PUBLISHED"),
    startDate: z.date(),
    endDate: z.date(),
    recurrence: z.enum(RECURRENCE_TYPES).optional().default("UNIQUE"),
    location: z.string().max(100).optional(),
    maxParticipants: z.number().int().min(1).nullable().optional(),
    notifyBefore: z.number().int().min(0).nullable().optional(),
    metadata: z.any().optional(), // Dynamic per type
    missionIds: z.array(z.string()).optional(), // For SESSION_MISSIONS
    publishOnDiscord: z.boolean().optional().default(false),
    mentionRoleIds: z.array(z.string()).optional().default([]),
}).refine(data => data.endDate > data.startDate, {
    message: "La date de fin doit être après la date de début",
    path: ["endDate"]
}).refine(data => {
    if (data.type === "RAID_OFFICIAL" && data.maxParticipants && data.maxParticipants > 16) {
        return false;
    }
    return true;
}, {
    message: "Les raids sont limités à 16 joueurs maximum",
    path: ["maxParticipants"]
});

const RegisterEventSchema = z.object({
    classe: z.string().max(50).optional(),
    comment: z.string().max(200).optional(),
});

// ============================================
// TYPES
// ============================================

export type GuildEventInput = z.infer<typeof GuildEventSchema>;

// ============================================
// READ ACTIONS
// ============================================

/**
 * Fetch events for a guild within a date range
 */
export async function getCalendarEvents(guildId: string, start: Date, end: Date) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié", events: [] };
    if (!ctx.isMember) return { success: false, error: "Accès restreint aux membres", events: [] };

    // SECURITY: Limit date range to prevent DB overload (max 60 days)
    const MAX_RANGE_MS = 60 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
        return { success: false, error: "Plage de dates trop large (max 60 jours)", events: [] };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée", events: [] };

        const events = await db.guildEvent.findMany({
            where: {
                guildId: guildConfig.id,
                startDate: { gte: start },
                endDate: { lte: end },
                // Only show published events to non-admins
                ...(ctx.canManageCalendar ? {} : { status: "PUBLISHED" })
            },
            include: {
                creator: {
                    select: { name: true, image: true }
                },
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                profiles: {
                                    where: { guildId: guildConfig.id },
                                    select: { discordNickname: true }
                                }
                            }
                        }
                    },
                    orderBy: { position: "asc" },
                    take: 10
                },
                _count: {
                    select: { participants: true }
                }
            },
            orderBy: { startDate: "asc" },
            take: 500 // Limit max events per request
        });

        // Patch: Override type and SYNC COUNTS for Kralamoure events
        const hasKrala = events.some(e => (e.metadata as any)?.isKralamoure);
        let liveKralaEvents: any[] = [];
        
        if (hasKrala) {
            try {
                const { getKralamoureEvents } = await import("@/lib/metamob-client");
                // Fetch live events for the same range (or slightly wider to be safe)
                // Note: We need a server ID. We'll try to get it from the user's profile.
                const userProfile = await db.userProfile.findFirst({
                    where: { userId: ctx.id!, guild: { discordGuildId: guildId } },
                    select: { metamobServerId: true, metamobApiKey: true }
                });
                
                if (userProfile?.metamobServerId) {
                    const results = await getKralamoureEvents({
                        serverId: userProfile.metamobServerId,
                        from: start.toISOString(),
                        guildApiKey: userProfile.metamobApiKey,
                        revalidate: 60 // 1 minute cache
                    });
                    if (results) liveKralaEvents = results;
                }
            } catch (err) {
                console.error("[Calendar] Failed to sync Krala counts in list:", err);
            }
        }

        const patchedEvents = events.map(event => {
            const meta = event.metadata as any;
            if (meta?.isKralamoure) {
                let liveCount = meta.metamobParticipantsCount || 0;
                if (meta.metamobId && liveKralaEvents.length > 0) {
                    const match = liveKralaEvents.find(k => k.id === meta.metamobId);
                    if (match) liveCount = match.participants_count || 0;
                }
                
                return { 
                    ...event, 
                    type: "KRALAMOURE" as any,
                    _count: { participants: liveCount } // Override count for display
                };
            }
            return event;
        });

        return { success: true, events: patchedEvents };
    } catch (error) {
        console.error("[Calendar] getEvents Error:", error);
        return { success: false, error: "Erreur serveur", events: [] };
    }
}

/**
 * Get event details with participants
 */
export async function getCalendarEventDetails(guildId: string, eventId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };


    // KRALAMOURE HANDLING
    if (eventId.startsWith("krala-")) {
        const kralaId = parseInt(eventId.split("-")[1]);
        if (isNaN(kralaId)) return { success: false, error: "ID invalide" };

        const { getExternalKralamoureDetails } = await import("@/server/actions/event-actions");
        const details = await getExternalKralamoureDetails(kralaId, guildId, 0); // Force fresh fetch for modal

        if (!details) return { success: false, error: "Événement Metamob introuvable" };

        // Check if current user has a Metamob API key (fallback to any of their profiles)
        const userProfile = await db.userProfile.findFirst({
            where: { 
                userId: ctx.id!, 
                metamobApiKey: { not: null } 
            },
            select: { metamobApiKey: true }
        });

        // Map to EventDetail structure
        const event = {
            id: eventId,
            title: `Ouverture Kralamoure (${details.server.name})`,
            description: details.description || "Pas de description",
            type: "KRALAMOURE", // Special type we will handle in frontend
            status: "PUBLISHED",
            startDate: new Date(details.event_datetime),
            endDate: new Date(new Date(details.event_datetime).getTime() + 60 * 60 * 1000), // Subtly incorrect but fine for display
            location: "Antre du Kralamoure Géant (-60, -8)",
            maxParticipants: 48,
            creator: {
                id: "metamob",
                name: details.creator,
                image: null
            },
            participants: (details.participants || []).map((p, i) => ({
                id: `krala-part-${i}`,
                status: "REGISTERED",
                position: i + 1,
                user: {
                    id: `external-${i}`,
                    name: `${p.username} (${p.character_count})`,
                    image: null,
                    profiles: []
                }
            })),
            _count: { participants: details.participants_count }
        };

        return { success: true, event, hasMetamobKey: !!userProfile?.metamobApiKey };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            include: {
                creator: { select: { id: true, name: true, image: true } },
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                profiles: {
                                    where: { guildId: guildConfig.id },
                                    select: { discordNickname: true }
                                }
                            }
                        }
                    },
                    orderBy: { position: "asc" }
                }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

        // Clone event to allow modification
        const eventData = { ...event };

        // KRALAMOURE HANDLING (Imported Events)
        const meta = eventData.metadata as any;
        if (meta?.isKralamoure && meta?.metamobId) {
            // Override type
            (eventData as any).type = "KRALAMOURE";

            // Try to fetch live participants from Metamob
            try {
                const { getExternalKralamoureDetails } = await import("@/server/actions/event-actions");
                const details = await getExternalKralamoureDetails(meta.metamobId, guildId, 0); // Force fresh fetch for modal

                if (details && details.participants) {
                    // Replace participants with live data
                    (eventData as any).participants = details.participants.map((p: any, i: number) => ({
                        id: `krala-part-${i}`,
                        status: "REGISTERED",
                        position: i + 1,
                        user: {
                            id: `external-${i}`,
                            name: `${p.username} (${p.character_count})`,
                            image: null,
                            profiles: []
                        }
                    }));
                    (eventData as any)._count = { participants: details.participants_count };

                    // Also update metadata cache for next time
                    db.guildEvent.update({
                        where: { id: eventId },
                        data: { metadata: { ...meta, metamobParticipants: details.participants } }
                    }).catch(() => { }); // Fire-and-forget
                }
            } catch (err) {
                console.error("Failed to refresh Kralamoure participants", err);
            }

            // Fallback: if live fetch failed or returned null, use cached metadata participants
            if ((eventData as any).participants.length === 0 && meta.metamobParticipants?.length > 0) {
                (eventData as any).participants = meta.metamobParticipants.map((p: any, i: number) => ({
                    id: `krala-cache-${i}`,
                    status: "REGISTERED",
                    position: i + 1,
                    user: {
                        id: `cached-${i}`,
                        name: typeof p === "string" ? p : `${p.username}${p.character_count ? ` (${p.character_count})` : ""}`,
                        image: null,
                        profiles: []
                    }
                }));
            }
        }

        const isKrala = meta?.isKralamoure && meta?.metamobId;
        let hasMetamobKey = false;
        if (isKrala) {
            const userProfile = await db.userProfile.findFirst({
                where: { 
                    userId: ctx.id!, 
                    metamobApiKey: { not: null }
                },
                select: { metamobApiKey: true }
            });
            hasMetamobKey = !!userProfile?.metamobApiKey;
        }

        // Annotate raid participants who already played this week
        if (eventData.type === "RAID_OFFICIAL" && eventData.participants.length > 0) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
            weekStart.setHours(0, 0, 0, 0);

            const participantsWithCompletedRaids = await db.eventParticipant.findMany({
                where: {
                    userId: { in: eventData.participants.map((p: any) => p.userId) },
                    status: "REGISTERED",
                    event: {
                        guildId: guildConfig.id,
                        type: "RAID_OFFICIAL",
                        status: "COMPLETED",
                        startDate: { gte: weekStart }
                    }
                },
                select: { userId: true }
            });
            const repeatUserIds = new Set(participantsWithCompletedRaids.map((p: any) => p.userId));
            (eventData as any).participants = eventData.participants.map((p: any) => ({
                ...p,
                hasParticipatedThisWeek: repeatUserIds.has(p.userId)
            }));
        }

        return { success: true, event: eventData, hasMetamobKey };
    } catch (error) {
        console.error("[Calendar] getEventDetails Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Get upcoming events for widget
 */
export async function getUpcomingEvents(guildId: string, days: number = 7) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié", events: [] };
    if (!ctx.isMember) return { success: false, error: "Membre requis", events: [] };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée", events: [] };

        const now = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        const events = await db.guildEvent.findMany({
            where: {
                guildId: guildConfig.id,
                startDate: { gte: now, lte: endDate },
                status: "PUBLISHED"
            },
            include: {
                _count: { select: { participants: true } }
            },
            orderBy: { startDate: "asc" },
            take: 5
        });

        return { success: true, events };
    } catch (error) {
        console.error("[Calendar] getUpcomingEvents Error:", error);
        return { success: false, error: "Erreur serveur", events: [] };
    }
}

/**
 * Returns the currently active RAID_OFFICIAL event (if any).
 * A raid is "active" when its startDate <= now <= endDate and status is PUBLISHED.
 */
export async function getActiveRaid(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return null;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return null;

        const now = new Date();

        const raid = await db.guildEvent.findFirst({
            where: {
                guildId: guildConfig.id,
                type: "RAID_OFFICIAL",
                status: "PUBLISHED",
                startDate: { lte: now },
                endDate: { gte: now }
            },
            include: {
                _count: { select: { participants: true } }
            },
            orderBy: { startDate: "desc" }
        });

        return raid;
    } catch {
        return null;
    }
}

// ============================================
// WRITE ACTIONS
// ============================================

/**
 * Basic HTML sanitization to prevent XSS
 */
function sanitizeInput(str: string | null | undefined): string {
    if (!str) return "";
    return str
        .replace(/<[^>]*>/g, "") // Strip tags
        .replace(/javascript:/gi, "") // Strip JS protocol
        .trim();
}

/**
 * Create a new guild event
 */
export async function createCalendarEvent(guildId: string, data: GuildEventInput) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission requise: Gérer le calendrier" };

    const validated = GuildEventSchema.safeParse(data);
    if (!validated.success) return { success: false, error: validated.error.errors[0].message };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, rolesMapping: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const { publishOnDiscord, missionIds, mentionRoleIds, ...eventData } = validated.data;

        // RBAC: Raids require RAID_OFFICER permission
        if (eventData.type === "RAID_OFFICIAL") {
            const { PERMISSIONS } = await import("@/lib/permissions");
            if (!ctx.isAdmin && !ctx.roles.some(r => {
                const perms = (guildConfig.rolesMapping as any)?.[r];
                return perms && perms.includes(PERMISSIONS.RAID_OFFICER);
            })) {
                return { success: false, error: "Permission requise: Gestion des Raids" };
            }
        }

        // Merge missionIds into metadata if present
        const finalMetadata = {
            ...(eventData.metadata || {}),
            missionIds: missionIds || [],
            mentionRoleIds: mentionRoleIds || []
        };

        // If Raid, auto-set captain if missing
        if (eventData.type === "RAID_OFFICIAL" && !finalMetadata.raidCaptain) {
            finalMetadata.raidCaptain = ctx.pseudoDofus || ctx.name || "Inconnu";
        }

        // ANTI-DUPLICATE: Check if an event of the SAME TYPE already exists within a +/- 15 min window
        const fifteenMins = 15 * 60 * 1000;
        const potentialDuplicate = await db.guildEvent.findFirst({
            where: {
                guildId: guildConfig.id,
                type: eventData.type,
                startDate: {
                    gte: new Date(eventData.startDate.getTime() - fifteenMins),
                    lte: new Date(eventData.startDate.getTime() + fifteenMins)
                },
                status: { not: "CANCELLED" },
                // EXCEPTION: Don't let imported Kralamoure events block manual creations
                NOT: {
                    metadata: {
                        path: ["isKralamoure"],
                        equals: true
                    }
                }
            },
            select: { title: true }
        });

        if (potentialDuplicate) {
            return {
                success: false,
                error: `Un événement de type "${eventData.type}" existe déjà à un horaire similaire (${potentialDuplicate.title}).`
            };
        }

        const event = await db.guildEvent.create({
            data: {
                ...eventData,
                title: sanitizeInput(eventData.title),
                description: sanitizeInput(eventData.description || ""),
                location: sanitizeInput(eventData.location || ""),
                metadata: finalMetadata,
                guildId: guildConfig.id,
                creatorId: ctx.id!
            }
        });

        if (event.type === "RAID_OFFICIAL") {
            // Kamas gate applies to the creator too — consistent with processRegistration
            // Only enforced when the admin toggle is ON (raidRequireKamaDonation = true, default)
            const guildConfigFull = await db.guildConfig.findUnique({
                where: { discordGuildId: guildId },
                select: { raidRequireKamaDonation: true, raidKamaDonationThreshold: true }
            });
            if (guildConfigFull?.raidRequireKamaDonation) {
                const threshold = (guildConfigFull.raidKamaDonationThreshold ?? 3) * 10_000;
                const { getDofusWeek } = await import("@/lib/date-utils");
                const eventWeek = getDofusWeek(event.startDate);
                const creatorProfile = await db.userProfile.findFirst({
                    where: { userId: ctx.id!, guildId: guildConfig.id },
                    select: { id: true },
                });
                if (creatorProfile) {
                    const weekDonations = await (db as any).kamaDonation.aggregate({
                        _sum: { amount: true },
                        where: {
                            profileId: creatorProfile.id,
                            status: "VALIDATED",
                            weekNumber: eventWeek.week,
                            yearNumber: eventWeek.year,
                        },
                    });
                    const totalDonated = weekDonations._sum.amount ?? 0;
                    if (totalDonated < threshold) {
                        // Roll back the event creation — creator can't participate
                        await db.guildEvent.delete({ where: { id: event.id } });
                        return {
                            success: false,
                            error: `🪙 Don de ${threshold.toLocaleString("fr-FR")} kamas requis pour créer et participer aux raids cette semaine. Tu as donné ${totalDonated.toLocaleString("fr-FR")} kamas validés. Effectue ton don sur le site.`,
                        };
                    }
                }
            }

            await db.eventParticipant.create({
                data: {
                    eventId: event.id,
                    userId: ctx.id!,
                    status: "REGISTERED",
                    position: 1,
                }
            });
        }



        // Auto-publish if requested
        let discordSent = false;
        let discordError: string | null = null;
        if (publishOnDiscord) {
            const { publishDiscordEvent } = await import("@/server/calendar-service"); // Lazy import to avoid cycle
            const result = await publishDiscordEvent(guildId, event.id);
            if (result.success) {
                discordSent = true;
            } else {
                discordError = result.error || "Erreur de publication Discord";
                console.error("[Calendar] Auto-publish failed:", result.error);
            }
        }


        revalidatePath(`/dashboard/${guildId}/calendar`);
        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, eventId: event.id, discordSent, discordError };
    } catch (error) {
        console.error("[Calendar] createEvent Error:", error);
        return { success: false, error: "Erreur lors de la création de l'événement" };
    }
}

/**
 * Import a Kralamoure event from Metamob
 */
export async function importKralaEvent(guildId: string, kralaEvent: {
    id: number;
    event_datetime: string;
    server: { name: string };
    creator: string;
    description: string;
    participants_count?: number;
    character_count?: number;
}) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission requise: Gérer le calendrier" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const startDate = new Date(kralaEvent.event_datetime);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration default

        // ANTI-DUPLICATE (Improved): Check for duplicates within a 10-minute window instead of exact match
        const title = `Ouverture Kralamoure (${kralaEvent.server.name})`;
        const tenMins = 10 * 60 * 1000;
        const existing = await db.guildEvent.findFirst({
            where: {
                guildId: guildConfig.id,
                title: title,
                startDate: {
                    gte: new Date(startDate.getTime() - tenMins),
                    lte: new Date(startDate.getTime() + tenMins)
                },
                status: { not: "CANCELLED" }
            }
        });

        if (existing) {
            return { success: false, error: "Cet événement existe déjà dans le calendrier" };
        }

        const description = [
            `**Organisateur :** ${kralaEvent.creator}`,
            kralaEvent.description ? `\n${kralaEvent.description}` : "",
            `\nImporté depuis Metamob`
        ].join("\n");

        const event = await db.guildEvent.create({
            data: {
                guildId: guildConfig.id,
                title: title,
                description: description,
                type: "EVENT_GUILD", // Use a generic event type
                startDate: startDate,
                endDate: endDate,
                status: "PUBLISHED",
                creatorId: ctx.id!,
                recurrence: "UNIQUE",
                location: "Antre du Kralamoure Géant (-60, -8)",
                metadata: {
                    isKralamoure: true,
                    metamobId: kralaEvent.id,
                    serverName: kralaEvent.server.name,
                    metamobCreator: kralaEvent.creator,
                    metamobParticipantsCount: kralaEvent.participants_count || 0,
                    metamobCharacterCount: kralaEvent.character_count || 0,
                    metamobParticipants: [] // Will be populated below if possible
                }
            }
        });

        // Try to fetch participants immediately to populate metadata
        try {
            const { getExternalKralamoureDetails } = await import("@/server/actions/event-actions");
            const details = await getExternalKralamoureDetails(kralaEvent.id, guildId);

            if (details && details.participants) {
                await db.guildEvent.update({
                    where: { id: event.id },
                    data: {
                        metadata: {
                            ...(event.metadata as any),
                            metamobParticipants: details.participants
                        }
                    }
                });
            }
        } catch (err) {
            console.error("[Calendar] Failed to fetch initial participants:", err);
        }

        revalidatePath(`/dashboard/${guildId}/calendar`);
        revalidatePath(`/dashboard/${guildId}/quete-ocre`); // Refresh widget too if needed?

        return { success: true, eventId: event.id };
    } catch (error) {
        console.error("[Calendar] importKralaEvent Error:", error);
        return { success: false, error: "Erreur lors de l'import" };
    }
}

/**
 * Get list of already imported Kralamoure event IDs
 */
export async function getImportedKralamoureIds(guildId: string): Promise<{ success: boolean; ids: number[] }> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, ids: [] };

        const events = await db.guildEvent.findMany({
            where: {
                guildId: guildConfig.id,
                type: "EVENT_GUILD"
            },
            select: { metadata: true }
        });

        const importedIds = events
            .filter(e => {
                const meta = e.metadata as any;
                return meta?.isKralamoure === true && meta?.metamobId;
            })
            .map(e => (e.metadata as any).metamobId as number);

        return { success: true, ids: importedIds };
    } catch (error) {
        console.error("[Calendar] getImportedKralamoureIds Error:", error);
        return { success: false, ids: [] };
    }
}

/**
 * Update an existing event
 */
export async function updateCalendarEvent(guildId: string, eventId: string, data: GuildEventInput) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission insuffisante" };

    const validated = GuildEventSchema.safeParse(data);
    if (!validated.success) return { success: false, error: validated.error.errors[0].message };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({ where: { id: eventId }, select: { creatorId: true } });
        if (!event) return { success: false, error: "Événement introuvable" };
        if (event.creatorId !== ctx.id && !ctx.isAdmin) {
            return { success: false, error: "Seul le créateur de l'événement ou un administrateur peut le modifier." };
        }

        // Exclude virtual fields
        const { publishOnDiscord, missionIds, mentionRoleIds, ...updateData } = validated.data;

        // Merge missionIds into metadata
        const existingEvent = await db.guildEvent.findUnique({ where: { id: eventId }, select: { metadata: true } });
        const finalMetadata = {
            ...(existingEvent?.metadata as any || {}),
            ...(updateData.metadata || {}),
            missionIds: missionIds || [],
            mentionRoleIds: mentionRoleIds || []
        };

        await db.guildEvent.update({
            where: { id: eventId, guildId: guildConfig.id },
            data: {
                ...updateData,
                title: sanitizeInput(updateData.title),
                description: sanitizeInput(updateData.description || ""),
                location: sanitizeInput(updateData.location || ""),
                metadata: finalMetadata
            }
        });

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true };
    } catch (error) {
        console.error("[Calendar] updateEvent Error:", error);
        return { success: false, error: "Erreur lors de la modification" };
    }
}

/**
 * Cancel an event (soft delete — status becomes CANCELLED)
 */
export async function cancelCalendarEvent(guildId: string, eventId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission insuffisante" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            select: { id: true, creatorId: true, status: true, metadata: true, discordChannelId: true, discordMessageId: true }
        });

        if (!event) return { success: false, error: "Événement introuvable" };
        if (event.status !== "PUBLISHED") return { success: false, error: "Seuls les événements publiés peuvent être annulés" };
        if (event.creatorId !== ctx.id && !ctx.isAdmin) {
            return { success: false, error: "Seul le créateur de l'événement ou un administrateur peut l'annuler." };
        }

        // Cleanup reminder messages
        const cancelMeta = (event.metadata as any) || {};
        const cancelReminders: { channelId: string, messageId: string }[] = cancelMeta.reminderMessages || [];
        cancelReminders.forEach(({ channelId, messageId }) => {
            deleteChannelMessage(channelId, messageId).catch(() => { });
        });
        if (event?.discordChannelId && event?.discordMessageId) {
            deleteChannelMessage(event.discordChannelId, event.discordMessageId).catch(() => { });
        }

        await db.guildEvent.update({
            where: { id: eventId, guildId: guildConfig.id },
            data: { status: "CANCELLED" }
        });

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true };
    } catch (error) {
        console.error("[Calendar] cancelEvent Error:", error);
        return { success: false, error: "Erreur lors de l'annulation" };
    }
}

/**
 * Delete an event (hard delete — only for CANCELLED events)
 */
export async function deleteCalendarEvent(guildId: string, eventId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission insuffisante" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            select: { id: true, creatorId: true, status: true, discordChannelId: true, discordMessageId: true }
        });

        if (!event) return { success: false, error: "Événement introuvable" };
        if (event.status !== "CANCELLED") return { success: false, error: "Seuls les événements annulés peuvent être supprimés définitivement." };
        if (event.creatorId !== ctx.id && !ctx.isAdmin) {
            return { success: false, error: "Seul le créateur de l'événement ou un administrateur peut le supprimer." };
        }

        if (event?.discordChannelId && event?.discordMessageId) {
            deleteChannelMessage(event.discordChannelId, event.discordMessageId).catch(() => { });
        }

        await db.guildEvent.delete({
            where: { id: eventId, guildId: guildConfig.id }
        });

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true };
    } catch (error) {
        console.error("[Calendar] deleteEvent Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

/**
 * Publish an event (DRAFT -> PUBLISHED)
 */
export async function publishEvent(guildId: string, eventId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission insuffisante" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const { publishDiscordEvent } = await import("@/server/calendar-service");
        const result = await publishDiscordEvent(guildId, eventId);

        if (!result.success) {
            // Fallback: just update status if discord fails? 
            // Or fail? Better to fail or warn.
            // For now, if discord fails, we still mark as published but warn?
            // User requested premium experience, so failing might be better.
            // But let's at least mark it published so they don't get stuck.
            await db.guildEvent.update({
                where: { id: eventId, guildId: guildConfig.id },
                data: { status: "PUBLISHED" }
            });
            return { success: true, warning: "Publié mais erreur Discord: " + result.error };
        }

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true };
    } catch (error) {
        console.error("[Calendar] publishEvent Error:", error);
        return { success: false, error: "Erreur lors de la publication" };
    }
}

/**
 * Complete an event (PUBLISHED -> COMPLETED) and distribute XP to registered participants
 */
export async function completeEvent(guildId: string, eventId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission insuffisante" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            include: {
                participants: {
                    where: { status: "REGISTERED" },
                    select: { userId: true, position: true }
                }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };
        if (event.status === "COMPLETED") return { success: false, error: "Déjà terminé" };

        const xpReward = event.type === "RAID_OFFICIAL" ? 50 : 20;

        // Mark event as completed
        await db.guildEvent.update({
            where: { id: eventId },
            data: { status: "COMPLETED" }
        });

        // Close Discord message + cleanup reminder messages
        const cleanupMeta = (event.metadata as any) || {};
        const reminderMessages: { channelId: string, messageId: string }[] = cleanupMeta.reminderMessages || [];
        reminderMessages.forEach(({ channelId, messageId }) => {
            deleteChannelMessage(channelId, messageId).catch(() => { });
        });
        if (event.discordChannelId && event.discordMessageId) {
            deleteChannelMessage(event.discordChannelId, event.discordMessageId).catch(() => { });
        }

        // Distribute XP to all registered participants
        if (event.participants.length > 0) {
            const userIds = event.participants.map(p => p.userId);
            await db.userProfile.updateMany({
                where: {
                    userId: { in: userIds },
                    guildId: guildConfig.id
                },
                data: {
                    xp: { increment: xpReward }
                }
            });
        }

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, participantsRewarded: event.participants.length, xpReward };
    } catch (error) {
        console.error("[Calendar] completeEvent Error:", error);
        return { success: false, error: "Erreur lors de la clôture" };
    }
}

/**
 * Complete a RAID event with score and selective XP distribution (captain-driven)
 */
export async function completeRaidEvent(
    guildId: string,
    eventId: string,
    data: { score: string; presentUserIds: string[] }
) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission insuffisante" };

    const score = data.score?.trim() || null;
    const presentUserIds = data.presentUserIds || [];

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            select: { id: true, creatorId: true, status: true, metadata: true, discordChannelId: true, discordMessageId: true }
        });

        if (!event) return { success: false, error: "Événement introuvable" };
        if (event.status === "COMPLETED") return { success: false, error: "Déjà terminé" };

        // Save score + completion data in metadata
        const existingMeta = (event.metadata as any) || {};
        await db.guildEvent.update({
            where: { id: eventId },
            data: {
                status: "COMPLETED",
                metadata: {
                    ...existingMeta,
                    raidScore: score,
                    raidPresentUserIds: presentUserIds,
                    completedAt: new Date().toISOString(),
                    completedBy: ctx.id
                }
            }
        });

        // Close Discord message + cleanup reminder messages
        const cleanupMeta = (event.metadata as any) || {};
        const reminderMessages: { channelId: string, messageId: string }[] = cleanupMeta.reminderMessages || [];
        reminderMessages.forEach(({ channelId, messageId }) => {
            deleteChannelMessage(channelId, messageId).catch(() => { });
        });
        if (event.discordChannelId && event.discordMessageId) {
            deleteChannelMessage(event.discordChannelId, event.discordMessageId).catch(() => { });
        }

        // Distribute XP + deduct Purple Kamas for present members (dynamic threshold + stored for undo)
        let purpleKamasCost = 30; // default fallback
        if (presentUserIds.length > 0) {
            const raidConfig = await db.guildConfig.findUnique({
                where: { discordGuildId: guildId },
                select: { raidKamaDonationThreshold: true }
            });
            purpleKamasCost = (raidConfig?.raidKamaDonationThreshold ?? 3) * 10;
            await db.userProfile.updateMany({
                where: {
                    userId: { in: presentUserIds },
                    guildId: guildConfig.id
                },
                data: {
                    xp: { increment: 50 },
                    purpleKamasConsumed: { increment: purpleKamasCost }
                }
            });
        }

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, rewarded: presentUserIds.length, score };
    } catch (error) {
        console.error("[Calendar] completeRaidEvent Error:", error);
        return { success: false, error: "Erreur lors de la clôture du raid" };
    }
}

/**
 * Undo a raid completion within 24h — refunds Purple Kamas and reverts to PUBLISHED
 */
export async function undoCompleteRaidEvent(guildId: string, eventId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission insuffisante" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            select: { id: true, creatorId: true, status: true, metadata: true, discordChannelId: true, discordMessageId: true }
        });

        if (!event) return { success: false, error: "Événement introuvable" };
        if (event.status !== "COMPLETED") return { success: false, error: "Le raid n'est pas clôturé" };

        // 24h window check
        const meta = (event.metadata as any) || {};
        const completedAt = meta.completedAt ? new Date(meta.completedAt) : null;
        if (!completedAt || (Date.now() - completedAt.getTime()) > 24 * 60 * 60 * 1000) {
            return { success: false, error: "Délai de 24h dépassé. Vous ne pouvez plus annuler cette clôture." };
        }

        // Only the raid creator (initiateur) or someone with calendar management permission can undo
        if (event.creatorId !== ctx.id && !ctx.canManageCalendar) {
            return { success: false, error: "Seul l'initiateur du raid ou un gestionnaire du calendrier peut annuler la clôture." };
        }

        // Refund Purple Kamas + XP to present members (prevents double-counting on re-complete)
        const presentUserIds: string[] = meta.raidPresentUserIds || [];
        const purpleKamasCost = meta.raidPurpleKamasCost ?? 30;
        if (presentUserIds.length > 0) {
            await db.userProfile.updateMany({
                where: {
                    userId: { in: presentUserIds },
                    guildId: guildConfig.id
                },
                data: {
                    purpleKamasConsumed: { decrement: purpleKamasCost },
                    xp: { decrement: 50 }
                }
            });
        }

        // Revert event to PUBLISHED
        await db.guildEvent.update({
            where: { id: eventId },
            data: {
                status: "PUBLISHED",
                metadata: {
                    ...meta,
                    raidScore: null,
                    raidPresentUserIds: [],
                    completedAt: null,
                    completedBy: null,
                    raidUndoneAt: new Date().toISOString(),
                    raidUndoneBy: ctx.id
                }
            }
        });

        // Re-send Discord embed if previously had one
        if (event.discordChannelId) {
            const { updateDiscordEventEmbed } = await import("@/server/calendar-service");
            updateDiscordEventEmbed(guildId, eventId).catch(err => console.error("Background Embed Update Error:", err));
        }

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, refunded: presentUserIds.length };
    } catch (error) {
        console.error("[Calendar] completeRaidEvent Error:", error);
        return { success: false, error: "Erreur lors de la clôture du raid" };
    }
}

/**
 * Transfer Raid Lead (Captain) to a registered participant
 */
export async function transferRaidLead(
    guildId: string,
    eventId: string,
    targetUserId: string
) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            include: {
                participants: { select: { userId: true } }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

        const isCurrentLead = event.creatorId === ctx.id;
        const meta = (event.metadata as any) || {};
        const isCaptain = meta.raidCaptainId === ctx.id;

        if (!isCurrentLead && !isCaptain && !ctx.isAdmin && !ctx.canManageCalendar) {
            return { success: false, error: "Seul le Lead actuel du Raid ou un administrateur peut transférer le Lead." };
        }

        const isTargetRegistered = event.participants.some(p => p.userId === targetUserId);
        if (!isTargetRegistered) {
            return { success: false, error: "Le nouveau Lead doit être inscrit à l'événement." };
        }

        const targetUser = await db.user.findUnique({
            where: { id: targetUserId },
            select: { name: true, profiles: { where: { guildId: guildConfig.id }, select: { discordNickname: true, pseudoDofus: true } } }
        });

        const newCaptainName = targetUser?.profiles[0]?.discordNickname || targetUser?.profiles[0]?.pseudoDofus || targetUser?.name || "Membre";

        await db.guildEvent.update({
            where: { id: eventId },
            data: {
                creatorId: targetUserId,
                metadata: {
                    ...meta,
                    raidCaptain: newCaptainName,
                    raidCaptainId: targetUserId
                }
            }
        });

        const { updateDiscordEventEmbed } = await import("@/server/calendar-service");
        updateDiscordEventEmbed(guildId, eventId).catch(err => console.error("Background Embed Update Error:", err));

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, newCaptainName };
    } catch (error) {
        console.error("[Calendar] transferRaidLead Error:", error);
        return { success: false, error: "Erreur lors du transfert de Lead" };
    }
}


// ============================================
// REGISTRATION ACTIONS
// ============================================

/**
 * Register for an event
 */
export async function registerForEvent(
    guildId: string,
    eventId: string,
    data?: z.infer<typeof RegisterEventSchema>
) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Membre requis" };

    try {
        const { processRegistration } = await import("@/server/calendar-service");
        return await processRegistration(guildId, eventId, ctx.id!, data);
    } catch (error) {
        console.error("[Calendar] registerForEvent Error:", error);
        return { success: false, error: "Erreur lors de l'inscription" };
    }
}

/**
 * Unregister from an event
 */
export async function unregisterFromEvent(guildId: string, eventId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Membre requis" };

    try {
        const { processUnregistration } = await import("@/server/calendar-service");
        return await processUnregistration(guildId, eventId, ctx.id!);
    } catch (error) {
        console.error("[Calendar] unregisterFromEvent Error:", error);
        return { success: false, error: "Erreur lors de la désinscription" };
    }
}

/**
 * Remove/Kick a participant from an event (admin or event creator only)
 */
export async function kickParticipant(guildId: string, eventId: string, targetUserId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            select: { creatorId: true, type: true }
        });
        if (!event) return { success: false, error: "Événement introuvable" };

        // SECURITY: For RAID_OFFICIAL, only the creator can kick
        if (event.type === "RAID_OFFICIAL" && event.creatorId !== ctx.id) {
            return { success: false, error: "Seul le capitaine du raid peut exclure un participant." };
        }

        // Perms: Admin, has calendar manage perm, or is creator
        if (event.creatorId !== ctx.id && !ctx.canManageCalendar) {
            return { success: false, error: "Seul le créateur de l'événement ou un administrateur peut exclure un participant." };
        }

        const participant = await db.eventParticipant.findUnique({
            where: { eventId_userId: { eventId, userId: targetUserId } }
        });
        if (!participant) return { success: false, error: "Participant introuvable" };

        const wasRegistered = participant.status === "REGISTERED";

        await db.eventParticipant.delete({
            where: { id: participant.id }
        });

        // Promote first reserve if a registered participant was kicked
        if (wasRegistered) {
            const firstReserve = await db.eventParticipant.findFirst({
                where: { eventId, status: "RESERVE" },
                orderBy: { position: "asc" }
            });

            if (firstReserve) {
                await db.eventParticipant.update({
                    where: { id: firstReserve.id },
                    data: {
                        status: "REGISTERED",
                        promotedAt: new Date()
                    }
                });
            }
        }

        // Reorder positions
        await reorderParticipants(eventId);

        // Update Discord embed
        const { updateDiscordEventEmbed } = await import("@/server/calendar-service");
        updateDiscordEventEmbed(guildId, eventId).catch(err => console.error("Background Embed Update Error:", err));

        revalidatePath(`/dashboard/${guildId}/calendar`);
        revalidatePath(`/dashboard/${guildId}`, "layout");
        return { success: true };
    } catch (error) {
        console.error("[Calendar] kickParticipant Error:", error);
        return { success: false, error: "Erreur lors de l'expulsion du participant" };
    }
}

/**
 * TransferRaidCaptaincy — Permet au capitaine d'un raid de transférer le capitanat à un participant inscrit.
 */
export async function transferRaidCaptaincy(guildId: string, eventId: string, newCaptainUserId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            select: { creatorId: true, type: true, metadata: true }
        });
        if (!event) return { success: false, error: "Événement introuvable" };
        if (event.type !== "RAID_OFFICIAL") return { success: false, error: "Seuls les raids peuvent transférer le capitanat" };
        if (event.creatorId !== ctx.id) return { success: false, error: "Seul le capitaine actuel peut transférer le capitanat" };

        // Verify new captain is a registered participant
        const participant = await db.eventParticipant.findUnique({
            where: { eventId_userId: { eventId, userId: newCaptainUserId } },
            select: { status: true }
        });
        if (!participant || participant.status !== "REGISTERED") {
            return { success: false, error: "Le nouveau capitaine doit être un participant inscrit au raid." };
        }

        // Update creatorId
        await db.guildEvent.update({
            where: { id: eventId },
            data: {
                creatorId: newCaptainUserId,
                metadata: {
                    ...(event.metadata as any),
                    raidCaptain: undefined // Clear the text-based captain field if it existed
                }
            }
        });

        // Update Discord embed
        const { updateDiscordEventEmbed } = await import("@/server/calendar-service");
        updateDiscordEventEmbed(guildId, eventId).catch(err => console.error("Background Embed Update Error:", err));

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, message: "Capitanat transféré avec succès !" };
    } catch (error) {
        console.error("[Calendar] transferRaidCaptaincy Error:", error);
        return { success: false, error: "Erreur lors du transfert du capitanat" };
    }
}


// ============================================
// HELPER FUNCTIONS
// ============================================

async function reorderParticipants(eventId: string) {
    const participants = await db.eventParticipant.findMany({
        where: { eventId },
        orderBy: { position: "asc" }
    });

    for (let i = 0; i < participants.length; i++) {
        await db.eventParticipant.update({
            where: { id: participants[i].id },
            data: { position: i + 1 }
        });
    }
}

// ============================================
// REMINDER ACTIONS
// ============================================


/**
 * Send reminder notifications to all participants
 * Also sends a Discord reminder embed if configured
 * Only event creator or admin can trigger
 * @param pingRoleId - Optional role ID to mention (use "everyone" for @everyone)
 */
export async function sendEventReminder(guildId: string, eventId: string, pingRoleId?: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };

    try {
        const event = await db.guildEvent.findUnique({
            where: { id: eventId },
            include: {
                participants: {
                    where: { status: { in: ["REGISTERED", "RESERVE"] } },
                    include: { user: { select: { id: true, name: true } } }
                }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

        const isRaid = event.type === "RAID_OFFICIAL";

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                name: true,
                calendarNotifyChannelId: true,
                calendarPingRoleIds: true,
                raidNotifyChannelId: true,
                raidPingRoleIds: true,
                raidGigalodonNotifyChannelId: true,
                raidSanctuaireNotifyChannelId: true
            }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const meta = event.metadata as any;
        let targetChannelId = guildConfig.calendarNotifyChannelId;
        if (isRaid) {
            if (meta?.raidType === "gigalodon") {
                targetChannelId = guildConfig.raidGigalodonNotifyChannelId || guildConfig.raidNotifyChannelId || guildConfig.calendarNotifyChannelId;
            } else if (meta?.raidType === "jardin") {
                targetChannelId = guildConfig.raidSanctuaireNotifyChannelId || guildConfig.raidNotifyChannelId || guildConfig.calendarNotifyChannelId;
            } else {
                targetChannelId = guildConfig.raidNotifyChannelId || guildConfig.calendarNotifyChannelId;
            }
        }

        const allowedRoleIds: string[] = isRaid
            ? guildConfig.raidPingRoleIds
            : guildConfig.calendarPingRoleIds;

        // SECURITY: Validate pingRoleId against the admin-configured whitelist
        if (pingRoleId && pingRoleId !== "everyone") {
            if (!allowedRoleIds.includes(pingRoleId)) {
                return { success: false, error: "Ce rôle n'est pas autorisé pour les rappels de calendrier" };
            }
        }
        // Block @everyone unless explicitly whitelisted via special sentinel value
        if (pingRoleId === "everyone" && !allowedRoleIds.includes("everyone")) {
            return { success: false, error: "@everyone n'est pas autorisé pour les rappels de calendrier" };
        }

        // Check permission: must be creator or have calendar management
        if (event.creatorId !== ctx.id && !ctx.canManageCalendar) {
            return { success: false, error: "Seul l'organisateur peut envoyer des rappels" };
        }

        // Check if already reminded recently (within 30 min)
        if (event.lastRemindedAt) {
            const minsSinceReminder = (Date.now() - event.lastRemindedAt.getTime()) / 60000;
            if (minsSinceReminder < 30) {
                return { success: false, error: `Rappel déjà envoyé il y a ${Math.round(minsSinceReminder)} minutes` };
            }
        }

        // Import notification helper
        const { createNotification } = await import("./notification-actions");

        // Format event time
        const { format: dtFormat, formatDistanceToNow } = await import("date-fns");
        const { fr } = await import("date-fns/locale");
        const eventDate = new Date(event.startDate);
        const eventTime = dtFormat(eventDate, "EEEE d MMMM 'à' HH:mm", { locale: fr }) + " (heure de Paris)";
        const timeUntil = formatDistanceToNow(eventDate, { locale: fr, addSuffix: false });

        // Send in-app notifications to all participants
        let sentCount = 0;
        for (const participant of event.participants) {
            await createNotification(
                participant.user.id,
                "SYSTEM_INFO",
                `🔔 Rappel: ${event.title}`,
                `L'événement commence ${eventTime}. N'oublie pas de te connecter !`,
                `/dashboard/${guildId}/calendar`,
                guildId
            );
            sentCount++;
        }

        // Send Discord reminder (embed only — no role ping unless explicitly requested)
        let discordSent = false;
        if (targetChannelId) {
            // Validate channel belongs to guild
            const { validateChannelBelongsToGuild, sendChannelMessage } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(targetChannelId, guildId);

            if (isValidChannel) {
                // Get type config for emoji and color
                const typeConfigs: Record<string, { emoji: string; color: number }> = {
                    RAID_OFFICIAL: { emoji: "⚔️", color: 0xef4444 },
                    EVENT_GUILD: { emoji: "🎉", color: 0x8b5cf6 },
                    SESSION_MISSIONS: { emoji: "🎯", color: 0x3b82f6 },
                    SORTIE_FARM: { emoji: "🌾", color: 0x22c55e },
                    ALMANAX_BONUS: { emoji: "✨", color: 0xf59e0b },
                    GUILD_MISSION: { emoji: "📋", color: 0x06b6d4 },
                    SONGES_RUN: { emoji: "🌙", color: 0x6366f1 },
                    DUNGEON_FARM: { emoji: "🏰", color: 0xec4899 },
                    SOCIAL: { emoji: "🍻", color: 0xf97316 },
                    OFFICIAL_RESET: { emoji: "🔄", color: 0x64748b },
                    OTHERS: { emoji: "📅", color: 0x9333ea }
                };

                const typeConfig = typeConfigs[event.type] || typeConfigs.OTHERS;

                // Format date/time
                const dateStr = dtFormat(event.startDate, "EEEE d MMMM", { locale: fr });
                const timeStr = event.endDate
                    ? `${dtFormat(event.startDate, "HH:mm")} - ${dtFormat(event.endDate, "HH:mm")}`
                    : dtFormat(event.startDate, "HH:mm");

                // Build mention content
                let mentionContent = "";
                if (pingRoleId) {
                    if (pingRoleId === "everyone") {
                        mentionContent = "@everyone";
                    } else {
                        mentionContent = `<@&${pingRoleId}>`;
                    }
                }

                if (isRaid) {
                    const participantUserIds = event.participants
                        .filter(p => p.status === "REGISTERED")
                        .map(p => p.userId);

                    const accounts = await db.account.findMany({
                        where: {
                            userId: { in: participantUserIds },
                            provider: "discord"
                        },
                        select: {
                            providerAccountId: true
                        }
                    });

                    const discordPings = accounts.map(acc => `<@${acc.providerAccountId}>`).join(" ");
                    if (discordPings) {
                        mentionContent = mentionContent ? `${mentionContent} ${discordPings}` : discordPings;
                    }
                }

                // Registered participants count
                const registeredCount = event.participants.filter(p => p.status === "REGISTERED").length;

                // Create urgency embed for reminder
                const msgId = await sendChannelMessage(
                    targetChannelId,
                    mentionContent,
                    {
                        embedTitle: `⏰ RAPPEL: ${event.title}`,
                        embedColor: 0xff6b35, // Orange urgence
                        embedFooter: `SigilOS • ${guildConfig.name}`,
                        fields: [
                            { name: "⏱️ Commence dans", value: `**${timeUntil}**`, inline: true },
                            { name: "📆 Date", value: dateStr.charAt(0).toUpperCase() + dateStr.slice(1), inline: true },
                            { name: "⏰ Horaire", value: timeStr, inline: true },
                            { name: "👥 Inscrits", value: `${registeredCount}${event.maxParticipants ? `/${event.maxParticipants}` : ""} participants`, inline: true },
                            { name: `${typeConfig.emoji} Type`, value: event.type.replace(/_/g, " "), inline: true },
                            { name: "💡 Rappel", value: "Préparez-vous, l'événement arrive bientôt !", inline: false }
                        ]
                    }
                );
                discordSent = !!msgId;

                // Store reminder message ID so it can be cleaned up when event is completed/cancelled
                if (msgId) {
                    const existingMeta = (event.metadata as any) || {};
                    const existingReminders = existingMeta.reminderMessages || [];
                    const newReminderMessages = [...existingReminders, { channelId: targetChannelId, messageId: msgId }];
                    await db.guildEvent.update({
                        where: { id: eventId },
                        data: { metadata: { ...existingMeta, reminderMessages: newReminderMessages } }
                    }).catch(() => {});
                }
            }
        }

        // Update lastRemindedAt
        await db.guildEvent.update({
            where: { id: eventId },
            data: { lastRemindedAt: new Date() }
        });

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, sentCount, discordSent };
    } catch (error) {
        console.error("[Calendar] sendEventReminder Error:", error);
        return { success: false, error: "Erreur lors de l'envoi des rappels" };
    }
}

/**
 * Get events that need reminders (for cron job)
 * Returns events where:
 * - status = PUBLISHED
 * - startDate is within notifyBefore minutes
 * - lastRemindedAt is null or was more than notifyBefore ago
 */
export async function getEventsNeedingReminders() {
    try {
        const now = new Date();

        const events = await db.guildEvent.findMany({
            where: {
                status: "PUBLISHED",
                startDate: { gt: now },
                notifyBefore: { not: null }
            },
            include: {
                guild: { select: { discordGuildId: true } },
                participants: {
                    where: { status: { in: ["REGISTERED", "RESERVE"] } },
                    include: { user: { select: { id: true } } }
                }
            }
        });

        // Filter events that need reminder
        const needsReminder = events.filter(event => {
            if (!event.notifyBefore) return false;

            const msUntilEvent = event.startDate.getTime() - now.getTime();
            const notifyAtMs = event.notifyBefore * 60 * 1000;

            // Event is within notify window
            if (msUntilEvent > notifyAtMs) return false;

            // Not already reminded
            if (event.lastRemindedAt) {
                const msSinceReminder = now.getTime() - event.lastRemindedAt.getTime();
                // Don't remind again if already reminded within the window
                if (msSinceReminder < notifyAtMs) return false;
            }

            return true;
        });

        return { success: true, events: needsReminder };
    } catch (error) {
        console.error("[Calendar] getEventsNeedingReminders Error:", error);
        return { success: false, events: [] };
    }
}

// ============================================
// AUTO-CLOSE EXPIRED EVENTS
// ============================================

/**
 * Auto-close events that have passed their end date
 * Called on dashboard load or via cron job
 */
export async function autoCloseExpiredEvents(guildId: string) {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, closedCount: 0 };

        const now = new Date();

        // Find published events that have ended
        const expiredEvents = await db.guildEvent.findMany({
            where: {
                guildId: guildConfig.id,
                status: "PUBLISHED",
                endDate: { lt: now }
            },
            select: { id: true, title: true }
        });

        if (expiredEvents.length === 0) {
            return { success: true, closedCount: 0 };
        }

        // Mark them as COMPLETED
        await db.guildEvent.updateMany({
            where: {
                id: { in: expiredEvents.map(e => e.id) }
            },
            data: {
                status: "COMPLETED"
            }
        });


        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, closedCount: expiredEvents.length };
    } catch (error) {
        console.error("[Calendar] autoCloseExpiredEvents Error:", error);
        return { success: false, closedCount: 0 };
    }
}

// ============================================
// DISCORD NOTIFICATION
// ============================================

const pingRateLimit = new Map<string, number>();
const PING_COOLDOWN = 5 * 60 * 1000; // 5 minutes

/**
 * Send event to Discord channel as rich embed
 * Rate limited: 1 notification per event per 5 minutes
 * @param pingRoleId - Optional role ID to mention (use "everyone" for @everyone)
 */
export async function sendCalendarDiscordNotification(guildId: string, eventId: string, pingRoleId?: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };

    try {
        const event = await db.guildEvent.findUnique({
            where: { id: eventId },
            include: {
                participants: {
                    where: { status: "REGISTERED" }
                }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

        const isRaid = event.type === "RAID_OFFICIAL";

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                calendarNotifyChannelId: true,
                raidNotifyChannelId: true,
                name: true,
                calendarPingRoleIds: true,
                raidPingRoleIds: true,
                raidGigalodonNotifyChannelId: true,
                raidSanctuaireNotifyChannelId: true
            }
        });

        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const meta = event.metadata as any;
        let targetChannelId = guildConfig.calendarNotifyChannelId;
        if (isRaid) {
            if (meta?.raidType === "gigalodon") {
                targetChannelId = guildConfig.raidGigalodonNotifyChannelId || guildConfig.raidNotifyChannelId || guildConfig.calendarNotifyChannelId;
            } else if (meta?.raidType === "jardin") {
                targetChannelId = guildConfig.raidSanctuaireNotifyChannelId || guildConfig.raidNotifyChannelId || guildConfig.calendarNotifyChannelId;
            } else {
                targetChannelId = guildConfig.raidNotifyChannelId || guildConfig.calendarNotifyChannelId;
            }
        }

        const allowedRoleIds: string[] = isRaid
            ? guildConfig.raidPingRoleIds
            : guildConfig.calendarPingRoleIds;

        // SECURITY: Validate pingRoleId against the admin-configured whitelist
        if (pingRoleId && pingRoleId !== "everyone") {
            if (!allowedRoleIds.includes(pingRoleId)) {
                return { success: false, error: "Ce rôle n'est pas autorisé pour les notifications de calendrier" };
            }
        }
        // Block @everyone unless explicitly whitelisted via special sentinel value
        if (pingRoleId === "everyone" && !allowedRoleIds.includes("everyone")) {
            return { success: false, error: "@everyone n'est pas autorisé pour les notifications de calendrier" };
        }
        if (!targetChannelId) {
            return { success: false, error: "Salon Discord non configuré. Allez dans Admin > Calendrier." };
        }

        // SECURITY: Validate channel belongs to this guild
        const { validateChannelBelongsToGuild } = await import("@/server/discord");
        const isValidChannel = await validateChannelBelongsToGuild(targetChannelId, guildId);
        if (!isValidChannel) {
            return { success: false, error: "Salon Discord invalide ou n'appartient pas à ce serveur" };
        }

        // Permission check: must be creator or admin
        if (event.creatorId !== ctx.id && !ctx.canManageCalendar) {
            return { success: false, error: "Seul l'organisateur peut partager l'événement" };
        }

        // Rate limit check
        const lastPing = pingRateLimit.get(eventId);
        if (lastPing && Date.now() - lastPing < PING_COOLDOWN) {
            const minutesLeft = Math.ceil((PING_COOLDOWN - (Date.now() - lastPing)) / 60000);
            return { success: false, error: `Veuillez attendre ${minutesLeft} minute(s) avant de renvoyer une notification.` };
        }

        // Fixed Timezone Handling via Discord Dynamic Timestamps
        const startTs = Math.floor(new Date(event.startDate).getTime() / 1000);
        const endTs = Math.floor(new Date(event.endDate || event.startDate).getTime() / 1000);
        
        const { getAppBaseUrl } = await import("@/lib/utils");
        const publicUrl = getAppBaseUrl();

        // Build Participant Lists (simplified for repost)
        const registeredCount = event.participants.length;

        // Resolve Type Config
        const typeConfig = { emoji: "📅", color: 0x5865F2 };

        // Resolve Mentions
        // SECURITY: All role IDs — whether from param or metadata — must be in the whitelist
        let mentionContent = "";

        if (pingRoleId) {
            // Already validated above — safe to use directly
            if (pingRoleId === "everyone") mentionContent = "@everyone";
            else mentionContent = `<@&${pingRoleId}>`;
        } else if (meta?.mentionRoleIds && Array.isArray(meta.mentionRoleIds)) {
            // SECURITY: Filter metadata role IDs through whitelist
            const safeIds = (meta.mentionRoleIds as string[]).filter((id) => allowedRoleIds.includes(id));
            mentionContent = safeIds.map((id) => `<@&${id}>`).join(" ");
        } else if (meta?.mentionType === "EVERYONE" && allowedRoleIds.includes("everyone")) {
            // SECURITY: Only allow @everyone if explicitly in whitelist
            mentionContent = "@everyone";
        } else if (meta?.mentionType === "ROLE" && meta?.mentionRoleId && allowedRoleIds.includes(meta.mentionRoleId)) {
            // SECURITY: Validate single stored mentionRoleId against whitelist
            mentionContent = `<@&${meta.mentionRoleId}>`;
        }

        // Raid Specifics
        let embedImage = undefined;
        let embedThumb = undefined;
        const raidTitle = event.title;

        if (event.type === "RAID_OFFICIAL" && meta) {
            if (meta.raidType === "gigalodon") {
                embedImage = "https://images.unsplash.com/photo-1551244072-5d12893278ab?q=80&w=1000&auto=format&fit=crop"; 
                embedThumb = "https://static.ankama.com/dofus/www/game/monsters/200/5129.png";
            } else if (meta.raidType === "jardin") {
                embedImage = "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=1000&auto=format&fit=crop";
                embedThumb = "https://static.ankama.com/dofus/www/game/monsters/200/5131.png";
            }
        }

        // Send Discord message
        const { sendChannelMessage } = await import("@/server/discord");
        const messageId = await sendChannelMessage(
            targetChannelId,
            mentionContent,
            {
                embedTitle: `${typeConfig.emoji} ${raidTitle}`,
                embedColor: typeConfig.color,
                embedImage,
                embedThumbnail: embedThumb,
                embedFooter: `SigilOS • Calendrier ${guildConfig.name}`,
                fields: [
                    { name: "📅 Date", value: `<t:${startTs}:d> (<t:${startTs}:D>)`, inline: true },
                    { name: "⏰ Horaire", value: `<t:${startTs}:t> - <t:${endTs}:t> (<t:${startTs}:R>)`, inline: true },
                    { name: "👥 Places", value: `${registeredCount}/${event.maxParticipants || "∞"}`, inline: true },
                    { name: "👑 Capitaine", value: meta?.raidCaptain || "À déterminer", inline: true },
                    { name: "🔗 Lien", value: `[Voir sur le Dashboard](${publicUrl}/dashboard/${guildId}/calendar?event=${event.id})`, inline: true },
                    { name: "📝 Description", value: event.description || "*Pas de description*", inline: false },
                ],
                components: [
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 3, label: "S'inscrire", emoji: { name: "✅" }, custom_id: `calendar:join:${event.id}` },
                            { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `calendar:leave:${event.id}` }
                        ]
                    }
                ]
            }
        );

        if (!messageId) {
            return { success: false, error: "Échec de l'envoi. Vérifiez les permissions du bot." };
        }

        // Update rate limit cache
        pingRateLimit.set(eventId, Date.now());

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true };
    } catch (error) {
        console.error("[Calendar] sendCalendarDiscordNotification Error:", error);
        return { success: false, error: "Erreur lors de l'envoi" };
    }
}

/**
 * Get Discord roles for calendar notifications
 * Used to populate the role selection dropdown
 */
export async function getDiscordRolesForCalendar(guildId: string, isRaid?: boolean) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.canManageCalendar) {
        return { roles: [], everyoneAllowed: false };
    }

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { calendarPingRoleIds: true, raidPingRoleIds: true }
        });
        const allowedRoleIds: string[] = isRaid
            ? (config?.raidPingRoleIds ?? [])
            : (config?.calendarPingRoleIds ?? []);
        const everyoneAllowed = allowedRoleIds.includes("everyone");

        const { fetchGuildRoles } = await import("@/server/discord");
        const roles = await fetchGuildRoles(guildId, { excludeManaged: true });

        // Filter by whitelist configuration
        const filtered = roles
            .filter(role => allowedRoleIds.includes(role.id))
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.color
            }));

        return { roles: filtered, everyoneAllowed };
    } catch (error) {
        console.error("[Calendar] getDiscordRolesForCalendar Error:", error);
        return { roles: [], everyoneAllowed: false };
    }
}

/**
 * Get public config for calendar (e.g., notify channel id) for UI components
 */
export async function getCalendarPublicConfig(guildId: string) {
    try {
        const ctx = await getUserContext(guildId);
        if (!ctx.isAuthenticated) return { success: false, error: "Non autorisé" };

        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { 
                calendarNotifyChannelId: true, 
                raidNotifyChannelId: true,
                raidGigalodonNotifyChannelId: true,
                raidSanctuaireNotifyChannelId: true,
                raidAllowedSignUpRoleIds: true,
                calendarPingRoleIds: true,
                raidPingRoleIds: true,
            }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };
        
        return { success: true, data: config };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

