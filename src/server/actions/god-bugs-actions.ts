"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import {
    TRACKER_STATUSES,
    buildFeedbackSubject,
    buildMemberTrackerWhere,
    buildTrackerWhere,
    legacyTypeToCategory,
    normalizePagination,
    projectMemberTrackerTicket,
    publicRepliesFromTranscript,
    trackerStatusToTicketStatus,
    type MemberTrackerTicket,
    type TrackerStatusValue,
} from "@/lib/feedback-ticket-mapping";
import { ensurePublicRef } from "@/server/feedback-ticket-service";

const TRACKER_ORIGINS = ["FEEDBACK", "INTERNAL"] as const;
const refSchema = z.string().trim().min(3).max(32).regex(/^SIG-[0-9A-Za-z-]+$/);

const trackerFiltersSchema = z.object({
    page: z.number().int().min(1).max(1000).optional(),
    perPage: z.number().int().min(1).max(100).optional(),
    status: z.enum(TRACKER_STATUSES).optional(),
    origin: z.enum(["FEEDBACK", "INTERNAL"]).optional(),
    feedbackType: z.string().trim().max(40).optional(),
    guild: z.string().trim().max(100).optional(),
    search: z.string().trim().max(100).optional(),
    ref: refSchema.optional(),
});

export type TrackerFiltersInput = z.infer<typeof trackerFiltersSchema>;

const noteSchema = z.object({
    type: z.enum(["BUG", "AMELIORATION"]),
    category: z.string().trim().max(50).optional().default("Divers"),
    priority: z.string().trim().max(20).optional().default("Normal"),
    description: z.string().trim().min(10).max(4000),
    forumLink: z.string().trim().max(500).refine(
        (value) => !value || /^https?:\/\//i.test(value),
        "Lien forum invalide",
    ).optional(),
});

async function isGod() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    return session.user.id;
}

export type TrackerStatsData = {
    total: number;
    open: number;
    resolved: number;
    ignored: number;
    internal: number;
    feedback: number;
};

export type TrackerTicketsResult =
    | {
        success: true;
        data: TrackerTicketRow[];
        total: number;
        page: number;
        perPage: number;
        totalPages: number;
    }
    | { success: false; error: string };

export type TrackerStatsResult =
    | { success: true; data: TrackerStatsData }
    | { success: false; error: string };

export type MemberTrackerStats = {
    total: number;
    open: number;
    resolved: number;
    ignored: number;
};

export type MemberTrackerResult =
    | {
        success: true;
        data: MemberTrackerTicket[];
        total: number;
        page: number;
        perPage: number;
        totalPages: number;
        stats: MemberTrackerStats;
    }
    | { success: false; error: string };

export type TrackerTicketRow = {
    id: number;
    ref: string;
    origin: "FEEDBACK" | "INTERNAL";
    type: "BUG" | "AMELIORATION";
    category: string;
    priority: string;
    description: string;
    status: TrackerStatusValue;
    createdAt: string;
    forumLink: string | null;
    feedbackType: string | null;
    sourcePage: string | null;
    targetSlug: string | null;
    memberName: string | null;
    memberGuildName: string | null;
    replies: { message: string; at: string; emoji: string | null }[];
};

function toTrackerTicketRow(ticket: {
    legacySystemIssueId: number | null;
    ticketNumber: number;
    publicRef: string | null;
    origin: string;
    category: string;
    priority: string | null;
    description: string;
    trackerStatus: TrackerStatusValue | null;
    createdAt: Date;
    forumLink: string | null;
    feedbackType: string | null;
    sourcePage: string | null;
    targetSlug: string | null;
    creatorDiscordName: string;
    memberGuildName: string | null;
    transcript: unknown;
}): TrackerTicketRow {
    return {
        id: ticket.legacySystemIssueId ?? ticket.ticketNumber,
        ref: ticket.publicRef ?? "",
        origin: ticket.origin === "INTERNAL" ? "INTERNAL" : "FEEDBACK",
        type: ticket.category === "BUG_REPORT" ? "BUG" : "AMELIORATION",
        category: ticket.origin === "INTERNAL" ? "Note interne" : (ticket.feedbackType ?? "Signalement"),
        priority: ticket.priority ?? "Normal",
        description: ticket.description,
        status: ticket.trackerStatus ?? "A_FAIRE",
        createdAt: ticket.createdAt.toISOString(),
        forumLink: ticket.forumLink,
        feedbackType: ticket.feedbackType,
        sourcePage: ticket.sourcePage,
        targetSlug: ticket.targetSlug,
        memberName: ticket.creatorDiscordName,
        memberGuildName: ticket.memberGuildName,
        replies: publicRepliesFromTranscript(ticket.transcript),
    };
}

async function findTrackerTicketByRef(ref: string) {
    return db.supportTicket.findFirst({
        where: { publicRef: ref, origin: { in: [...TRACKER_ORIGINS] } },
    });
}

export async function getTrackerTickets(filters: TrackerFiltersInput = {}): Promise<TrackerTicketsResult> {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    const parsed = trackerFiltersSchema.safeParse(filters);
    if (!parsed.success) return { success: false, error: "Filtres invalides" };

    try {
        const pagination = normalizePagination(parsed.data);
        const origin = parsed.data.origin ? parsed.data.origin : [...TRACKER_ORIGINS];
        const where = buildTrackerWhere(parsed.data, origin);
        const [tickets, total] = await Promise.all([
            db.supportTicket.findMany({
                where,
                orderBy: [{ trackerStatus: "asc" }, { createdAt: "desc" }],
                skip: pagination.skip,
                take: pagination.take,
            }),
            db.supportTicket.count({ where }),
        ]);

        return {
            success: true,
            data: tickets.map(toTrackerTicketRow),
            total,
            page: pagination.page,
            perPage: pagination.perPage,
            totalPages: Math.max(1, Math.ceil(total / pagination.perPage)),
        };
    } catch (e: any) {
        logger.error("[Tracker] Lecture God impossible", { error: e?.message });
        return { success: false, error: e.message };
    }
}

export async function getTrackerStats(): Promise<TrackerStatsResult> {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        const [total, open, resolved, ignored, internal, feedback] = await Promise.all([
            db.supportTicket.count({ where: { origin: { in: [...TRACKER_ORIGINS] } } }),
            db.supportTicket.count({
                where: {
                    origin: { in: [...TRACKER_ORIGINS] },
                    trackerStatus: { in: ["A_FAIRE", "A_INVESTIGUER", "EN_COURS"] },
                },
            }),
            db.supportTicket.count({
                where: { origin: { in: [...TRACKER_ORIGINS] }, trackerStatus: "TERMINE" },
            }),
            db.supportTicket.count({
                where: { origin: { in: [...TRACKER_ORIGINS] }, trackerStatus: "IGNORE" },
            }),
            db.supportTicket.count({ where: { origin: "INTERNAL" } }),
            db.supportTicket.count({ where: { origin: "FEEDBACK" } }),
        ]);

        return { success: true, data: { total, open, resolved, ignored, internal, feedback } };
    } catch (e: any) {
        logger.error("[Tracker] Statistiques God impossibles", { error: e?.message });
        return { success: false, error: e.message };
    }
}

export async function createTrackerNote(data: {
    type: "BUG" | "AMELIORATION";
    category: string;
    priority: string;
    description: string;
    forumLink?: string;
}) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    const parsed = noteSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Données invalides" };
    const note = parsed.data;

    try {
        const created = await db.supportTicket.create({
            data: {
                origin: "INTERNAL",
                category: legacyTypeToCategory(note.type),
                status: "OPEN",
                trackerStatus: "A_FAIRE",
                priority: note.priority,
                subject: buildFeedbackSubject(note.category, note.description),
                description: note.description,
                creatorDiscordId: "SYSTEM",
                creatorDiscordName: "Équipe SigilOS",
                creatorUserId: adminId,
                discordGuildId: null,
                guildId: null,
                forumLink: note.forumLink || null,
            },
        });
        const ref = await ensurePublicRef(created);

        revalidatePath("/god/bugs");
        revalidatePath("/god");
        return { success: true, ref };
    } catch (e: any) {
        logger.error("[Tracker] Création impossible", { error: e?.message });
        return { success: false, error: "Impossible de créer la note interne." };
    }
}

export async function updateTrackerTicket(ref: string, data: {
    type: "BUG" | "AMELIORATION";
    category: string;
    priority: string;
    description: string;
    forumLink?: string;
}) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    const parsedRef = refSchema.safeParse(ref);
    if (!parsedRef.success) return { success: false, error: "Référence invalide" };

    const parsed = noteSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Données invalides" };
    const note = parsed.data;

    try {
        const ticket = await findTrackerTicketByRef(parsedRef.data);
        if (!ticket) return { success: false, error: "Signalement introuvable" };

        await db.supportTicket.update({
            where: { id: ticket.id },
            data: {
                category: legacyTypeToCategory(note.type),
                priority: note.priority,
                description: note.description,
                subject: buildFeedbackSubject(ticket.feedbackType || note.category, note.description),
                forumLink: note.forumLink || null,
            },
        });

        revalidatePath("/god/bugs");
        revalidatePath("/god");
        return { success: true };
    } catch (e: any) {
        logger.error("[Tracker] Mise à jour impossible", { error: e?.message });
        return { success: false, error: "Impossible de mettre à jour le signalement." };
    }
}

export async function updateTrackerTicketStatus(ref: string, status: TrackerStatusValue) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };
    if (!TRACKER_STATUSES.includes(status)) return { success: false, error: "Statut invalide" };

    const parsedRef = refSchema.safeParse(ref);
    if (!parsedRef.success) return { success: false, error: "Référence invalide" };

    try {
        const ticket = await findTrackerTicketByRef(parsedRef.data);
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
        return { success: false, error: "Impossible de changer le statut." };
    }
}

export async function deleteTrackerTicket(ref: string) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    const parsedRef = refSchema.safeParse(ref);
    if (!parsedRef.success) return { success: false, error: "Référence invalide" };

    try {
        const ticket = await findTrackerTicketByRef(parsedRef.data);
        if (!ticket) return { success: false, error: "Signalement introuvable" };

        await db.supportTicket.delete({ where: { id: ticket.id } });

        revalidatePath("/god/bugs");
        revalidatePath("/god");
        return { success: true };
    } catch (e: any) {
        logger.error("[Tracker] Suppression impossible", { error: e?.message });
        return { success: false, error: "Impossible de supprimer le signalement." };
    }
}

export async function getMemberTrackerTickets(guildId: string, filters: TrackerFiltersInput = {}): Promise<MemberTrackerResult> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const parsed = trackerFiltersSchema.safeParse(filters);
    if (!parsed.success) return { success: false, error: "Filtres invalides" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const membership = await db.userProfile.findFirst({
            where: {
                guildId: guildConfig.id,
                userId: session.user.id,
                status: "ACTIVE",
            },
            select: { id: true },
        });
        if (!membership) return { success: false, error: "Accès refusé" };

        const pagination = normalizePagination(parsed.data);
        const where = buildMemberTrackerWhere(parsed.data);

        const [tickets, total, grouped] = await Promise.all([
            db.supportTicket.findMany({
                where,
                orderBy: [{ trackerStatus: "asc" }, { createdAt: "desc" }],
                skip: pagination.skip,
                take: pagination.take,
                select: {
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
            }),
            db.supportTicket.count({ where }),
            db.supportTicket.groupBy({
                by: ["trackerStatus"],
                where: { origin: "FEEDBACK" },
                _count: { _all: true },
            }),
        ]);

        const statusCounts: Record<TrackerStatusValue, number> = {
            A_FAIRE: 0,
            A_INVESTIGUER: 0,
            EN_COURS: 0,
            TERMINE: 0,
            IGNORE: 0,
        };
        for (const row of grouped) {
            if (row.trackerStatus && row.trackerStatus in statusCounts) {
                statusCounts[row.trackerStatus as TrackerStatusValue] = row._count._all;
            }
        }

        const data: MemberTrackerTicket[] = tickets.map((ticket) =>
            projectMemberTrackerTicket(ticket, guildConfig.id),
        );

        return {
            success: true,
            data,
            total,
            page: pagination.page,
            perPage: pagination.perPage,
            totalPages: Math.max(1, Math.ceil(total / pagination.perPage)),
            stats: {
                total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
                open: statusCounts.A_FAIRE + statusCounts.A_INVESTIGUER + statusCounts.EN_COURS,
                resolved: statusCounts.TERMINE,
                ignored: statusCounts.IGNORE,
            },
        };
    } catch (e: any) {
        logger.error("[Tracker] Lecture membre impossible", { error: e?.message });
        return { success: false, error: "Impossible de charger le tracker." };
    }
}
