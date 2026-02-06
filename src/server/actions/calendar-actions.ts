"use server";

/**
 * Calendar Module V2 - Server Actions
 * Handles guild events with 5 Dofus types, roster management, and Discord sync.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";

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
    "OFFICIAL_RESET"
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
    status: z.enum(EVENT_STATUSES).optional().default("DRAFT"),
    startDate: z.date(),
    endDate: z.date(),
    recurrence: z.enum(RECURRENCE_TYPES).optional().default("UNIQUE"),
    location: z.string().max(100).optional(),
    maxParticipants: z.number().int().min(1).nullable().optional(),
    notifyBefore: z.number().int().min(0).nullable().optional(),
    metadata: z.any().optional(), // Dynamic per type
    publishOnDiscord: z.boolean().optional().default(false),
}).refine(data => data.endDate > data.startDate, {
    message: "La date de fin doit être après la date de début",
    path: ["endDate"]
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
                    orderBy: { position: "asc" }
                },
                _count: {
                    select: { participants: true }
                }
            },
            orderBy: { startDate: "asc" },
            take: 500 // Limit max events per request
        });

        return { success: true, events };
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

        return { success: true, event };
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

// ============================================
// WRITE ACTIONS
// ============================================

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
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const { publishOnDiscord, ...eventData } = validated.data;

        const event = await db.guildEvent.create({
            data: {
                ...eventData,
                guildId: guildConfig.id,
                creatorId: ctx.id!
            }
        });

        // Auto-publish if requested
        let discordSent = false;
        if (publishOnDiscord) {
            const { publishDiscordEvent } = await import("@/server/calendar-service"); // Lazy import to avoid cycle
            const result = await publishDiscordEvent(guildId, event.id);
            if (result.success) discordSent = true;
        }

        revalidatePath(`/dashboard/${guildId}/calendar`);
        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, eventId: event.id, discordSent };
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

        // Check for duplicates (same title and start time within 5 mins)
        const title = `Ouverture Kralamoure (${kralaEvent.server.name})`;
        const existing = await db.guildEvent.findFirst({
            where: {
                guildId: guildConfig.id,
                title: title,
                startDate: startDate,
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
            }
        });

        revalidatePath(`/dashboard/${guildId}/calendar`);
        revalidatePath(`/dashboard/${guildId}/quete-ocre`); // Refresh widget too if needed?

        return { success: true, eventId: event.id };
    } catch (error) {
        console.error("[Calendar] importKralaEvent Error:", error);
        return { success: false, error: "Erreur lors de l'import" };
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

        // Exclude virtual fields
        const { publishOnDiscord, ...updateData } = validated.data;

        await db.guildEvent.update({
            where: { id: eventId, guildId: guildConfig.id },
            data: updateData
        });

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true };
    } catch (error) {
        console.error("[Calendar] updateEvent Error:", error);
        return { success: false, error: "Erreur lors de la modification" };
    }
}

/**
 * Delete an event
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
 * Complete an event (PUBLISHED -> COMPLETED) and distribute points
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
            include: { participants: { where: { status: "REGISTERED" } } }
        });

        if (!event) return { success: false, error: "Événement introuvable" };
        if (event.status === "COMPLETED") return { success: false, error: "Déjà terminé" };

        // Distribute XP based on event type
        const xpReward = event.type === "RAID_OFFICIAL" ? 50 : 20;
        const captainBonus = 10;

        // Update event status
        await db.guildEvent.update({
            where: { id: eventId },
            data: { status: "COMPLETED" }
        });

        // TODO: Distribute XP to participants via UserProfile update

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, participantsReward: event.participants.length, xpReward };
    } catch (error) {
        console.error("[Calendar] completeEvent Error:", error);
        return { success: false, error: "Erreur lors de la clôture" };
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
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, name: true, calendarNotifyChannelId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            include: {
                participants: {
                    where: { status: { in: ["REGISTERED", "RESERVE"] } },
                    include: { user: { select: { id: true, name: true } } }
                }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

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
        const { format, formatDistanceToNow } = await import("date-fns");
        const { fr } = await import("date-fns/locale");
        const eventTime = format(event.startDate, "EEEE d MMMM à HH:mm", { locale: fr });
        const timeUntil = formatDistanceToNow(event.startDate, { locale: fr, addSuffix: false });

        // Send in-app notifications to all participants
        let sentCount = 0;
        for (const participant of event.participants) {
            await createNotification(
                participant.user.id,
                "SYSTEM_INFO",
                `🔔 Rappel: ${event.title}`,
                `L'événement commence ${eventTime}. N'oublie pas de te connecter !`,
                `/dashboard/${guildId}/calendar`
            );
            sentCount++;
        }

        // Send Discord reminder if channel is configured
        let discordSent = false;
        if (guildConfig.calendarNotifyChannelId) {
            // Validate channel belongs to guild
            const { validateChannelBelongsToGuild, sendChannelMessage } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(guildConfig.calendarNotifyChannelId, guildId);

            if (isValidChannel) {
                // Get type config for emoji and color
                const typeConfig = {
                    RAID_OFFICIAL: { emoji: "⚔️", color: 0xef4444 },
                    EVENT_GUILD: { emoji: "🎉", color: 0x8b5cf6 },
                    SESSION_MISSIONS: { emoji: "🎯", color: 0x3b82f6 },
                    SORTIE_FARM: { emoji: "🌾", color: 0x22c55e },
                    ALMANAX_BONUS: { emoji: "✨", color: 0xf59e0b },
                    GUILD_MISSION: { emoji: "📋", color: 0x06b6d4 },
                    SONGES_RUN: { emoji: "🌙", color: 0x6366f1 },
                    DUNGEON_FARM: { emoji: "🏰", color: 0xec4899 },
                    SOCIAL: { emoji: "🍻", color: 0xf97316 },
                    OFFICIAL_RESET: { emoji: "🔄", color: 0x64748b }
                }[event.type] || { emoji: "📅", color: 0x9333ea };

                // Format date/time
                const dateStr = format(event.startDate, "EEEE d MMMM", { locale: fr });
                const timeStr = event.endDate
                    ? `${format(event.startDate, "HH:mm")} - ${format(event.endDate, "HH:mm")}`
                    : format(event.startDate, "HH:mm");

                // Build mention content
                let mentionContent = "";
                if (pingRoleId) {
                    if (pingRoleId === "everyone") {
                        mentionContent = "@everyone";
                    } else {
                        mentionContent = `<@&${pingRoleId}>`;
                    }
                }

                // Registered participants count
                const registeredCount = event.participants.filter(p => p.status === "REGISTERED").length;

                // Create urgency embed for reminder
                // Create urgency embed for reminder
                const msgId = await sendChannelMessage(
                    guildConfig.calendarNotifyChannelId,
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

        console.log(`[Calendar] Auto-closed ${expiredEvents.length} expired events`);

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
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                calendarNotifyChannelId: true,
                name: true
            }
        });

        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };
        if (!guildConfig.calendarNotifyChannelId) {
            return { success: false, error: "Salon Discord non configuré. Allez dans Admin > Calendrier." };
        }

        // SECURITY: Validate channel belongs to this guild
        const { validateChannelBelongsToGuild } = await import("@/server/discord");
        const isValidChannel = await validateChannelBelongsToGuild(guildConfig.calendarNotifyChannelId, guildId);
        if (!isValidChannel) {
            return { success: false, error: "Salon Discord invalide ou n'appartient pas à ce serveur" };
        }

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            include: {
                participants: {
                    where: { status: "REGISTERED" }
                }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

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

        // Format date
        const { format } = await import("date-fns");
        const { fr } = await import("date-fns/locale");
        const dateStr = format(event.startDate, "EEEE d MMMM", { locale: fr });
        const timeStr = `${format(event.startDate, "HH:mm")} - ${format(event.endDate ? event.endDate : event.startDate, "HH:mm")}`;

        // Event type config
        const typeLabels: Record<string, { emoji: string; color: number }> = {
            RAID_OFFICIAL: { emoji: "⚔️", color: 0xef4444 },
            EVENT_GUILD: { emoji: "🎉", color: 0xa855f7 },
            SESSION_MISSIONS: { emoji: "🎯", color: 0xf59e0b },
            SORTIE_FARM: { emoji: "🌾", color: 0x22c55e },
        };
        const typeConfig = typeLabels[event.type] || { emoji: "📅", color: 0xf59e0b };

        // Build embed fields
        const participantCount = event.participants.length;
        const maxStr = event.maxParticipants ? `${participantCount}/${event.maxParticipants}` : `${participantCount}`;

        // Build mention content
        let mentionContent = "";
        if (pingRoleId) {
            if (pingRoleId === "everyone") {
                mentionContent = "@everyone";
            } else {
                mentionContent = `<@&${pingRoleId}>`;
            }
        }

        // Send Discord message
        const { sendChannelMessage } = await import("@/server/discord");
        const messageId = await sendChannelMessage(
            guildConfig.calendarNotifyChannelId,
            mentionContent, // Role mention if specified
            {
                embedTitle: `${typeConfig.emoji} ${event.title}`,
                embedColor: typeConfig.color,
                embedFooter: `SigilOS • Calendrier ${guildConfig.name}`,
                fields: [
                    { name: "📆 Date", value: dateStr.charAt(0).toUpperCase() + dateStr.slice(1), inline: true },
                    { name: "⏰ Horaire", value: timeStr, inline: true },
                    { name: "👥 Places", value: maxStr, inline: true },
                    ...(event.description ? [{ name: "📝 Description", value: event.description.slice(0, 200) + (event.description.length > 200 ? "..." : "") }] : []),
                ]
            }
        );

        if (!messageId) {
            return { success: false, error: "Échec de l'envoi. Vérifiez les permissions du bot." };
        }

        // Update rate limit cache
        pingRateLimit.set(eventId, Date.now());

        console.log(`[Calendar] Discord notification sent for event ${event.title}`);
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
export async function getDiscordRolesForCalendar(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.canManageCalendar) {
        return [];
    }

    try {
        const { fetchGuildRoles } = await import("@/server/discord");
        const roles = await fetchGuildRoles(guildId, { excludeManaged: true });

        // Filter out @everyone (role with id === guildId) and return mentionable roles
        return roles
            .filter(role => role.id !== guildId && role.name !== "@everyone")
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.color
            }));
    } catch (error) {
        console.error("[Calendar] getDiscordRolesForCalendar Error:", error);
        return [];
    }
}
