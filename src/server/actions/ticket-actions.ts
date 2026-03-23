"use server";

/**
 * Support Ticket Actions
 * 
 * Server actions for creating, managing, and closing tickets.
 * Handles guild validation triggers and Discord integrations.
 */

import { z } from "zod";
import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { isSuperAdmin, isDiscordSuperAdmin } from "@/server/actions/super-admin-actions";
import { revalidatePath } from "next/cache";
import {
    createPrivateThread,
    addUserToThread,
    addRoleToMember,
    archiveThread,
    sendChannelMessage,
    fetchChannel,
    fetchGuildRoles,
    fetchGuildChannels,
    fetchBotGuilds,
} from "@/server/discord";
import { getAppBaseUrl } from "@/lib/utils";

// =============================================================================
// SCHEMAS & CONSTANTS
// =============================================================================

const TicketCategorySchema = z.enum(["ACCESS_REQUEST", "BUG_REPORT", "FEATURE_REQUEST", "OTHER"]);
const TicketStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "WAITING_RESPONSE", "CLOSED"]);

const CreateTicketSchema = z.object({
    channelId: z.string().min(15),
    discordGuildId: z.string().min(15),
    category: TicketCategorySchema,
    subject: z.string().min(2).max(100),
    description: z.string().min(10).max(2000),
    creatorDiscordId: z.string().min(15),
    creatorDiscordName: z.string().min(2),
    // Target metadata for ACCESS_REQUEST
    targetGuildId: z.string().optional(),
    targetGuildName: z.string().optional(),
    targetGuildMemberCount: z.number().int().min(1).max(500).optional(),
});

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

export async function createSupportTicket(input: z.infer<typeof CreateTicketSchema>) {
    const parsed = CreateTicketSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const data = parsed.data;

    try {
        // 1. Double check for duplicate (except CLOSED)
        const existingTicket = await db.supportTicket.findFirst({
            where: {
                creatorDiscordId: data.creatorDiscordId,
                category: data.category,
                status: { not: "CLOSED" },
            },
        });

        if (existingTicket) {
            return {
                success: false,
                error: `⛔ ACCÈS REFUSÉ : Vous avez déjà un ticket ouvert dans la catégorie "${TICKET_CATEGORY_LABELS[data.category]}". \n\n💡 Un seul ticket par catégorie est autorisé simultanément pour éviter le spam. Veuillez fermer le ticket #${existingTicket.ticketNumber} avant d'en ouvrir un nouveau.`,
            };
        }

        // 2. CREATE IN DATABASE (FAST)
        const ticket = await db.supportTicket.create({
            data: {
                discordGuildId: data.discordGuildId,
                category: data.category,
                subject: data.subject,
                description: data.description,
                creatorDiscordId: data.creatorDiscordId,
                creatorDiscordName: data.creatorDiscordName,
                targetGuildId: data.targetGuildId,
                targetGuildName: data.targetGuildName,
                targetGuildMemberCount: data.targetGuildMemberCount,
            },
        });

        // 3. BACKGROUND DISCORD OPERATIONS
        // We do NOT await thread creation to respond to Discord interaction within 3s
        (async () => {
            try {
                const threadName = `🎫-${ticket.ticketNumber}-${data.creatorDiscordName}`.substring(0, 100);
                const thread = await createPrivateThread(data.channelId, threadName);

                if (thread) {
                    await db.supportTicket.update({
                        where: { id: ticket.id },
                        data: { discordThreadId: thread.id },
                    });
                    
                    await addUserToThread(thread.id, data.creatorDiscordId);
                    
                    // Force add all super-admins to the private thread so they can see and answer it
                    const { getSuperAdminIds } = await import("@/server/actions/super-admin-actions");
                    const admins = await getSuperAdminIds();
                    for (const adminId of admins) {
                        try {
                            if (adminId !== data.creatorDiscordId) {
                                await addUserToThread(thread.id, adminId);
                            }
                        } catch(e) {}
                    }

                    const categoryLabel = TICKET_CATEGORY_LABELS[data.category] || "📩 Ticket";
                    const embedColor = TICKET_STATUS_COLORS[data.category] || 0x6366f1;

                    await sendChannelMessage(thread.id, `<@${data.creatorDiscordId}>`, {
                        embedTitle: `${categoryLabel} — Ticket #${ticket.ticketNumber}`,
                        embedColor,
                        embedDescription: [
                            `**Auteur :** <@${data.creatorDiscordId}>`,
                            `**Catégorie :** ${categoryLabel}`,
                            `**Sujet :** ${data.subject}`,
                            "",
                            "**Description :**",
                            data.description,
                            "",
                            "─────────────────────────────",
                            "Un membre de l'équipe SigilOS va prendre en charge votre demande.",
                        ].join("\n"),
                        embedFooter: `SigilOS Support · Ticket #${ticket.ticketNumber}`,
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2, style: 4, label: "Fermer le ticket",
                                        emoji: { name: "🔒" },
                                        custom_id: `ticket:close:${ticket.id}`,
                                    },
                                ],
                            },
                        ],
                    });
                }
            } catch (e) {
                console.error("[Tickets] Async Discord setup failed:", e);
            }
        })();

        revalidatePath("/god");
        return { success: true, ticketNumber: ticket.ticketNumber };
    } catch (error) {
        console.error("[Tickets] Create error:", error);
        return { success: false, error: "Erreur serveur lors de la création." };
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
    // Note: Can be called from Discord button (no session) or Dashboard (session)
    // We trust the discord interaction payload security for the button.

    try {
        const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) return { success: false, error: "Ticket introuvable." };
        if (ticket.status === "CLOSED") return { success: false, error: "Ticket déjà fermé." };

        // RESTRICTION: Only the creator, dev (Super Admin) or System can close the ticket
        const isDev = await isDiscordSuperAdmin(closedByDiscordId);
        const isSystem = closedByDiscordId === "SYSTEM";
        const isCreator = ticket.creatorDiscordId === closedByDiscordId;

        if (!isDev && !isSystem && !isCreator) {
            return { 
                success: false, 
                error: "🔒 Seul l'auteur du ticket ou l'équipe technique SigilOS peut fermer ce ticket." 
            };
        }

        await db.supportTicket.update({
            where: { id: ticketId },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                closedBy: closedByDiscordId,
                closedReason: reason || "Fermé par l'équipe",
            },
        });

        if (ticket.discordThreadId) {
            await sendChannelMessage(ticket.discordThreadId, "", {
                embedTitle: "🔒 Ticket Fermé",
                embedColor: 0x71717a,
                embedDescription: [
                    `Fermé par **${closedByName}**`,
                    reason ? `**Raison :** ${reason}` : "",
                    "",
                    "Ce fil sera archivé. Pour toute autre demande, ouvrez un nouveau ticket.",
                ].filter(Boolean).join("\n"),
                embedFooter: `SigilOS Support · Ticket #${ticket.ticketNumber}`,
            });
            await archiveThread(ticket.discordThreadId);
        }

        revalidatePath("/god");
        return { success: true };
    } catch (error) {
        console.error("[Tickets] Close error:", error);
        return { success: false, error: "Erreur lors de la fermeture." };
    }
}

// =============================================================================
// 2.5 DELETE TICKET
// =============================================================================

export async function deleteSupportTicket(ticketId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) return { success: false, error: "Ticket introuvable." };

        // 1. Delete associated thread if it exists
        if (ticket.discordThreadId) {
            try {
                const { deleteChannel } = await import("@/server/discord");
                await deleteChannel(ticket.discordThreadId);
            } catch (e) {
                console.warn("[Tickets] Failed to delete Discord thread, might already be gone:", e);
            }
        }

        // 2. Delete from DB
        await db.supportTicket.delete({ where: { id: ticketId } });

        revalidatePath("/god");
        return { success: true };
    } catch (error) {
        console.error("[Tickets] Delete error:", error);
        return { success: false, error: "Erreur lors de la suppression." };
    }
}

/**
 * Automatically close tickets waiting for a response for too long (Default: 7 days)
 */
export async function autoCloseStaleTickets(daysThreshold = 7) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

        const staleTickets = await db.supportTicket.findMany({
            where: {
                status: "WAITING_RESPONSE",
                updatedAt: { lt: thresholdDate }
            }
        });

        let closedCount = 0;
        for (const ticket of staleTickets) {
            await closeSupportTicket(
                ticket.id, 
                "SYSTEM", 
                "Automation SigilOS", 
                `Fermeture automatique : aucune réponse de l'utilisateur depuis plus de ${daysThreshold} jours.`
            );
            closedCount++;
        }

        revalidatePath("/god");
        return { success: true, count: closedCount };
    } catch (error) {
        console.error("[Tickets] Auto-close error:", error);
        return { success: false, error: "Erreur lors de la fermeture automatique." };
    }
}

// =============================================================================
// 3. VALIDATE GUILD ACCESS (New Trigger)
// =============================================================================

export async function validateGuildAccess(ticketId: string, discordGuildId: string, notes?: string, roleId?: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) return { success: false, error: "Ticket introuvable" };

        const session = await auth();

        // 1. Refresh ticket data & get platform config (for default role)
        const [freshTicket, platformConfig] = await Promise.all([
            db.supportTicket.findUnique({ where: { id: ticketId } }),
            db.platformConfig.findUnique({ where: { id: "singleton" } })
        ]);
        
        if (!freshTicket) throw new Error("Ticket introuvable");
        const threadId = freshTicket.discordThreadId;

        // 2. Create/Update AllowedGuild record (Whitelist)
        await db.allowedGuild.upsert({
            where: { discordGuildId },
            update: { 
                isActive: true, 
                notes: notes || `Validé via ticket #${freshTicket.ticketNumber} — ${freshTicket.targetGuildName || "Anonyme"}` 
            },
            create: {
                discordGuildId,
                isActive: true,
                name: freshTicket.targetGuildName || null,
                addedBy: session?.user?.id || "SYSTEM",
                notes: notes || `Validé via ticket #${freshTicket.ticketNumber}`,
                tier: "VIP"
            }
        });

        // 3. [ROLE ASSIGNMENT] Use provided role or platform default
        const effectiveRoleId = (roleId && roleId !== "SKIP") 
            ? roleId 
            : (roleId !== "SKIP" ? platformConfig?.ticketAutoRoleId : null);

        if (effectiveRoleId) {
            await addRoleToMember(freshTicket.discordGuildId, freshTicket.creatorDiscordId, effectiveRoleId);
        }

        // 4. Notify on Discord with PING + Mini-Tutorial
        if (threadId) {
            await sendChannelMessage(threadId, `<@${freshTicket.creatorDiscordId}>`, {
                embedTitle: "🚀 Accès Approuvé — Bienvenue sur SigilOS",
                embedColor: 0x10b981,
                embedDescription: [
                    `Bonjour <@${ticket.creatorDiscordId}>,`,
                    "",
                    "Bonne nouvelle ! Votre demande d'accès à **SigilOS** a été validée par notre équipe technique.",
                    "",
                    "**📖 Mini-Guide d'Activation :**",
                    "1️⃣ Connectez-vous sur [sigilos.fr](https://sigilos.fr) via Discord.",
                    "2️⃣ Sur ton Dashboard, clique sur **'Inviter le Bot'** (sur la carte de ta guilde).",
                    "3️⃣ Une fois le bot sur ton serveur, clique sur **'Déployer'** pour installer l'architecture.",
                    "",
                    "💡 *Astuce : Si le bot est déjà présent mais inactif, 'Déployer' suffira à l'allumer.*",
                    "",
                    `**Note de l'administrateur :**`,
                    `> ${notes || "Votre serveur a été ajouté à la whitelist. Bon jeu !"}`
                ].join("\n"),
                embedFooter: `Validé par ${session?.user?.name || "L'Équipe SigilOS"}`,
                embedThumbnail: "https://sigilos.fr/assets/ui/logo-v2.png" // Logo SigilOS
            });
        }

        // 4. [AUDIT] Log for traceability
        await (db as any).auditLog.create({
            data: {
                guildId: "PLATFORM", // Global action
                actorUserId: session?.user?.id || "SYSTEM",
                actorName: session?.user?.name || "System",
                action: "GUILD_VALIDATE",
                targetType: "GUILD",
                targetId: discordGuildId,
                metadata: {
                    ticketId,
                    ticketNumber: ticket.ticketNumber,
                    requesterDiscord: ticket.creatorDiscordName,
                    requesterId: ticket.creatorDiscordId,
                    roleAdded: roleId
                }
            }
        });

        // 5. Mark ticket as CLOSED
        await closeSupportTicket(ticketId, "SYSTEM", "Automation SigilOS", "Accès validé et whiteliste créée.");

        revalidatePath("/god");
        return { success: true };
    } catch (error) {
        console.error("[Tickets] Validation error:", error);
        return { success: false, error: "Échec de la validation de guilde." };
    }
}

/**
 * REJECT GUILD ACCESS
 */
export async function rejectGuildAccess(ticketId: string, reason: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) return { success: false, error: "Ticket introuvable" };

        if (ticket.discordThreadId) {
            await sendChannelMessage(ticket.discordThreadId, `<@${ticket.creatorDiscordId}>`, {
                embedTitle: "❌ Demande d'accès Refusée",
                embedColor: 0xef4444,
                embedDescription: [
                    `Désolé <@${ticket.creatorDiscordId}>,`,
                    "",
                    "Votre demande d'accès à **SigilOS** n'a pas pu être retenue pour le moment.",
                    "",
                    `**Motif du refus :**`,
                    `*${reason || "Non spécifié"}*`,
                    "",
                    "N'hésitez pas à corriger les points soulevés et à soumettre une nouvelle demande plus tard."
                ].join("\n"),
                embedFooter: "SigilOS Support · Notification",
            });
        }

        await closeSupportTicket(ticketId, "SYSTEM", "Automation SigilOS", `Demande refusée : ${reason}`);

        revalidatePath("/god");
        return { success: true };
    } catch (error) {
        console.error("[Tickets] Reject error:", error);
        return { success: false, error: "Erreur lors du rejet." };
    }
}

// =============================================================================
// 4. QUERIES & LISTS
// =============================================================================

interface TicketFilters {
    status?: z.infer<typeof TicketStatusSchema>;
    category?: z.infer<typeof TicketCategorySchema>;
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

export async function getSupportTicketById(id: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;
    return db.supportTicket.findUnique({ where: { id } });
}

export async function updateTicketStatus(
    ticketId: string,
    status: z.infer<typeof TicketStatusSchema>
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

    if (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") {
        await db.supportTicket.update({
            where: { id: ticketId },
            data: { status: "WAITING_RESPONSE" },
        });
    }

    revalidatePath("/god");
    return { success: true };
}

export async function getTicketStats() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [open, inProgress, waitingResponse, closedRecent, total] = await Promise.all([
        db.supportTicket.count({ where: { status: "OPEN" } }),
        db.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
        db.supportTicket.count({ where: { status: "WAITING_RESPONSE" } }),
        db.supportTicket.count({ where: { status: "CLOSED", closedAt: { gte: sevenDaysAgo } } }),
        db.supportTicket.count(),
    ]);

    return { open, inProgress, waitingResponse, closedRecent, total };
}

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
        embedFooter: "SigilOS · Support",
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 1,
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

/**
 * Fetch all guilds the bot is in
 */
export async function getBotGuilds() {
    try {
        const guilds = await fetchBotGuilds();
        return { success: true, guilds };
    } catch (error) {
        console.error("[Tickets] Fetch guilds error:", error);
        return { success: false, error: "Impossible de récupérer les serveurs." };
    }
}

/**
 * Fetch all text channels for a guild
 */
export async function getChannelsForGuild(guildId: string) {
    try {
        const channels = await fetchGuildChannels(guildId);
        // Filter only text channels (type 0) and announcement channels (type 5)
        const filtered = channels.filter(c => c.type === 0 || c.type === 5);
        return { success: true, channels: filtered };
    } catch (error) {
        console.error("[Tickets] Fetch channels error:", error);
        return { success: false, error: "Impossible de récupérer les salons." };
    }
}

/**
 * Fetch all roles for the support guild
 */
export async function getSupportGuildRoles(guildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const roles = await fetchGuildRoles(guildId);
        // Clean up: remove @everyone and managed/bot roles if possible
        const filtered = roles
            .filter(r => r.name !== "@everyone")
            .sort((a, b) => b.position - a.position);

        return { success: true, roles: filtered };
    } catch (error) {
        console.error("[Tickets] Fetch roles error:", error);
        return { success: false, error: "Impossible de récupérer les rôles." };
    }
}
