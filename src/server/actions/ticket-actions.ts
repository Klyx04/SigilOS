"use server";

/**
 * Support Ticket Actions
 * 
 * Server actions for creating, managing, and closing tickets.
 * Called from the God dashboard and from Discord interactions.
 */

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { revalidatePath } from "next/cache";
import {
    createPrivateThread,
    addUserToThread,
    archiveThread,
    sendChannelMessage
} from "@/server/discord";
import { getAppBaseUrl } from "@/lib/utils";

// =============================================================================
// CONSTANTS
// =============================================================================

const TICKET_CATEGORY_LABELS: Record<string, string> = {
    ACCESS_REQUEST: "🔑 Accès",
    BUG_REPORT: "🐛 Bug",
    FEATURE_REQUEST: "💡 Feature",
    OTHER: "📩 Autre",
};

const TICKET_STATUS_COLORS: Record<string, number> = {
    ACCESS_REQUEST: 0x10b981, // green
    BUG_REPORT: 0xef4444,    // red
    FEATURE_REQUEST: 0x8b5cf6, // purple
    OTHER: 0x6366f1,         // indigo
};

// =============================================================================
// 1. CREATE TICKET (from Discord interaction)
// =============================================================================

interface CreateTicketInput {
    channelId: string;         // Channel where the thread will be created
    discordGuildId: string;    // Discord server ID (support server)
    category: "ACCESS_REQUEST" | "BUG_REPORT" | "FEATURE_REQUEST" | "OTHER";
    subject: string;
    description: string;
    creatorDiscordId: string;
    creatorDiscordName: string;
}

export async function createSupportTicket(input: CreateTicketInput) {
    try {
        // 0. Check for existing open ticket of same category by same user
        const existingTicket = await db.supportTicket.findFirst({
            where: {
                creatorDiscordId: input.creatorDiscordId,
                category: input.category,
                status: { not: "CLOSED" },
            },
        });
        if (existingTicket) {
            const categoryLabels: Record<string, string> = {
                ACCESS_REQUEST: "demande d'accès",
                BUG_REPORT: "bug",
                FEATURE_REQUEST: "feature",
                OTHER: "autre",
            };
            return {
                success: false,
                error: `Vous avez déjà un ticket **${categoryLabels[input.category] || ""}** ouvert (#${existingTicket.ticketNumber}). Fermez-le ou attendez une réponse avant d'en ouvrir un autre.`,
            };
        }

        // 1. Create DB record first to get the ticket number
        const ticket = await db.supportTicket.create({
            data: {
                discordGuildId: input.discordGuildId,
                category: input.category,
                subject: input.subject,
                description: input.description,
                creatorDiscordId: input.creatorDiscordId,
                creatorDiscordName: input.creatorDiscordName,
            },
        });

        // 2. Create private thread
        const threadName = `🎫-${ticket.ticketNumber}-${input.creatorDiscordName}`.substring(0, 100);
        const thread = await createPrivateThread(input.channelId, threadName);

        if (!thread) {
            // Cleanup DB if thread creation fails
            await db.supportTicket.delete({ where: { id: ticket.id } });
            return { success: false, error: "Impossible de créer le fil Discord. Vérifiez les permissions du bot." };
        }

        // 3. Update ticket with thread ID
        await db.supportTicket.update({
            where: { id: ticket.id },
            data: { discordThreadId: thread.id },
        });

        // 4. Add creator to thread
        await addUserToThread(thread.id, input.creatorDiscordId);

        // 5. Post initial embed in thread
        const baseUrl = getAppBaseUrl();
        const categoryLabel = TICKET_CATEGORY_LABELS[input.category] || "📩 Ticket";
        const embedColor = TICKET_STATUS_COLORS[input.category] || 0x6366f1;

        await sendChannelMessage(thread.id, "", {
            embedTitle: `${categoryLabel} — Ticket #${ticket.ticketNumber}`,
            embedColor,
            embedDescription: [
                `**Auteur :** <@${input.creatorDiscordId}>`,
                `**Catégorie :** ${categoryLabel}`,
                `**Sujet :** ${input.subject}`,
                "",
                "**Description :**",
                input.description,
                "",
                "─────────────────────────────",
                "Un membre de l'équipe SigilOS va prendre en charge votre demande.",
                "Vous pouvez ajouter des détails dans ce fil en attendant.",
            ].join("\n"),
            embedFooter: `SigilOS Support · Ticket #${ticket.ticketNumber}`,
            components: [
                {
                    type: 1, // Action Row
                    components: [
                        {
                            type: 2, // Button
                            style: 4, // DANGER (red)
                            label: "Fermer le ticket",
                            emoji: { name: "🔒" },
                            custom_id: `ticket:close:${ticket.id}`,
                        },
                    ],
                },
            ],
        });

        revalidatePath("/god");
        return {
            success: true,
            ticketNumber: ticket.ticketNumber,
            threadId: thread.id,
        };
    } catch (error) {
        console.error("[Tickets] Error creating ticket:", error);
        return { success: false, error: "Erreur lors de la création du ticket." };
    }
}

// =============================================================================
// 2. CLOSE TICKET
// =============================================================================

export async function closeSupportTicket(
    ticketId: string,
    closedByDiscordId: string,
    closedByName: string,
    reason?: string
) {
    try {
        const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) return { success: false, error: "Ticket introuvable." };
        if (ticket.status === "CLOSED") return { success: false, error: "Ticket déjà fermé." };

        // 1. Update DB
        await db.supportTicket.update({
            where: { id: ticketId },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                closedBy: closedByDiscordId,
                closedReason: reason || "Fermé par un membre de l'équipe",
            },
        });

        // 2. Post close message in thread
        if (ticket.discordThreadId) {
            await sendChannelMessage(ticket.discordThreadId, "", {
                embedTitle: "🔒 Ticket Fermé",
                embedColor: 0x71717a, // zinc
                embedDescription: [
                    `Fermé par **${closedByName}**`,
                    reason ? `**Raison :** ${reason}` : "",
                    "",
                    "Ce fil sera archivé. Si vous avez besoin d'aide supplémentaire, ouvrez un nouveau ticket.",
                ].filter(Boolean).join("\n"),
                embedFooter: `SigilOS Support · Ticket #${ticket.ticketNumber}`,
            });

            // 3. Archive + lock the thread
            await archiveThread(ticket.discordThreadId);
        }

        revalidatePath("/god");
        return { success: true };
    } catch (error) {
        console.error("[Tickets] Error closing ticket:", error);
        return { success: false, error: "Erreur lors de la fermeture." };
    }
}

// =============================================================================
// 3. LIST TICKETS (God dashboard)
// =============================================================================

interface TicketFilters {
    status?: "OPEN" | "IN_PROGRESS" | "WAITING_RESPONSE" | "CLOSED";
    category?: "ACCESS_REQUEST" | "BUG_REPORT" | "FEATURE_REQUEST" | "OTHER";
    search?: string;
    page?: number;
    perPage?: number;
}

export async function getSupportTickets(filters: TicketFilters = {}) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { tickets: [], total: 0 };

    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.search) {
        where.OR = [
            { subject: { contains: filters.search, mode: "insensitive" } },
            { creatorDiscordName: { contains: filters.search, mode: "insensitive" } },
            { ticketNumber: isNaN(Number(filters.search)) ? undefined : Number(filters.search) },
        ].filter(Boolean);
    }

    const [tickets, total] = await Promise.all([
        db.supportTicket.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: perPage,
        }),
        db.supportTicket.count({ where }),
    ]);

    return { tickets, total, page, perPage };
}

// =============================================================================
// 4. GET TICKET BY ID
// =============================================================================

export async function getSupportTicketById(id: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;

    return db.supportTicket.findUnique({ where: { id } });
}

// =============================================================================
// 5. UPDATE STATUS (assign, mark in-progress, etc.)
// =============================================================================

export async function updateTicketStatus(
    ticketId: string,
    status: "OPEN" | "IN_PROGRESS" | "WAITING_RESPONSE" | "CLOSED"
) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    await db.supportTicket.update({
        where: { id: ticketId },
        data: {
            status,
            ...(status === "CLOSED" ? { closedAt: new Date() } : {}),
        },
    });

    revalidatePath("/god");
    return { success: true };
}

// =============================================================================
// 6. SEND REPLY VIA BOT (God dashboard → Discord thread)
// =============================================================================

export async function sendTicketReply(ticketId: string, message: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    const session = await auth();

    const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket?.discordThreadId) return { success: false, error: "Thread introuvable" };

    const messageId = await sendChannelMessage(ticket.discordThreadId, "", {
        embedTitle: "💬 Réponse de l'équipe SigilOS",
        embedColor: 0x10b981,
        embedDescription: message,
        embedFooter: `Répondu par ${session?.user?.name || "Admin"} · Ticket #${ticket.ticketNumber}`,
    });

    if (!messageId) return { success: false, error: "Échec de l'envoi Discord" };

    // Mark as waiting response if it was open
    if (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") {
        await db.supportTicket.update({
            where: { id: ticketId },
            data: { status: "WAITING_RESPONSE" },
        });
    }

    revalidatePath("/god");
    return { success: true };
}

// =============================================================================
// 7. STATS (for dashboard header)
// =============================================================================

export async function getTicketStats() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [open, inProgress, closedRecent, total] = await Promise.all([
        db.supportTicket.count({ where: { status: "OPEN" } }),
        db.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
        db.supportTicket.count({ where: { status: "CLOSED", closedAt: { gte: sevenDaysAgo } } }),
        db.supportTicket.count(),
    ]);

    return { open, inProgress, closedRecent, total };
}

// =============================================================================
// 8. POST TICKET PANEL (embed + button in a channel)
// =============================================================================

export async function postTicketPanel(channelId: string, guildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    const messageId = await sendChannelMessage(channelId, "", {
        embedTitle: "📬 Support SigilOS",
        embedColor: 0x10b981,
        embedDescription: [
            "Besoin d'aide ? Ouvrez un ticket et notre équipe vous répondra rapidement.",
            "",
            "**Catégories disponibles :**",
            "🔑 **Demande d'accès** — Rejoindre SigilOS pour votre guilde",
            "🐛 **Bug** — Signaler un problème",
            "💡 **Feature** — Proposer une amélioration",
            "📩 **Autre** — Question générale",
            "",
            "▸ Cliquez sur le bouton ci-dessous pour créer votre ticket.",
        ].join("\n"),
        embedFooter: "SigilOS · Support · Réponse sous 24-48h",
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 1, // PRIMARY (blurple)
                        label: "Ouvrir un ticket",
                        emoji: { name: "🎫" },
                        custom_id: `ticket:open:${guildId}`,
                    },
                ],
            },
        ],
    });

    if (!messageId) return { success: false, error: "Échec de l'envoi du panel." };

    return { success: true, messageId };
}
