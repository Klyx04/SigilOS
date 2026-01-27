"use server";

/**
 * Calendar Module - Server Actions
 * Handles guild events and attendance with strict RBAC.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { PERMISSIONS } from "@/lib/permissions";

// ============================================
// SCHEMAS
// ============================================

const CalendarEventSchema = z.object({
    title: z.string().min(3, "Le titre doit faire au moins 3 caractères").max(100),
    description: z.string().max(1000).optional(),
    type: z.enum(["GUILD_MISSION", "SONGES_RUN", "DUNGEON_FARM", "SOCIAL", "OFFICIAL_RESET"]),
    startDate: z.date(),
    endDate: z.date(),
    location: z.string().max(100).optional(),
    maxAttendees: z.number().int().min(1).nullable().optional(),
}).refine(data => data.endDate > data.startDate, {
    message: "La date de fin doit être après la date de début",
    path: ["endDate"]
});

// ============================================
// ACTIONS
// ============================================

/**
 * Fetch events for a guild within a date range
 */
export async function getCalendarEvents(guildId: string, start: Date, end: Date) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié", events: [] };
    if (!ctx.isMember) return { success: false, error: "Accès restreint aux membres", events: [] };

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
                endDate: { lte: end }
            },
            include: {
                creator: {
                    select: { name: true, image: true }
                },
                _count: {
                    select: { attendees: true }
                }
            },
            orderBy: { startDate: "asc" }
        });

        return { success: true, events };
    } catch (error) {
        console.error("[Calendar] getEvents Error:", error);
        return { success: false, error: "Erreur serveur", events: [] };
    }
}

/**
 * Create a new guild event
 */
export async function createCalendarEvent(guildId: string, data: z.infer<typeof CalendarEventSchema>) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission requise: Gérer le calendrier" };

    const validated = CalendarEventSchema.safeParse(data);
    if (!validated.success) return { success: false, error: validated.error.errors[0].message };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.create({
            data: {
                ...validated.data,
                guildId: guildConfig.id,
                creatorId: ctx.id!
            }
        });

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true, eventId: event.id };
    } catch (error) {
        console.error("[Calendar] createEvent Error:", error);
        return { success: false, error: "Erreur lors de la création de l'événement" };
    }
}

/**
 * Update an existing event
 */
export async function updateCalendarEvent(guildId: string, eventId: string, data: z.infer<typeof CalendarEventSchema>) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageCalendar) return { success: false, error: "Permission insuffisante" };

    const validated = CalendarEventSchema.safeParse(data);
    if (!validated.success) return { success: false, error: validated.error.errors[0].message };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        await db.guildEvent.update({
            where: { id: eventId, guildId: guildConfig.id },
            data: validated.data
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
 * RSVP to an event
 */
export async function respondToCalendarEvent(
    guildId: string,
    eventId: string,
    status: "GOING" | "MAYBE" | "DECLINED",
    comment?: string
) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Membre requis" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const event = await db.guildEvent.findUnique({
            where: { id: eventId, guildId: guildConfig.id },
            include: { _count: { select: { attendees: { where: { status: "GOING" } } } } }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

        // Check capacity if going
        if (status === "GOING" && event.maxAttendees && event._count.attendees >= event.maxAttendees) {
            // Check if user is already GOING (updating comment)
            const existing = await db.eventAttendee.findUnique({
                where: { eventId_userId: { eventId, userId: ctx.id! } }
            });
            if (!existing || existing.status !== "GOING") {
                return { success: false, error: "Désolé, cet événement est complet" };
            }
        }

        await db.eventAttendee.upsert({
            where: { eventId_userId: { eventId, userId: ctx.id! } },
            update: { status, comment },
            create: { eventId, userId: ctx.id!, status, comment }
        });

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true };
    } catch (error) {
        console.error("[Calendar] respondToEvent Error:", error);
        return { success: false, error: "Erreur lors de l'inscription" };
    }
}

/**
 * Get event details with attendees
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
                attendees: {
                    include: {
                        user: { select: { name: true, image: true } }
                    },
                    orderBy: { updatedAt: "desc" }
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
