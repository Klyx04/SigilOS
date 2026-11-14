"use server";

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { SystemIssueType, SystemIssueStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import {
    buildFeedbackSubject,
    legacyTypeToCategory,
    projectMemberTrackerTicket,
    trackerStatusToTicketStatus,
    type MemberTrackerTicket,
} from "@/lib/feedback-ticket-mapping";
import { ensurePublicRef } from "@/server/feedback-ticket-service";

// La console God et le tracker membre partagent la même table. Les fonctions
// gardent leurs anciens noms le temps de la bascule UI (PR 3) ; elles ne lisent
// plus `SystemIssue`.
const TRACKER_LIMIT = 500;

async function isGod() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    return session.user.id;
}

type TrackerTicketRow = {
    id: number;
    publicRef: string | null;
    type: "BUG" | "AMELIORATION";
    category: string;
    priority: string;
    description: string;
    status: "A_FAIRE" | "A_INVESTIGUER" | "EN_COURS" | "TERMINE" | "IGNORE";
    createdAt: Date;
    forumLink: string | null;
    feedbackType: string | null;
    sourcePage: string | null;
    targetSlug: string | null;
    guildId: string | null;
    memberName: string | null;
    memberGuildName: string | null;
    creatorId: string | null;
};

function toTrackerTicketRow(ticket: {
    legacySystemIssueId: number | null;
    ticketNumber: number;
    publicRef: string | null;
    category: string;
    priority: string | null;
    description: string;
    trackerStatus: "A_FAIRE" | "A_INVESTIGUER" | "EN_COURS" | "TERMINE" | "IGNORE" | null;
    createdAt: Date;
    forumLink: string | null;
    feedbackType: string | null;
    sourcePage: string | null;
    targetSlug: string | null;
    guildId: string | null;
    creatorDiscordName: string;
    memberGuildName: string | null;
    creatorUserId: string | null;
    origin: string;
}): TrackerTicketRow {
    return {
        id: ticket.legacySystemIssueId ?? ticket.ticketNumber,
        publicRef: ticket.publicRef,
        type: ticket.category === "BUG_REPORT" ? "BUG" : "AMELIORATION",
        category: ticket.origin === "INTERNAL" ? "Note interne" : (ticket.feedbackType ?? "Signalement"),
        priority: ticket.priority ?? "Normal",
        description: ticket.description,
        status: ticket.trackerStatus ?? "A_FAIRE",
        createdAt: ticket.createdAt,
        forumLink: ticket.forumLink,
        feedbackType: ticket.feedbackType,
        sourcePage: ticket.sourcePage,
        targetSlug: ticket.targetSlug,
        guildId: ticket.guildId,
        memberName: ticket.creatorDiscordName,
        memberGuildName: ticket.memberGuildName,
        creatorId: ticket.creatorUserId,
    };
}

export async function getSystemIssues() {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        const tickets = await db.supportTicket.findMany({
            where: { origin: { in: ["FEEDBACK", "INTERNAL"] } },
            orderBy: [{ trackerStatus: "asc" }, { createdAt: "desc" }],
            take: TRACKER_LIMIT,
        });
        return {
            success: true,
            data: tickets.map(toTrackerTicketRow),
            total: tickets.length,
        };
    } catch (e: any) {
        logger.error("[Tracker] Lecture God impossible", { error: e?.message });
        return { success: false, error: e.message };
    }
}

export async function getMemberSystemIssues(guildId: string) {
    const start = Date.now();
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    try {
        // 1. Resolve internal guild ID from Discord ID
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) {
            logger.error(`[Tracker] Guild config not found for Discord ID: ${guildId}`);
            return { success: false, error: "Guilde introuvable" };
        }

        const internalGuildId = guildConfig.id;

        // 2. Double check membership for security
        const membership = await db.userProfile.findFirst({
            where: {
                guildId: internalGuildId,
                userId: session.user.id,
                status: "ACTIVE"
            }
        });

        if (!membership) {
            logger.error(`[Tracker] Access denied for user ${session.user.id} in guild ${internalGuildId}`);
            return { success: false, error: "Accès refusé" };
        }

        // 3. Tracker global : uniquement les signalements membres (jamais INTERNAL).
        const tickets = await db.supportTicket.findMany({
            where: { origin: "FEEDBACK" },
            orderBy: [{ trackerStatus: "asc" }, { createdAt: "desc" }],
            take: TRACKER_LIMIT,
            select: {
                legacySystemIssueId: true,
                ticketNumber: true,
                publicRef: true,
                category: true,
                priority: true,
                description: true,
                trackerStatus: true,
                createdAt: true,
                forumLink: true,
                feedbackType: true,
                sourcePage: true,
                targetSlug: true,
                guildId: true,
                creatorDiscordName: true,
                memberGuildName: true,
                transcript: true,
            },
        });

        const projected: (MemberTrackerTicket & {
            id: number;
            type: "BUG" | "AMELIORATION";
            category: string;
            priority: string;
            status: MemberTrackerTicket["trackerStatus"];
            feedbackType: string | null;
        })[] = tickets.map((ticket) => {
            const view = projectMemberTrackerTicket(ticket, internalGuildId);
            return {
                ...view,
                id: ticket.legacySystemIssueId ?? ticket.ticketNumber,
                type: ticket.category === "BUG_REPORT" ? "BUG" as const : "AMELIORATION" as const,
                category: ticket.feedbackType ?? "Signalement",
                priority: ticket.priority ?? "Normal",
                status: view.trackerStatus,
                feedbackType: view.feedbackType,
            };
        });

        logger.debug(`[PERF] getMemberSystemIssues took ${Date.now() - start}ms`);
        return { success: true, data: projected };
    } catch (e: any) {
        logger.error(`[Tracker] Error:`, { error: e });
        return { success: false, error: e.message };
    }
}

async function findTrackerTicket(id: number) {
    const legacy = await db.supportTicket.findFirst({
        where: {
            legacySystemIssueId: id,
            origin: { in: ["FEEDBACK", "INTERNAL"] },
        },
    });
    if (legacy) return legacy;

    return db.supportTicket.findFirst({
        where: {
            ticketNumber: id,
            origin: { in: ["FEEDBACK", "INTERNAL"] },
        },
    });
}

export async function createSystemIssue(data: {
    type: SystemIssueType;
    category: string;
    priority: string;
    description: string;
    forumLink?: string;
}) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        const created = await db.supportTicket.create({
            data: {
                origin: "INTERNAL",
                category: legacyTypeToCategory(data.type),
                status: "OPEN",
                trackerStatus: "A_FAIRE",
                priority: data.priority || "Normal",
                subject: buildFeedbackSubject(data.category || "Note interne", data.description),
                description: data.description,
                creatorDiscordId: "SYSTEM",
                creatorDiscordName: "Équipe SigilOS",
                creatorUserId: adminId,
                discordGuildId: null,
                guildId: null,
                forumLink: data.forumLink || null,
            },
        });
        await ensurePublicRef(created);

        revalidatePath("/god/bugs");
        revalidatePath("/god");
        return { success: true };
    } catch (e: any) {
        logger.error("[Tracker] Création impossible", { error: e?.message });
        return { success: false, error: e.message };
    }
}

export async function updateSystemIssue(id: number, data: {
    type: SystemIssueType;
    category: string;
    priority: string;
    description: string;
    forumLink?: string;
}) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        const ticket = await findTrackerTicket(id);
        if (!ticket) return { success: false, error: "Signalement introuvable" };

        await db.supportTicket.update({
            where: { id: ticket.id },
            data: {
                category: legacyTypeToCategory(data.type),
                priority: data.priority || "Normal",
                description: data.description,
                subject: buildFeedbackSubject(ticket.feedbackType || data.category || "SIGNALEMENT", data.description),
                forumLink: data.forumLink || null,
            },
        });

        revalidatePath("/god/bugs");
        revalidatePath("/god");
        return { success: true };
    } catch (e: any) {
        logger.error("[Tracker] Mise à jour impossible", { error: e?.message });
        return { success: false, error: e.message };
    }
}

export async function updateSystemIssueStatus(id: number, status: SystemIssueStatus) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        const ticket = await findTrackerTicket(id);
        if (!ticket) return { success: false, error: "Signalement introuvable" };

        const ticketStatus = trackerStatusToTicketStatus(status);
        await db.supportTicket.update({
            where: { id: ticket.id },
            data: {
                trackerStatus: status,
                status: ticketStatus,
                ...(ticketStatus === "CLOSED"
                    ? { closedAt: new Date(), closedBy: "TRACKER" }
                    : { closedAt: null, closedBy: null, closedReason: null }),
            },
        });

        revalidatePath("/god/bugs");
        revalidatePath("/god");
        return { success: true };
    } catch (e: any) {
        logger.error("[Tracker] Changement de statut impossible", { error: e?.message });
        return { success: false, error: e.message };
    }
}

export async function deleteSystemIssue(id: number) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        const ticket = await findTrackerTicket(id);
        if (!ticket) return { success: false, error: "Signalement introuvable" };

        await db.supportTicket.delete({ where: { id: ticket.id } });

        revalidatePath("/god/bugs");
        revalidatePath("/god");
        return { success: true };
    } catch (e: any) {
        logger.error("[Tracker] Suppression impossible", { error: e?.message });
        return { success: false, error: e.message };
    }
}
