"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { isSuperAdmin } from "./super-admin-actions";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import {
    deployTicketPanelMessage,
    createTicketChannelDiscord,
    setMemberChannelPermissionDiscord,
    renameChannelDiscord,
    deleteChannelDiscord,
    fetchChannelMessagesDiscord,
    sendChannelMessage,
} from "@/server/discord";
import { generateHtmlTranscript } from "@/lib/tickets/transcript-engine";

export type ActionResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
};

// =============================================================================
// SCHEMAS
// =============================================================================

const TicketGuildConfigSchema = z.object({
    isEnabled: z.boolean(),
    logChannelId: z.string().nullable().optional(),
    transcriptsChannelId: z.string().nullable().optional(),
    staffRoleIds: z.array(z.string()).default([]),
    maxActiveTicketsPerUser: z.number().min(1).max(10).default(1),
    maxTicketsTotalGuild: z.number().min(5).max(500).default(50),
    enableCsat: z.boolean().default(true),
    enableDmNotifications: z.boolean().default(true),
    enableTranscripts: z.boolean().default(true),
});

const TicketCategorySchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Nom requis"),
    slug: z.string().min(1, "Identifiant requis"),
    description: z.string().nullable().optional(),
    emoji: z.string().nullable().optional(),
    buttonStyle: z.enum(["PRIMARY", "SECONDARY", "SUCCESS", "DANGER"]).default("PRIMARY"),
    channelType: z.enum(["CHANNEL_TEXT", "THREAD_PRIVATE"]).default("CHANNEL_TEXT"),
    channelParentId: z.string().nullable().optional(),
    staffRoleIds: z.array(z.string()).default([]),
    namingPattern: z.string().default("ticket-{num}"),
    formSchemaJson: z.array(z.any()).default([]),
    slaFirstResponseMin: z.number().nullable().optional(),
    slaResolutionMin: z.number().nullable().optional(),
    autoCloseWarningHours: z.number().nullable().optional(),
    autoCloseHours: z.number().nullable().optional(),
    order: z.number().default(0),
    isEnabled: z.boolean().default(true),
});

const TicketPanelSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Nom du panneau requis"),
    channelId: z.string().min(1, "Salon Discord requis"),
    embedTitle: z.string().min(1, "Titre requis"),
    embedDescription: z.string().min(1, "Description requise"),
    embedColor: z.string().default("#6366f1"),
    embedThumbnail: z.string().nullable().optional(),
    embedImage: z.string().nullable().optional(),
    embedFooter: z.string().nullable().optional(),
    style: z.enum(["BUTTONS", "SELECT_MENU"]).default("BUTTONS"),
    categoryIds: z.array(z.string()).min(1, "Au moins une catégorie requise"),
    isActive: z.boolean().default(true),
});

// =============================================================================
// 1. CONFIGURATION GUILDE
// =============================================================================

export async function getTicketGuildConfigAction(guildId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        let config = await db.ticketGuildConfig.findUnique({
            where: { guildId: guildConfig.id },
        });

        if (!config) {
            config = await db.ticketGuildConfig.create({
                data: {
                    guildId: guildConfig.id,
                    isEnabled: true,
                },
            });
        }

        return { success: true, data: config };
    } catch (error: any) {
        logger.error("[getTicketGuildConfigAction] Error:", error);
        return { success: false, error: error?.message || "Erreur de configuration" };
    }
}

export async function updateTicketGuildConfigAction(
    guildId: string,
    data: z.infer<typeof TicketGuildConfigSchema>
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const parsed = TicketGuildConfigSchema.safeParse(data);
        if (!parsed.success) return { success: false, error: "Données invalides" };

        const updated = await db.ticketGuildConfig.upsert({
            where: { guildId: guildConfig.id },
            create: {
                guildId: guildConfig.id,
                ...parsed.data,
            },
            update: {
                ...parsed.data,
            },
        });

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true, data: updated };
    } catch (error: any) {
        logger.error("[updateTicketGuildConfigAction] Error:", error);
        return { success: false, error: error?.message || "Erreur de mise à jour" };
    }
}

// =============================================================================
// 2. CATÉGORIES
// =============================================================================

export async function getTicketCategoriesAction(guildId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const categories = await db.ticketBotCategory.findMany({
            where: { guildId: guildConfig.id },
            orderBy: { order: "asc" },
        });

        return { success: true, data: categories };
    } catch (error: any) {
        logger.error("[getTicketCategoriesAction] Error:", error);
        return { success: false, error: error?.message || "Erreur récupération catégories" };
    }
}

export async function saveTicketCategoryAction(
    guildId: string,
    data: z.infer<typeof TicketCategorySchema>
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const parsed = TicketCategorySchema.safeParse(data);
        if (!parsed.success) return { success: false, error: "Données invalides" };

        const payload = parsed.data;

        let category;
        if (payload.id) {
            category = await db.ticketBotCategory.update({
                where: { id: payload.id, guildId: guildConfig.id },
                data: {
                    name: payload.name,
                    slug: payload.slug,
                    description: payload.description,
                    emoji: payload.emoji,
                    buttonStyle: payload.buttonStyle,
                    channelType: payload.channelType,
                    channelParentId: payload.channelParentId,
                    staffRoleIds: payload.staffRoleIds,
                    namingPattern: payload.namingPattern,
                    formSchemaJson: payload.formSchemaJson,
                    slaFirstResponseMin: payload.slaFirstResponseMin,
                    slaResolutionMin: payload.slaResolutionMin,
                    autoCloseWarningHours: payload.autoCloseWarningHours,
                    autoCloseHours: payload.autoCloseHours,
                    order: payload.order,
                    isEnabled: payload.isEnabled,
                },
            });
        } else {
            category = await db.ticketBotCategory.create({
                data: {
                    guildId: guildConfig.id,
                    name: payload.name,
                    slug: payload.slug,
                    description: payload.description,
                    emoji: payload.emoji,
                    buttonStyle: payload.buttonStyle,
                    channelType: payload.channelType,
                    channelParentId: payload.channelParentId,
                    staffRoleIds: payload.staffRoleIds,
                    namingPattern: payload.namingPattern,
                    formSchemaJson: payload.formSchemaJson,
                    slaFirstResponseMin: payload.slaFirstResponseMin,
                    slaResolutionMin: payload.slaResolutionMin,
                    autoCloseWarningHours: payload.autoCloseWarningHours,
                    autoCloseHours: payload.autoCloseHours,
                    order: payload.order,
                    isEnabled: payload.isEnabled,
                },
            });
        }

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true, data: category };
    } catch (error: any) {
        logger.error("[saveTicketCategoryAction] Error:", error);
        return { success: false, error: error?.message || "Erreur enregistrement catégorie" };
    }
}

export async function deleteTicketCategoryAction(guildId: string, categoryId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.ticketBotCategory.delete({
            where: { id: categoryId, guildId: guildConfig.id },
        });

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true };
    } catch (error: any) {
        logger.error("[deleteTicketCategoryAction] Error:", error);
        return { success: false, error: error?.message || "Erreur suppression catégorie" };
    }
}

// =============================================================================
// 3. PANNEAUX DISCORD
// =============================================================================

export async function getTicketPanelsAction(guildId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const panels = await db.ticketBotPanel.findMany({
            where: { guildId: guildConfig.id },
            orderBy: { createdAt: "desc" },
        });

        return { success: true, data: panels };
    } catch (error: any) {
        logger.error("[getTicketPanelsAction] Error:", error);
        return { success: false, error: error?.message || "Erreur récupération panneaux" };
    }
}

export async function saveTicketPanelAction(
    guildId: string,
    data: z.infer<typeof TicketPanelSchema>
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const parsed = TicketPanelSchema.safeParse(data);
        if (!parsed.success) return { success: false, error: "Données invalides" };

        const payload = parsed.data;

        let panel;
        if (payload.id) {
            panel = await db.ticketBotPanel.update({
                where: { id: payload.id, guildId: guildConfig.id },
                data: {
                    name: payload.name,
                    channelId: payload.channelId,
                    embedTitle: payload.embedTitle,
                    embedDescription: payload.embedDescription,
                    embedColor: payload.embedColor,
                    embedThumbnail: payload.embedThumbnail,
                    embedImage: payload.embedImage,
                    embedFooter: payload.embedFooter,
                    style: payload.style,
                    categoryIds: payload.categoryIds,
                    isActive: payload.isActive,
                },
            });
        } else {
            panel = await db.ticketBotPanel.create({
                data: {
                    guildId: guildConfig.id,
                    name: payload.name,
                    channelId: payload.channelId,
                    embedTitle: payload.embedTitle,
                    embedDescription: payload.embedDescription,
                    embedColor: payload.embedColor,
                    embedThumbnail: payload.embedThumbnail,
                    embedImage: payload.embedImage,
                    embedFooter: payload.embedFooter,
                    style: payload.style,
                    categoryIds: payload.categoryIds,
                    isActive: payload.isActive,
                },
            });
        }

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true, data: panel };
    } catch (error: any) {
        logger.error("[saveTicketPanelAction] Error:", error);
        return { success: false, error: error?.message || "Erreur enregistrement panneau" };
    }
}

export async function deleteTicketPanelAction(guildId: string, panelId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.ticketBotPanel.delete({
            where: { id: panelId, guildId: guildConfig.id },
        });

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true };
    } catch (error: any) {
        logger.error("[deleteTicketPanelAction] Error:", error);
        return { success: false, error: error?.message || "Erreur suppression panneau" };
    }
}

export async function deployTicketPanelAction(guildId: string, panelId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const panel = await db.ticketBotPanel.findUnique({
            where: { id: panelId, guildId: guildConfig.id },
        });
        if (!panel) return { success: false, error: "Panneau introuvable" };

        const categories = await db.ticketBotCategory.findMany({
            where: {
                id: { in: panel.categoryIds },
                guildId: guildConfig.id,
                isEnabled: true,
            },
            orderBy: { order: "asc" },
        });

        if (categories.length === 0) {
            return { success: false, error: "Aucune catégorie active associée à ce panneau" };
        }

        // Build Discord embed
        const hexColor = parseInt(panel.embedColor.replace("#", ""), 16) || 0x6366f1;
        const embed: any = {
            title: panel.embedTitle,
            description: panel.embedDescription,
            color: hexColor,
            footer: panel.embedFooter ? { text: panel.embedFooter } : { text: "SigilOS Tickets" },
            timestamp: new Date().toISOString(),
        };

        if (panel.embedThumbnail) embed.thumbnail = { url: panel.embedThumbnail };
        if (panel.embedImage) embed.image = { url: panel.embedImage };

        // Build components (Buttons or Select Menu)
        let components: any[] = [];
        if (panel.style === "SELECT_MENU") {
            const options = categories.map((c) => ({
                label: c.name,
                value: c.id,
                description: c.description ? c.description.slice(0, 100) : undefined,
                emoji: c.emoji ? { name: c.emoji } : undefined,
            }));

            components = [
                {
                    type: 1, // ACTION_ROW
                    components: [
                        {
                            type: 3, // STRING_SELECT
                            custom_id: `tb:select_open:${panel.id}`,
                            placeholder: "Sélectionnez le motif de votre ticket...",
                            options,
                        },
                    ],
                },
            ];
        } else {
            // BUTTONS (Max 5 buttons per action row)
            const rows: any[] = [];
            let currentRow: any[] = [];

            const styleMap: Record<string, number> = {
                PRIMARY: 1,
                SECONDARY: 2,
                SUCCESS: 3,
                DANGER: 4,
            };

            for (const c of categories) {
                const btn: any = {
                    type: 2, // BUTTON
                    style: styleMap[c.buttonStyle] || 1,
                    label: c.name,
                    custom_id: `tb:open:${panel.id}:${c.id}`,
                };
                if (c.emoji) btn.emoji = { name: c.emoji };

                currentRow.push(btn);
                if (currentRow.length === 5) {
                    rows.push({ type: 1, components: currentRow });
                    currentRow = [];
                }
            }
            if (currentRow.length > 0) {
                rows.push({ type: 1, components: currentRow });
            }
            components = rows;
        }

        const deployRes = await deployTicketPanelMessage(guildId, panel.channelId, {
            messageId: panel.messageId,
            embed,
            components,
        });

        if (!deployRes.success || !deployRes.messageId) {
            return { success: false, error: deployRes.error || "Échec déploiement Discord" };
        }

        // Save Discord message ID
        await db.ticketBotPanel.update({
            where: { id: panel.id },
            data: { messageId: deployRes.messageId },
        });

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true, data: { messageId: deployRes.messageId } };
    } catch (error: any) {
        logger.error("[deployTicketPanelAction] Error:", error);
        return { success: false, error: error?.message || "Erreur déploiement panneau" };
    }
}

// =============================================================================
// 4. TICKETS INBOX & OPERATIONS
// =============================================================================

export async function getTicketRecordsAction(
    guildId: string,
    filters: {
        status?: string;
        categoryId?: string;
        claimedByDiscordId?: string;
        search?: string;
        page?: number;
        perPage?: number;
    } = {}
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const page = Math.max(filters.page || 1, 1);
        const perPage = Math.min(filters.perPage || 30, 100);
        const skip = (page - 1) * perPage;

        const where: any = { guildId: guildConfig.id };

        if (filters.status && filters.status !== "ALL") {
            where.status = filters.status;
        }
        if (filters.categoryId && filters.categoryId !== "ALL") {
            where.categoryId = filters.categoryId;
        }
        if (filters.claimedByDiscordId) {
            where.claimedByDiscordId = filters.claimedByDiscordId;
        }
        if (filters.search) {
            where.OR = [
                { creatorDiscordName: { contains: filters.search, mode: "insensitive" } },
                { creatorDiscordId: { contains: filters.search } },
            ];
        }

        const [tickets, total] = await Promise.all([
            db.ticketRecord.findMany({
                where,
                include: {
                    category: true,
                    notes: { orderBy: { createdAt: "desc" } },
                    feedback: true,
                    transcript: true,
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: perPage,
            }),
            db.ticketRecord.count({ where }),
        ]);

        return {
            success: true,
            data: {
                tickets,
                total,
                page,
                perPage,
                totalPages: Math.ceil(total / perPage),
            },
        };
    } catch (error: any) {
        logger.error("[getTicketRecordsAction] Error:", error);
        return { success: false, error: error?.message || "Erreur récupération tickets" };
    }
}

export async function getTicketRecordAction(guildId: string, ticketId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const ticket = await db.ticketRecord.findUnique({
            where: { id: ticketId, guildId: guildConfig.id },
            include: {
                category: true,
                notes: { orderBy: { createdAt: "asc" } },
                feedback: true,
                transcript: true,
                auditLogs: { orderBy: { createdAt: "desc" } },
            },
        });

        if (!ticket) return { success: false, error: "Ticket introuvable" };

        return { success: true, data: ticket };
    } catch (error: any) {
        logger.error("[getTicketRecordAction] Error:", error);
        return { success: false, error: error?.message || "Erreur récupération ticket" };
    }
}

export async function claimTicketAction(guildId: string, ticketId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const updated = await db.ticketRecord.update({
            where: { id: ticketId, guildId: guildConfig.id },
            data: {
                status: "CLAIMED",
                claimedByDiscordId: user.id || "unknown",
                claimedByName: user.name || "Staff",
                claimedAt: new Date(),
            },
        });

        await db.ticketAuditLog.create({
            data: {
                ticketId,
                guildId: guildConfig.id,
                actorDiscordId: user.id || "unknown",
                actorName: user.name || "Staff",
                action: "CLAIM",
            },
        });

        // Notify in Discord channel if exists
        if (updated.discordChannelId) {
            await sendChannelMessage(
                updated.discordChannelId,
                `🛡️ **${user.name || "Le Staff"}** a pris en charge ce ticket.`
            ).catch(() => {});
        }

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true, data: updated };
    } catch (error: any) {
        logger.error("[claimTicketAction] Error:", error);
        return { success: false, error: error?.message || "Erreur claim ticket" };
    }
}

export async function unclaimTicketAction(guildId: string, ticketId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const updated = await db.ticketRecord.update({
            where: { id: ticketId, guildId: guildConfig.id },
            data: {
                status: "OPEN",
                claimedByDiscordId: null,
                claimedByName: null,
                claimedAt: null,
            },
        });

        await db.ticketAuditLog.create({
            data: {
                ticketId,
                guildId: guildConfig.id,
                actorDiscordId: user.id || "unknown",
                actorName: user.name || "Staff",
                action: "UNCLAIM",
            },
        });

        if (updated.discordChannelId) {
            await sendChannelMessage(
                updated.discordChannelId,
                `🔓 Ce ticket n'est plus assigné et est retourné dans la file générale.`
            ).catch(() => {});
        }

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true, data: updated };
    } catch (error: any) {
        logger.error("[unclaimTicketAction] Error:", error);
        return { success: false, error: error?.message || "Erreur unclaim ticket" };
    }
}

export async function addTicketNoteAction(
    guildId: string,
    ticketId: string,
    content: string
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        if (!content || !content.trim()) {
            return { success: false, error: "Contenu de note vide" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const note = await db.ticketNote.create({
            data: {
                ticketId,
                guildId: guildConfig.id,
                authorDiscordId: user.id || "unknown",
                authorName: user.name || "Staff",
                content: content.trim(),
            },
        });

        await db.ticketAuditLog.create({
            data: {
                ticketId,
                guildId: guildConfig.id,
                actorDiscordId: user.id || "unknown",
                actorName: user.name || "Staff",
                action: "NOTE_ADD",
            },
        });

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true, data: note };
    } catch (error: any) {
        logger.error("[addTicketNoteAction] Error:", error);
        return { success: false, error: error?.message || "Erreur ajout note" };
    }
}

export async function closeTicketAction(
    guildId: string,
    ticketId: string,
    reason?: string
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, name: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const ticket = await db.ticketRecord.findUnique({
            where: { id: ticketId, guildId: guildConfig.id },
            include: {
                category: true,
                notes: true,
            },
        });
        if (!ticket) return { success: false, error: "Ticket introuvable" };

        const ticketConfig = await db.ticketGuildConfig.findUnique({
            where: { guildId: guildConfig.id },
        });

        // 1. Generate Transcript if enabled
        if (ticketConfig?.enableTranscripts !== false) {
            let discordMessages: any[] = [];
            if (ticket.discordChannelId) {
                discordMessages = await fetchChannelMessagesDiscord(ticket.discordChannelId, 100);
            }

            const formattedMessages: any[] = discordMessages.map((m) => ({
                id: m.id,
                authorId: m.author.id,
                authorName: m.author.global_name || m.author.username,
                authorAvatar: m.author.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png` : null,
                isBot: m.author.bot,
                content: m.content || "",
                createdAt: m.timestamp,
                attachments: m.attachments?.map((a: any) => ({
                    url: a.url,
                    name: a.filename,
                    isImage: a.content_type?.startsWith("image/"),
                })),
            }));

            // Include internal notes
            for (const note of ticket.notes) {
                formattedMessages.push({
                    id: note.id,
                    authorId: note.authorDiscordId,
                    authorName: note.authorName,
                    authorAvatar: null,
                    isStaff: true,
                    isInternalNote: true,
                    content: note.content,
                    createdAt: note.createdAt as any,
                });
            }

            // Sort chronologically
            formattedMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const html = generateHtmlTranscript(
                {
                    ticketNumber: ticket.ticketNumber,
                    categoryName: ticket.category?.name || "Support",
                    guildName: guildConfig.name,
                    creatorName: ticket.creatorDiscordName,
                    creatorId: ticket.creatorDiscordId,
                    claimedByName: ticket.claimedByName,
                    openedAt: ticket.createdAt,
                    closedAt: new Date(),
                    closedByName: user.name || "Staff",
                    closedReason: reason,
                    intakeAnswers: (ticket.intakeAnswersJson as any) || undefined,
                },
                formattedMessages
            );

            await db.ticketTranscript.upsert({
                where: { ticketId: ticket.id },
                create: {
                    ticketId: ticket.id,
                    guildId: guildConfig.id,
                    secretToken: crypto.randomUUID().replace(/-/g, ""),
                    storageRef: html,
                    messageCount: formattedMessages.length,
                    sizeBytes: Buffer.byteLength(html, "utf-8"),
                },
                update: {
                    storageRef: html,
                    messageCount: formattedMessages.length,
                    sizeBytes: Buffer.byteLength(html, "utf-8"),
                },
            });
        }

        // 2. Update Ticket record
        const updated = await db.ticketRecord.update({
            where: { id: ticket.id },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                closedByDiscordId: user.id || "unknown",
                closedByName: user.name || "Staff",
                closedReason: reason || "Fermé par le Staff",
            },
        });

        await db.ticketAuditLog.create({
            data: {
                ticketId,
                guildId: guildConfig.id,
                actorDiscordId: user.id || "unknown",
                actorName: user.name || "Staff",
                action: "CLOSE",
                detailsJson: { reason },
            },
        });

        // 3. Delete / Archive Discord channel
        if (ticket.discordChannelId) {
            void deleteChannelDiscord(ticket.discordChannelId).catch(() => {});
        }

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true, data: updated };
    } catch (error: any) {
        logger.error("[closeTicketAction] Error:", error);
        return { success: false, error: error?.message || "Erreur clôture ticket" };
    }
}

export async function renameTicketAction(
    guildId: string,
    ticketId: string,
    newName: string
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const ticket = await db.ticketRecord.findUnique({
            where: { id: ticketId, guildId: guildConfig.id },
        });
        if (!ticket) return { success: false, error: "Ticket introuvable" };

        if (ticket.discordChannelId) {
            await renameChannelDiscord(ticket.discordChannelId, newName);
        }

        await db.ticketAuditLog.create({
            data: {
                ticketId,
                guildId: guildConfig.id,
                actorDiscordId: user.id || "unknown",
                actorName: user.name || "Staff",
                action: "RENAME",
                detailsJson: { newName },
            },
        });

        revalidatePath(`/dashboard/${guildId}/tickets`);
        return { success: true };
    } catch (error: any) {
        logger.error("[renameTicketAction] Error:", error);
        return { success: false, error: error?.message || "Erreur renommage" };
    }
}

// =============================================================================
// 5. STATS & ANALYTICS
// =============================================================================

export async function getTicketStatsAction(guildId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageTickets && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const [openCount, claimedCount, closedCount, totalCount, feedbacks] = await Promise.all([
            db.ticketRecord.count({ where: { guildId: guildConfig.id, status: "OPEN" } }),
            db.ticketRecord.count({ where: { guildId: guildConfig.id, status: "CLAIMED" } }),
            db.ticketRecord.count({ where: { guildId: guildConfig.id, status: "CLOSED" } }),
            db.ticketRecord.count({ where: { guildId: guildConfig.id } }),
            db.ticketFeedback.findMany({
                where: { guildId: guildConfig.id },
                select: { rating: true },
            }),
        ]);

        const avgCsat =
            feedbacks.length > 0
                ? Number((feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1))
                : null;

        return {
            success: true,
            data: {
                openCount,
                claimedCount,
                closedCount,
                totalCount,
                avgCsat,
                feedbackCount: feedbacks.length,
            },
        };
    } catch (error: any) {
        logger.error("[getTicketStatsAction] Error:", error);
        return { success: false, error: error?.message || "Erreur statistiques" };
    }
}

// =============================================================================
// 6. GOD SUPER-ADMIN FLEET
// =============================================================================

export async function getGodTicketBotFleetAction(): Promise<ActionResponse> {
    try {
        const isGod = await isSuperAdmin();
        if (!isGod) return { success: false, error: "Accès SuperAdmin requis" };

        const [guildConfigs, totalOpenTickets, totalTranscripts, totalFeedback] = await Promise.all([
            db.guildConfig.findMany({
                select: {
                    id: true,
                    discordGuildId: true,
                    name: true,
                    iconUrl: true,
                    ticketConfig: true,
                    _count: {
                        select: {
                            ticketRecords: true,
                            ticketCategories: true,
                            ticketPanels: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            }),
            db.ticketRecord.count({ where: { status: { in: ["OPEN", "CLAIMED"] } } }),
            db.ticketTranscript.count(),
            db.ticketFeedback.findMany({ select: { rating: true } }),
        ]);

        const globalAvgCsat =
            totalFeedback.length > 0
                ? Number((totalFeedback.reduce((a, b) => a + b.rating, 0) / totalFeedback.length).toFixed(1))
                : null;

        return {
            success: true,
            data: {
                guilds: guildConfigs,
                totalOpenTickets,
                totalTranscripts,
                globalAvgCsat,
                totalFeedbackCount: totalFeedback.length,
            },
        };
    } catch (error: any) {
        logger.error("[getGodTicketBotFleetAction] Error:", error);
        return { success: false, error: error?.message || "Erreur récupération flotte" };
    }
}

export async function toggleGodTicketBotModuleAction(
    targetGuildId: string,
    enabled: boolean
): Promise<ActionResponse> {
    try {
        const isGod = await isSuperAdmin();
        if (!isGod) return { success: false, error: "Accès SuperAdmin requis" };

        const guildConfig = await db.guildConfig.findFirst({
            where: { OR: [{ id: targetGuildId }, { discordGuildId: targetGuildId }] },
            select: { id: true, discordGuildId: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.ticketGuildConfig.upsert({
            where: { guildId: guildConfig.id },
            create: {
                guildId: guildConfig.id,
                isEnabled: enabled,
                activatedAt: enabled ? new Date() : null,
            },
            update: {
                isEnabled: enabled,
                activatedAt: enabled ? new Date() : null,
            },
        });

        // Also update GuildModules.tickets
        await db.guildModules.upsert({
            where: { guildId: guildConfig.id },
            create: {
                guildId: guildConfig.id,
                tickets: enabled,
            },
            update: {
                tickets: enabled,
            },
        });

        const { invalidateModuleCache } = await import("./module-actions");
        await invalidateModuleCache(guildConfig.discordGuildId);

        revalidatePath("/god/ticket-bot");
        return { success: true };
    } catch (error: any) {
        logger.error("[toggleGodTicketBotModuleAction] Error:", error);
        return { success: false, error: error?.message || "Erreur toggle module" };
    }
}

// =============================================================================
// 7. INTERNAL DISCORD INTERACTION ENGINE
// =============================================================================

export async function internalHandleTicketCreate(params: {
    discordGuildId: string;
    discordUserId: string;
    discordUserName: string;
    discordUserAvatar?: string | null;
    panelId: string;
    categoryId: string;
    answers?: Record<string, string>;
}): Promise<{ success: boolean; channelId?: string; error?: string }> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: params.discordGuildId },
            include: {
                ticketConfig: true,
            },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const config = guildConfig.ticketConfig;
        if (!config || !config.isEnabled) {
            return { success: false, error: "Le module de support n'est pas activé sur ce serveur." };
        }

        const category = await db.ticketBotCategory.findUnique({
            where: { id: params.categoryId, guildId: guildConfig.id },
        });
        if (!category || !category.isEnabled) {
            return { success: false, error: "Cette catégorie de ticket n'est plus active." };
        }

        // Limit active tickets per user
        const activeUserTickets = await db.ticketRecord.count({
            where: {
                guildId: guildConfig.id,
                creatorDiscordId: params.discordUserId,
                status: { in: ["OPEN", "CLAIMED", "PENDING_USER"] },
            },
        });

        if (activeUserTickets >= config.maxActiveTicketsPerUser) {
            return {
                success: false,
                error: `Vous avez déjà ${activeUserTickets} ticket(s) ouvert(s). Veuillez attendre leur résolution avant d'en ouvrir un nouveau.`,
            };
        }

        // Combine staff roles: category specific + global
        const staffRoles = Array.from(new Set([...config.staffRoleIds, ...category.staffRoleIds])).filter(Boolean);

        // Generate Ticket Record first
        const record = await db.ticketRecord.create({
            data: {
                guildId: guildConfig.id,
                categoryId: category.id,
                discordGuildId: params.discordGuildId,
                creatorDiscordId: params.discordUserId,
                creatorDiscordName: params.discordUserName,
                creatorAvatarUrl: params.discordUserAvatar,
                status: "OPEN",
                intakeAnswersJson: params.answers || {},
            },
        });

        // Compute channel name: ticket-001 or namingPattern
        const channelName = category.namingPattern
            .replace("{num}", String(record.ticketNumber).padStart(4, "0"))
            .replace("{user}", params.discordUserName.slice(0, 10))
            .replace("{category}", category.slug);

        // Create Discord channel
        const channelRes = await createTicketChannelDiscord(params.discordGuildId, channelName, {
            parentId: category.channelParentId,
            creatorDiscordId: params.discordUserId,
            staffRoleIds: staffRoles,
            topic: `Ticket #${record.ticketNumber} — ${category.name} | Demandeur: @${params.discordUserName} (${params.discordUserId})`,
        });

        if (!channelRes.success || !channelRes.channelId) {
            // Delete orphan record
            await db.ticketRecord.delete({ where: { id: record.id } }).catch(() => {});
            return { success: false, error: channelRes.error || "Impossible de créer le salon Discord" };
        }

        // Update record with discordChannelId
        await db.ticketRecord.update({
            where: { id: record.id },
            data: { discordChannelId: channelRes.channelId },
        });

        // Build welcome embed in channel
        const intakeFields = params.answers
            ? Object.entries(params.answers).map(([label, value]) => ({
                  name: `📋 ${label}`,
                  value: String(value).slice(0, 1024) || "*Non renseigné*",
                  inline: false,
              }))
            : [];

        const staffPings = staffRoles.map((rId) => `<@&${rId}>`).join(" ");

        const welcomeEmbed = {
            title: `${category.emoji || "🎫"} Ticket #${record.ticketNumber} — ${category.name}`,
            description: `Bienvenue <@${params.discordUserId}> ! Un membre du staff prendra en charge votre demande dans les plus brefs délais.\n\nMerci de détailler votre besoin si ce n'est pas déjà fait.`,
            color: 0x5865f2,
            fields: [
                { name: "Demandeur", value: `<@${params.discordUserId}>`, inline: true },
                { name: "Catégorie", value: category.name, inline: true },
                { name: "Statut", value: "🟡 En attente de prise en charge", inline: true },
                ...intakeFields,
            ],
            footer: { text: "SigilOS Ticket System" },
            timestamp: new Date().toISOString(),
        };

        const actionButtons = [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2,
                        style: 3, // SUCCESS
                        label: "Prendre en charge",
                        custom_id: `tb:claim:${record.id}`,
                        emoji: { name: "🛡️" },
                    },
                    {
                        type: 2,
                        style: 2, // SECONDARY
                        label: "Note interne",
                        custom_id: `tb:note:${record.id}`,
                        emoji: { name: "🔒" },
                    },
                    {
                        type: 2,
                        style: 2, // SECONDARY
                        label: "Renommer",
                        custom_id: `tb:rename:${record.id}`,
                        emoji: { name: "✏️" },
                    },
                    {
                        type: 2,
                        style: 4, // DANGER
                        label: "Fermer le ticket",
                        custom_id: `tb:close:${record.id}`,
                        emoji: { name: "🔒" },
                    },
                ],
            },
        ];

        // Send welcome message in ticket channel
        const { fetchWithRetry, DISCORD_USER_AGENT } = await import("@/server/discord");
        const token = process.env.DISCORD_BOT_TOKEN;
        if (token) {
            await fetchWithRetry(`/api/v10/channels/${channelRes.channelId}/messages`, {
                method: "POST",
                headers: {
                    Authorization: `Bot ${token}`,
                    "Content-Type": "application/json",
                    "User-Agent": DISCORD_USER_AGENT,
                },
                body: JSON.stringify({
                    content: staffPings ? `🔔 Notification Staff: ${staffPings}` : undefined,
                    embeds: [welcomeEmbed],
                    components: actionButtons,
                }),
            }).catch(() => {});
        }

        return { success: true, channelId: channelRes.channelId };
    } catch (error: any) {
        logger.error("[internalHandleTicketCreate] Error:", error);
        return { success: false, error: error?.message || "Erreur création ticket" };
    }
}

export async function internalHandleTicketClaim(params: {
    discordGuildId: string;
    discordUserId: string;
    discordUserName: string;
    ticketId: string;
}): Promise<{ success: boolean; message: string }> {
    try {
        const ticket = await db.ticketRecord.findUnique({
            where: { id: params.ticketId },
            include: { guild: true },
        });
        if (!ticket) return { success: false, message: "Ticket introuvable" };

        if (ticket.status === "CLAIMED" && ticket.claimedByDiscordId === params.discordUserId) {
            return { success: true, message: "Vous avez déjà pris en charge ce ticket." };
        }

        await db.ticketRecord.update({
            where: { id: ticket.id },
            data: {
                status: "CLAIMED",
                claimedByDiscordId: params.discordUserId,
                claimedByName: params.discordUserName,
                claimedAt: new Date(),
                firstStaffResponseAt: ticket.firstStaffResponseAt || new Date(),
            },
        });

        await db.ticketAuditLog.create({
            data: {
                ticketId: ticket.id,
                guildId: ticket.guildId,
                actorDiscordId: params.discordUserId,
                actorName: params.discordUserName,
                action: "CLAIM",
            },
        });

        if (ticket.discordChannelId) {
            await sendChannelMessage(
                ticket.discordChannelId,
                `🛡️ **<@${params.discordUserId}>** a pris en charge ce ticket.`
            ).catch(() => {});
        }

        return { success: true, message: `Ticket #${ticket.ticketNumber} pris en charge avec succès !` };
    } catch (error: any) {
        logger.error("[internalHandleTicketClaim] Error:", error);
        return { success: false, message: error?.message || "Erreur claim ticket" };
    }
}

export async function internalHandleTicketAddNote(params: {
    discordGuildId: string;
    discordUserId: string;
    discordUserName: string;
    ticketId: string;
    content: string;
}): Promise<{ success: boolean; message: string }> {
    try {
        const ticket = await db.ticketRecord.findUnique({
            where: { id: params.ticketId },
        });
        if (!ticket) return { success: false, message: "Ticket introuvable" };

        await db.ticketNote.create({
            data: {
                ticketId: ticket.id,
                guildId: ticket.guildId,
                authorDiscordId: params.discordUserId,
                authorName: params.discordUserName,
                content: params.content.trim(),
            },
        });

        await db.ticketAuditLog.create({
            data: {
                ticketId: ticket.id,
                guildId: ticket.guildId,
                actorDiscordId: params.discordUserId,
                actorName: params.discordUserName,
                action: "NOTE_ADD",
            },
        });

        if (ticket.discordChannelId) {
            const { fetchWithRetry, DISCORD_USER_AGENT } = await import("@/server/discord");
            const token = process.env.DISCORD_BOT_TOKEN;
            if (token) {
                await fetchWithRetry(`/api/v10/channels/${ticket.discordChannelId}/messages`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bot ${token}`,
                        "Content-Type": "application/json",
                        "User-Agent": DISCORD_USER_AGENT,
                    },
                    body: JSON.stringify({
                        embeds: [
                            {
                                title: "🔒 Note Interne Staff",
                                description: params.content.trim(),
                                color: 0xf0b232, // Amber
                                footer: { text: `Ajoutée par ${params.discordUserName}` },
                                timestamp: new Date().toISOString(),
                            },
                        ],
                    }),
                }).catch(() => {});
            }
        }

        return { success: true, message: "Note interne enregistrée avec succès." };
    } catch (error: any) {
        logger.error("[internalHandleTicketAddNote] Error:", error);
        return { success: false, message: error?.message || "Erreur note interne" };
    }
}

export async function internalHandleTicketClose(params: {
    discordGuildId: string;
    discordUserId: string;
    discordUserName: string;
    ticketId: string;
    reason?: string;
}): Promise<{ success: boolean; message: string }> {
    try {
        const ticket = await db.ticketRecord.findUnique({
            where: { id: params.ticketId },
            include: {
                category: true,
                notes: true,
                guild: true,
            },
        });
        if (!ticket) return { success: false, message: "Ticket introuvable" };

        const ticketConfig = await db.ticketGuildConfig.findUnique({
            where: { guildId: ticket.guildId },
        });

        // Generate transcript
        if (ticketConfig?.enableTranscripts !== false) {
            let discordMessages: any[] = [];
            if (ticket.discordChannelId) {
                discordMessages = await fetchChannelMessagesDiscord(ticket.discordChannelId, 100);
            }

            const formattedMessages: any[] = discordMessages.map((m) => ({
                id: m.id,
                authorId: m.author.id,
                authorName: m.author.global_name || m.author.username,
                authorAvatar: m.author.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png` : null,
                isBot: m.author.bot,
                content: m.content || "",
                createdAt: m.timestamp,
                attachments: m.attachments?.map((a: any) => ({
                    url: a.url,
                    name: a.filename,
                    isImage: a.content_type?.startsWith("image/"),
                })),
            }));

            for (const note of ticket.notes) {
                formattedMessages.push({
                    id: note.id,
                    authorId: note.authorDiscordId,
                    authorName: note.authorName,
                    authorAvatar: null,
                    isStaff: true,
                    isInternalNote: true,
                    content: note.content,
                    createdAt: note.createdAt as any,
                });
            }

            formattedMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const html = generateHtmlTranscript(
                {
                    ticketNumber: ticket.ticketNumber,
                    categoryName: ticket.category?.name || "Support",
                    guildName: ticket.guild.name,
                    creatorName: ticket.creatorDiscordName,
                    creatorId: ticket.creatorDiscordId,
                    claimedByName: ticket.claimedByName,
                    openedAt: ticket.createdAt,
                    closedAt: new Date(),
                    closedByName: params.discordUserName,
                    closedReason: params.reason,
                    intakeAnswers: (ticket.intakeAnswersJson as any) || undefined,
                },
                formattedMessages
            );

            await db.ticketTranscript.upsert({
                where: { ticketId: ticket.id },
                create: {
                    ticketId: ticket.id,
                    guildId: ticket.guildId,
                    secretToken: crypto.randomUUID().replace(/-/g, ""),
                    storageRef: html,
                    messageCount: formattedMessages.length,
                    sizeBytes: Buffer.byteLength(html, "utf-8"),
                },
                update: {
                    storageRef: html,
                    messageCount: formattedMessages.length,
                    sizeBytes: Buffer.byteLength(html, "utf-8"),
                },
            });
        }

        // Close ticket in DB
        await db.ticketRecord.update({
            where: { id: ticket.id },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                closedByDiscordId: params.discordUserId,
                closedByName: params.discordUserName,
                closedReason: params.reason || "Fermé par le demandeur ou le staff",
            },
        });

        await db.ticketAuditLog.create({
            data: {
                ticketId: ticket.id,
                guildId: ticket.guildId,
                actorDiscordId: params.discordUserId,
                actorName: params.discordUserName,
                action: "CLOSE",
                detailsJson: { reason: params.reason },
            },
        });

        // Send CSAT survey in DM if enabled
        if (ticketConfig?.enableCsat && ticket.creatorDiscordId) {
            const { fetchWithRetry, DISCORD_USER_AGENT } = await import("@/server/discord");
            const token = process.env.DISCORD_BOT_TOKEN;
            if (token) {
                // Open DM channel
                const dmRes = await fetchWithRetry("/api/v10/users/@me/channels", {
                    method: "POST",
                    headers: {
                        Authorization: `Bot ${token}`,
                        "Content-Type": "application/json",
                        "User-Agent": DISCORD_USER_AGENT,
                    },
                    body: JSON.stringify({ recipient_id: ticket.creatorDiscordId }),
                });

                if (dmRes.ok) {
                    const dmChannel = await dmRes.json();
                    await fetchWithRetry(`/api/v10/channels/${dmChannel.id}/messages`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bot ${token}`,
                            "Content-Type": "application/json",
                            "User-Agent": DISCORD_USER_AGENT,
                        },
                        body: JSON.stringify({
                            embeds: [
                                {
                                    title: `⭐ Votre avis sur le Ticket #${ticket.ticketNumber}`,
                                    description: `Votre ticket concernant **${ticket.category.name}** sur **${ticket.guild.name}** vient d'être clôturé.\n\nComment évaluez-vous la prise en charge de votre demande ?`,
                                    color: 0x5865f2,
                                    footer: { text: "SigilOS Feedback" },
                                },
                            ],
                            components: [
                                {
                                    type: 1, // Action Row
                                    components: [1, 2, 3, 4, 5].map((star) => ({
                                        type: 2,
                                        style: 2, // Secondary
                                        label: `${"⭐".repeat(star)}`,
                                        custom_id: `tb:csat:${ticket.id}:${star}`,
                                    })),
                                },
                            ],
                        }),
                    }).catch(() => {});
                }
            }
        }

        // Delete Discord channel
        if (ticket.discordChannelId) {
            void deleteChannelDiscord(ticket.discordChannelId).catch(() => {});
        }

        return { success: true, message: `Ticket #${ticket.ticketNumber} clôturé avec succès.` };
    } catch (error: any) {
        logger.error("[internalHandleTicketClose] Error:", error);
        return { success: false, message: error?.message || "Erreur fermeture ticket" };
    }
}

export async function internalHandleTicketCsat(params: {
    discordUserId: string;
    ticketId: string;
    rating: number;
    comment?: string;
}): Promise<{ success: boolean; message: string }> {
    try {
        const ticket = await db.ticketRecord.findUnique({
            where: { id: params.ticketId },
        });
        if (!ticket) return { success: false, message: "Ticket introuvable" };

        await db.ticketFeedback.upsert({
            where: { ticketId: ticket.id },
            create: {
                ticketId: ticket.id,
                guildId: ticket.guildId,
                creatorDiscordId: params.discordUserId,
                rating: Math.min(Math.max(params.rating, 1), 5),
                comment: params.comment,
            },
            update: {
                rating: Math.min(Math.max(params.rating, 1), 5),
                comment: params.comment,
            },
        });

        return { success: true, message: `Merci pour votre note de ${params.rating} ⭐ ! Votre avis nous aide à nous améliorer.` };
    } catch (error: any) {
        logger.error("[internalHandleTicketCsat] Error:", error);
        return { success: false, message: error?.message || "Erreur enregistrement avis" };
    }
}

