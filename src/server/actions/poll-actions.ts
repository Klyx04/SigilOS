"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { PERMISSIONS } from "@/lib/permissions";
import { getAppBaseUrl } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkGuildPermission, getUserContext } from "@/server/actions/user-actions";
// Local types to avoid Prisma export issues
type PollCategory = "SUGGESTION" | "AMELIORATION" | "EVENT" | "MISSION" | "AUTRE";
type PollStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED";
import { sendChannelMessage, deleteChannelMessage, validateChannelBelongsToGuild } from "@/server/discord";
import { createAuditLog } from "@/server/actions/audit-actions";
import { getGameDisplayName } from "@/lib/display-name";
import { sanitizeHtml, sanitizeName } from "@/lib/security";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Generates a visual progress bar for Discord embeds.
 */
function getProgressBar(percentage: number, length = 12): string {
    const filledLength = Math.max(0, Math.min(length, Math.round((percentage / 100) * length)));
    const emptyLength = length - filledLength;
    // Using standard Discord emojis for better compatibility
    const filled = "🟩".repeat(filledLength);
    const empty = "⬜".repeat(emptyLength);
    return filled + empty;
}

// --- Types ---

export type ActionResponse<T = unknown> = {
    success: boolean;
    error?: string;
    data?: T;
};

// --- Settings Actions ---

export async function getPollSettings(guildId: string): Promise<ActionResponse<{
    pollsNotifyChannelId: string | null;
    pollsPingRoleIds?: string[];
}>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId, "Lecture des paramètres de Sondage");
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await (db.guildConfig as any).findUnique({
            where: { discordGuildId: guildId },
            select: { pollsNotifyChannelId: true, pollsPingRoleIds: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return {
            success: true,
            data: {
                pollsNotifyChannelId: config.pollsNotifyChannelId,
                pollsPingRoleIds: config.pollsPingRoleIds || []
            }
        };
    } catch (error) {
        logger.error("Get Poll Settings Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Public (member-accessible) poll config.
 * Only exposes what members need: the configured publish channel and whitelisted ping roles.
 * Does NOT expose sensitive admin settings.
 */
export async function getPollPublicConfig(guildId: string): Promise<ActionResponse<{
    pollsNotifyChannelId: string | null;
    pollsPingRoleIds: string[];
}>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // Any authenticated member can call this — we only expose public-safe fields
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        const config = await (db.guildConfig as any).findUnique({
            where: { discordGuildId: guildId },
            select: { pollsNotifyChannelId: true, pollsPingRoleIds: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return {
            success: true,
            data: {
                pollsNotifyChannelId: config.pollsNotifyChannelId,
                pollsPingRoleIds: config.pollsPingRoleIds || []
            }
        };
    } catch (error) {
        logger.error("Get Poll Public Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}


export async function updatePollSettings(
    guildId: string,
    data: { pollsNotifyChannelId: string | null }
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId, "Mise à jour des paramètres de Sondage");
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        // SECURITY: Validate channel (if provided)
        if (data.pollsNotifyChannelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(data.pollsNotifyChannelId, guildId);
            if (!isValidChannel) {
                return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
            }
        }

        await (db as any).guildConfig.update({
            where: { discordGuildId: guildId },
            data: {
                pollsNotifyChannelId: data.pollsNotifyChannelId
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        logger.error("Update Poll Settings Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// --- Zod Schemas ---

const CreatePollSchema = z.object({
    guildId: z.string().min(1),
    title: z.string().min(3).max(200),
    description: z.string().max(2000).optional(),
    category: z.enum(["SUGGESTION", "AMELIORATION", "EVENT", "MISSION", "AUTRE"]),
    options: z.array(z.object({
        label: z.string().min(1).max(200),
        emoji: z.string().max(10).optional(),
    })).min(2).max(10), // Limited to 10 options for better UX
    allowMultipleVotes: z.boolean().default(false),
    isAnonymous: z.boolean().default(false),
    expiresAt: z.string().datetime().optional().nullable(),
    // Discord publish config
    publishToDiscord: z.boolean().default(false),
    discordChannelId: z.string().optional(),
    mentionEveryone: z.boolean().default(false),
    mentionRoleId: z.string().optional(),
    // Multi-role pings (CSV stocké dans mentionRoleId côté BDD, pattern DJ/songes)
    mentionRoleIds: z.array(z.string()).max(10).default([]),
    externalUrl: z.string().url().optional().nullable().or(z.literal("")),
}).strict();

const UpdatePollSchema = z.object({
    pollId: z.string().min(1),
    guildId: z.string().min(1),
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    category: z.enum(["SUGGESTION", "AMELIORATION", "EVENT", "MISSION", "AUTRE"]).optional(),
    allowMultipleVotes: z.boolean().optional(),
    isAnonymous: z.boolean().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
    externalUrl: z.string().url().optional().nullable().or(z.literal("")),
}).strict();

// --- Category Config ---

const POLL_CATEGORY_CONFIG: Record<PollCategory, { label: string; color: number; emoji: string }> = {
    SUGGESTION: {
        label: "💡 Suggestion",
        color: 0x06b6d4,
        emoji: "💡",
    },
    AMELIORATION: {
        label: "🔧 Amélioration",
        color: 0x10b981,
        emoji: "🔧",
    },
    EVENT: {
        label: "🎉 Événement",
        color: 0xf59e0b,
        emoji: "🎉",
    },
    MISSION: {
        label: "🎯 Mission",
        color: 0xef4444,
        emoji: "🎯",
    },
    AUTRE: {
        label: "📋 Autres",
        color: 0x8b5cf6,
        emoji: "📋",
    },
};

// --- Helpers ---

async function canCreatePoll(guildId: string, userId: string): Promise<boolean> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return false;
    if (ctx.isAdmin || ctx.isAdmin) return true;

    // Check SigilOS custom roles
    if (!ctx.profileId) return false;
    const activeGrants = await db.sigilRoleGrant.findMany({
        where: {
            profileId: ctx.profileId,
            role: {
                guild: { discordGuildId: guildId },
                slug: "poll-creator"
            },
            revokedAt: null,
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
            ],
        },
    });
    return activeGrants.length > 0;
}

// Alias for UI/internal use
export async function checkUserHasPollRole(guildId: string, userId: string): Promise<boolean> {
    return canCreatePoll(guildId, userId);
}

/**
 * Checks if a user has created a poll in the same category in the last 7 days.
 * Admins are exempt.
 */
async function checkPollCooldown(guildId: string, profileId: string, category: PollCategory): Promise<{ onCooldown: boolean; resetAt?: Date }> {
    const ctx = await getUserContext(guildId);
    if (ctx.isAdmin || ctx.isAdmin) return { onCooldown: false };

    const lastPoll = await db.poll.findFirst({
        where: {
            creatorId: profileId,
            category,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        },
        orderBy: { createdAt: "desc" }
    });

    if (lastPoll) {
        const resetAt = new Date(lastPoll.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { onCooldown: true, resetAt };
    }

    return { onCooldown: false };
}


async function lazyClosePollsForGuild(guildConfigId: string): Promise<void> {
    try {
        await db.poll.updateMany({
            where: {
                guildId: guildConfigId,
                status: "ACTIVE",
                expiresAt: { lt: new Date() },
            },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
            },
        });
    } catch (e) {
        logger.error("[Polls] Lazy close error", { error: e });
    }
}

// --- Actions ---

export async function getPolls(
    discordGuildId: string,
    filters?: { status?: PollStatus; category?: PollCategory }
): Promise<ActionResponse> {
    const session = await auth();
    const guard = await checkGuildPermission(session, discordGuildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId },
        });

        // Lazy close expired polls
        await lazyClosePollsForGuild(guildConfig.id);

        const where: Record<string, unknown> = { guildId: guildConfig.id };
        if (filters?.status) where.status = filters.status;
        if (filters?.category) where.category = filters.category;

        const polls = await db.poll.findMany({
            where,
            include: {
                options: {
                    include: {
                        _count: { select: { votes: true } },
                    },
                    orderBy: { order: "asc" },
                },
                _count: { select: { options: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return { success: true, data: JSON.parse(JSON.stringify(polls, (_, v) => typeof v === 'bigint' ? v.toString() : v)) };
    } catch (error) {
        logger.error("[Polls] getPolls error", { error, discordGuildId });
        return { success: false, error: "Failed to fetch polls" };
    }
}

export async function getPoll(
    discordGuildId: string,
    pollId: string
): Promise<ActionResponse> {
    const session = await auth();
    const guard = await checkGuildPermission(session, discordGuildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId },
        });

        const poll = await (db as any).poll.findUnique({
            where: { id: pollId },
            include: {
                options: {
                    include: {
                        votes: {
                            include: {
                                voter: {
                                    select: { id: true, pseudoDofus: true, discordNickname: true, userId: true },
                                },
                            },
                        },
                        _count: { select: { votes: true } },
                    },
                    orderBy: { order: "asc" },
                },
            },
        });

        if (!poll) return { success: false, error: "Poll not found" };
        if (poll.guildId !== guildConfig.id) return { success: false, error: "Access denied" };

        // Get user profile to check their votes
        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } },
        });

        const userVotedOptionIds = profile
            ? poll.options
                .filter((o: any) => o.votes.some((v: any) => v.voterId === profile.id))
                .map((o: any) => o.id)
            : [];

        // If anonymous, strip voter info
        const sanitizedPoll = {
            ...poll,
            options: poll.options.map((o: any) => ({
                ...o,
                votes: poll.isAnonymous
                    ? []
                    : o.votes.map((v: any) => ({
                        id: v.id,
                        voterId: v.voterId,
                        voterName: v.voter.pseudoDofus || v.voter.discordNickname || "Membre",
                        createdAt: v.createdAt,
                    })),
                voteCount: o._count.votes,
            })),
            userVotedOptionIds,
            totalVotes: poll.options.reduce((sum: number, o: any) => sum + o._count.votes, 0),
        };

        return { success: true, data: JSON.parse(JSON.stringify(sanitizedPoll, (_, v) => typeof v === 'bigint' ? v.toString() : v)) };
    } catch (error) {
        logger.error("[Polls] getPoll error", { error, pollId });
        return { success: false, error: "Failed to fetch poll" };
    }
}

export async function createPoll(
    rawData: z.infer<typeof CreatePollSchema>
): Promise<ActionResponse<{ pollId: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const validation = CreatePollSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides: " + validation.error.message };
    const data = validation.data;

    const canCreate = await canCreatePoll(data.guildId, session.user.id);
    if (!canCreate) return { success: false, error: "Vous n'avez pas la permission de créer des sondages." };

    // #55 — rate-limit création de sondages (spam anti-discord).
    const rateLimitResult = await rateLimit(`poll:create:${session.user.id}`, 5, 60_000);
    if (!rateLimitResult.success) {
        return { success: false, error: "Trop de sondages créés, réessaie dans une minute." };
    }

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId: data.guildId },
        });

        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } },
        });
        if (!profile) return { success: false, error: "Profil introuvable" };

        // Check cooldown
        const cooldown = await checkPollCooldown(data.guildId, profile.id, data.category as PollCategory);
        if (cooldown.onCooldown) {
            return {
                success: false,
                error: `Limite atteinte : 1 sondage par catégorie par semaine. Disponible le ${cooldown.resetAt?.toLocaleDateString("fr-FR")}`
            };
        }

        const ctx = await getUserContext(data.guildId);
        const creatorName = ctx.name || "Membre";
        const isAdmin = ctx.isAdmin || ctx.isSuperAdmin;

        // 🔒 SECURITY: Enforce channel restriction for non-admins.
        // Members can only publish to the admin-configured channel.
        const adminChannelId = (guildConfig as any).pollsNotifyChannelId as string | null;
        if (data.publishToDiscord && data.discordChannelId && !isAdmin) {
            if (data.discordChannelId !== adminChannelId) {
                logger.error(`[Security] Non-admin tried to publish poll to unauthorized channel. User: ${session.user.id}, channel: ${data.discordChannelId}`);
                return { success: false, error: "Salon non autorisé. Seul l'admin peut choisir un autre salon." };
            }
        }

        // 🔒 SECURITY: Only admins can use @everyone or @here.
        let safeMentionEveryone = data.mentionEveryone;
        if (safeMentionEveryone && !isAdmin) {
            logger.error(`[Security] Non-admin tried to mention @everyone in poll. User: ${session.user.id}`);
            safeMentionEveryone = false;
        }

        // 🔒 SECURITY: Whitelist des rôles de ping appliquée de façon IDENTIQUE
        // aux admins et aux membres (fail-closed, pattern DJ/songes). Chaque rôle
        // doit appartenir à pollsPingRoleIds configuré par l'admin.
        const allowedRoleIds: string[] = (guildConfig as any).pollsPingRoleIds || [];
        const combinedRoleIds = [
            ...(data.mentionRoleIds || []),
            ...(data.mentionRoleId ? [data.mentionRoleId] : []),
        ];
        const uniqueRoleIds = [...new Set(combinedRoleIds)];
        const invalidRoles = uniqueRoleIds.filter((id) => !allowedRoleIds.includes(id));
        if (invalidRoles.length > 0) {
            logger.error(`[Security] Ping de rôle(s) non whitelisté(s) ${invalidRoles.join(", ")}. User: ${session.user.id}`);
        }
        const safeMentionRoleIds = uniqueRoleIds.filter((id) => allowedRoleIds.includes(id));
        // Stocké CSV pour supporter plusieurs rôles (pattern DJ/songes)
        const safeMentionRoleId = safeMentionRoleIds.length > 0 ? safeMentionRoleIds.join(",") : null;

        // Create poll + options in transaction
        const poll = await db.$transaction(async (tx) => {
            // Default expiry: 7 days if not provided
            const finalExpiresAt = data.expiresAt
                ? new Date(data.expiresAt)
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const newPoll = await tx.poll.create({
                data: {
                    guildId: guildConfig.id,
                    title: sanitizeName(data.title, 200) || data.title,
                    description: sanitizeHtml(data.description || null, 2000) || null,
                    category: data.category as PollCategory,
                    status: "ACTIVE",
                    creatorId: profile.id,
                    creatorName,
                    allowMultipleVotes: data.allowMultipleVotes,
                    isAnonymous: data.isAnonymous,
                    expiresAt: finalExpiresAt,
                    mentionEveryone: safeMentionEveryone,
                    mentionRoleId: safeMentionRoleId || null,
                    externalUrl: data.externalUrl || null,
                },
            });

            // Create options
            await tx.pollOption.createMany({
                data: data.options.map((opt, index) => ({
                    pollId: newPoll.id,
                    label: sanitizeName(opt.label, 200) || opt.label,
                    emoji: opt.emoji || null,
                    order: index,
                })),
            });

            return newPoll;
        });

        // Publish to Discord if requested
        const channelToUse = data.discordChannelId || adminChannelId;
        // #102 — le « rôle à mentionner par défaut » est supprimé : seuls les rôles
        // explicitement choisis (et whitelistés) sont mentionnés à la publication.
        const roleToUse = safeMentionEveryone ? undefined : (safeMentionRoleId || undefined);

        if (data.publishToDiscord && !channelToUse) {
            return {
                success: true,
                data: { pollId: poll.id },
                error: "Sondage créé, mais impossible de publier sur Discord : le salon n'est pas configuré dans les paramètres."
            };
        }

        if (data.publishToDiscord && channelToUse) {
            await publishPollToDiscord(
                data.guildId,
                poll.id,
                channelToUse,
                safeMentionEveryone,
                roleToUse || undefined
            );
        }

        // Audit log
        await createAuditLog({
            guildId: data.guildId,
            actorUserId: session.user.id,
            actorName: creatorName,
            action: "POLL_CREATED",
            targetType: "POLL",
            targetId: poll.id,
            metadata: { title: data.title, category: data.category, optionsCount: data.options.length },
        });

        revalidatePath(`/dashboard/${data.guildId}/sondages`);
        return { success: true, data: { pollId: poll.id } };
    } catch (error) {
        logger.error("[Polls] createPoll error", { error, guildId: data.guildId });
        return { success: false, error: "Erreur lors de la création du sondage" };
    }
}

export async function updatePoll(rawData: unknown): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const validation = UpdatePollSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const data = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId: data.guildId },
        });

        const poll = await (db.poll as any).findUnique({
            where: { id: data.pollId },
            include: { options: true }
        });

        if (!poll) return { success: false, error: "Sondage introuvable" };
        
        // 🔒 SECURITY: Multi-tenant isolation check
        if (poll.guildId !== guildConfig.id) {
            logger.error(`[Security] Cross-guild poll update attempt! User ${session.user.id} tried to update poll ${poll.id} from Guild ${guildConfig.id} but poll belongs to ${poll.guildId}`);
            return { success: false, error: "Accès refusé" };
        }

        const ctx = await getUserContext(data.guildId);
        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } },
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        // Permission check: Admin or Creator WITH active Micro
        const isCreator = poll.creatorId === profile.id;
        const hasMicro = await checkUserHasPollRole(data.guildId, session.user.id);

        if (!ctx.isAdmin) {
            if (!isCreator || !hasMicro) {
                return { success: false, error: "Vous devez avoir le micro pour modifier votre sondage." };
            }
        }

        // Only allow editing if the poll is active
        if (poll.status !== "ACTIVE") {
            return { success: false, error: "Impossible de modifier un sondage fermé ou annulé." };
        }

        await (db as any).poll.update({
            where: { id: poll.id },
            data: {
                title: data.title ? sanitizeName(data.title, 200) : undefined,
                description: data.description !== undefined ? sanitizeHtml(data.description || null, 2000) : undefined,
                category: data.category as PollCategory,
                allowMultipleVotes: data.allowMultipleVotes,
                isAnonymous: data.isAnonymous,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : data.expiresAt === null ? null : poll.expiresAt,
                externalUrl: data.externalUrl !== undefined ? (data.externalUrl || null) : undefined,
            }
        });

        // Audit log
        await createAuditLog({
            guildId: data.guildId,
            actorUserId: session.user.id,
            actorName: ctx.name || "Membre",
            action: "POLL_UPDATED" as any,
            targetType: "POLL",
            targetId: poll.id,
            metadata: { title: data.title || poll.title },
        });

        // Sync Discord embed if it exists
        if (poll.discordMessageId && poll.discordChannelId) {
            publishPollToDiscord(
                data.guildId,
                poll.id,
                poll.discordChannelId,
                false,
                undefined,
                true
            ).catch(err => logger.error("[Polls] Failed to sync Discord edit", { error: err }));
        }

        revalidatePath(`/dashboard/${data.guildId}/sondages`);
        revalidatePath(`/dashboard/${data.guildId}/sondages/${poll.id}`);
        return { success: true };
    } catch (error) {
        logger.error("[Polls] updatePoll error", { error });
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

export async function castVote(
    discordGuildId: string,
    optionId: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const guard = await checkGuildPermission(session, discordGuildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    // #55 — rate-limit vote (anti-spam de clics, sync WS).
    const rateLimitResult = await rateLimit(`poll:vote:${session.user.id}:${discordGuildId}`, 30, 60_000);
    if (!rateLimitResult.success) {
        return { success: false, error: "Trop de votes, réessaie dans une minute." };
    }

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId: discordGuildId },
        });

        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } },
        });
        if (!profile) return { success: false, error: "Profil introuvable" };

        return processPollVote(discordGuildId, profile.id, optionId);
    } catch (error) {
        logger.error("[Polls] castVote error", { error, optionId });
        return { success: false, error: "Erreur lors du vote" };
    }
}

export async function processPollVote(
    discordGuildId: string,
    profileId: string,
    optionId: string
): Promise<ActionResponse<{ action: "voted" | "removed" }>> {
    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({ where: { discordGuildId } });

        // Get option + poll
        const option = await db.pollOption.findUnique({
            where: { id: optionId },
            include: { poll: true },
        });
        if (!option) return { success: false, error: "Option introuvable" };
        if (option.poll.guildId !== guildConfig.id) return { success: false, error: "Access denied" };
        if (option.poll.status !== "ACTIVE") return { success: false, error: "Ce sondage n'est plus actif" };

        // Check expiry
        if (option.poll.expiresAt && option.poll.expiresAt < new Date()) {
            await (db as any).poll.update({
                where: { id: option.poll.id },
                data: { status: "CLOSED", closedAt: new Date() },
            });
            return { success: false, error: "Ce sondage a expiré" };
        }

        // Check existing vote on this option
        const existingVote = await db.pollVote.findUnique({
            where: { optionId_voterId: { optionId, voterId: profileId } },
        });

        if (existingVote) {
            // Toggle off (unvote)
            await db.pollVote.delete({ where: { id: existingVote.id } });
            revalidatePath(`/dashboard/${discordGuildId}/sondages`);
            revalidatePath(`/dashboard/${discordGuildId}/sondages/${option.poll.id}`);
            return { success: true, data: { action: "removed" } };
        }

        // If single vote mode, remove any existing vote on OTHER options
        if (!option.poll.allowMultipleVotes) {
            await (db as any).pollVote.deleteMany({
                where: {
                    voterId: profileId,
                    option: { pollId: option.poll.id },
                },
            });
        }

        // Cast vote
        await (db as any).pollVote.create({
            data: { optionId, voterId: profileId },
        });

        revalidatePath(`/dashboard/${discordGuildId}/sondages`);
        revalidatePath(`/dashboard/${discordGuildId}/sondages/${option.poll.id}`);

        // Update Discord Message if it exists
        if (option.poll.discordMessageId && option.poll.discordChannelId) {
            // We use a delayed execution or direct call to avoid blocking the user response
            // For stability, we fetch the latest state inside the sync function
            publishPollToDiscord(
                discordGuildId,
                option.poll.id,
                option.poll.discordChannelId,
                false, // Don't re-mention
                undefined,
                true // Is update
            ).catch(err => logger.error("[Polls] Failed to sync Discord vote", { error: err }));
        }

        return { success: true, data: { action: "voted" } };
    } catch (error) {
        logger.error("[Polls] processPollVote error", { error, optionId, profileId });
        return { success: false, error: "Erreur lors du vote" };
    }
}


export async function closePoll(
    discordGuildId: string,
    pollId: string,
    outcome?: string,
    shouldNotifyDiscord: boolean = true
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({ where: { discordGuildId } });
        const ctx = await getUserContext(discordGuildId);

        const poll = await db.poll.findUnique({
            where: { id: pollId },
            include: { options: { include: { _count: { select: { votes: true } } } } }
        });
        if (!poll) return { success: false, error: "Sondage introuvable" };
        if (poll.guildId !== guildConfig.id) return { success: false, error: "Access denied" };

        // Only admin or poll creator can close
        const isCreator = ctx.profileId === poll.creatorId;
        if (!ctx.isAdmin && !isCreator) return { success: false, error: "Seul l'admin ou le créateur peut fermer ce sondage" };

        await (db as any).poll.update({
            where: { id: pollId },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                outcome: outcome || null
            },
        });

        // 1. Send Outcome to Discord if requested
        if (shouldNotifyDiscord && outcome && poll.discordChannelId) {
            await sendPollOutcomeToDiscord(discordGuildId, poll.id, outcome);
        }

        // 2. Cleanup original Interactive Embed (or update it)
        if (poll.discordMessageId && poll.discordChannelId) {
            await deleteChannelMessage(poll.discordChannelId, poll.discordMessageId).catch(() => null);
        }

        // 3. Notify participants on Dashboard
        if (outcome) {
            await notifyPollParticipants(poll.id, outcome);
        }

        await createAuditLog({
            guildId: discordGuildId,
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "POLL_CLOSED",
            targetType: "POLL",
            targetId: pollId,
            metadata: { title: poll.title, hasOutcome: !!outcome },
        });

        revalidatePath(`/dashboard/${discordGuildId}/sondages`);
        return { success: true };
    } catch (error) {
        logger.error("[Polls] closePoll error", { error, pollId });
        return { success: false, error: "Erreur lors de la fermeture" };
    }
}

async function sendPollOutcomeToDiscord(
    discordGuildId: string,
    pollId: string,
    outcome: string
) {
    const poll = await (db as any).poll.findUnique({
        where: { id: pollId },
        include: {
            options: {
                include: { _count: { select: { votes: true } } }
            }
        }
    });
    if (!poll || !poll.discordChannelId) return;

    const catConfig = POLL_CATEGORY_CONFIG[poll.category as PollCategory];
    const appUrl = getAppBaseUrl();
    const voteUrl = `${appUrl}/dashboard/${discordGuildId}/sondages/${poll.id}`;

    // Calculate results
    const sortedOptions = [...poll.options].sort((a: any, b: any) => b._count.votes - a._count.votes);
    const winner = sortedOptions[0];
    const totalVotes = poll.options.reduce((acc: number, o: any) => acc + o._count.votes, 0);

    const resultsList = poll.options
        .map((o: any) => {
            const votes = o._count.votes || 0;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const bar = getProgressBar(pct, 10);
            return `**${o.emoji || "🔹"} ${o.label}**\n${bar} \`${pct}%\` (${votes} votes)`;
        })
        .join("\n\n");

    const description = `## � Résultats du vote\n\n${resultsList}\n\n---\n\n### 📝 Décision Finale :\n${outcome}\n\n*📌 Retrouvez le détail sur [SigilOS](${voteUrl})*`;

    await sendChannelMessage(poll.discordChannelId, description, {
        embedTitle: `🏁 SONDAGE TERMINÉ : ${poll.title.toUpperCase()}`,
        embedColor: catConfig.color,
        embedFooter: `SigilOS • Résultat acté par un admin`,
        embedUrl: voteUrl,
    });
}

async function notifyPollParticipants(pollId: string, outcome: string) {
    const { createNotification } = await import("./notification-actions");
    const poll = await (db as any).poll.findUnique({
        where: { id: pollId },
        select: { title: true, guildId: true, guild: { select: { discordGuildId: true } } }
    });
    if (!poll) return;

    const voters = await (db as any).pollVote.findMany({
        where: { optionId: { in: (await (db as any).pollOption.findMany({ where: { pollId }, select: { id: true } })).map((o: any) => o.id) } },
        select: { voter: { select: { userId: true } } },
        distinct: ["voterId"]
    });

    const appUrl = getAppBaseUrl();
    const link = `${appUrl}/dashboard/${poll.guild.discordGuildId}/sondages/${pollId}`;

    await Promise.all(voters.map((v: any) =>
        createNotification(
            v.voter.userId,
            "SYSTEM_INFO",
            `🏁 Décision prise : ${poll.title}`,
            `L'admin a clôturé le sondage avec la conclusion suivante : "${outcome.length > 60 ? outcome.substring(0, 57) + "..." : outcome}"`,
            link,
            poll.guild.discordGuildId
        )
    ));
}

export async function deletePoll(
    discordGuildId: string,
    pollId: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const guard = await checkGuildPermission(session, discordGuildId, PERMISSIONS.SYSTEM_CONFIG);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({ where: { discordGuildId } });
        const poll = await (db as any).poll.findUnique({ where: { id: pollId } });
        if (!poll) return { success: false, error: "Sondage introuvable" };
        if (poll.guildId !== guildConfig.id) return { success: false, error: "Access denied" };

        // Cleanup Discord embed
        if (poll.discordMessageId && poll.discordChannelId) {
            await deleteChannelMessage(poll.discordChannelId, poll.discordMessageId);
        }

        await (db as any).poll.delete({ where: { id: pollId } });

        await createAuditLog({
            guildId: discordGuildId,
            actorUserId: session.user.id,
            actorName: (await getUserContext(discordGuildId)).name || "Admin",
            action: "POLL_DELETED",
            targetType: "POLL",
            targetId: pollId,
            metadata: { title: poll.title },
        });

        revalidatePath(`/dashboard/${discordGuildId}/sondages`);
        return { success: true };
    } catch (error) {
        logger.error("[Polls] deletePoll error", { error, pollId });
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

// --- Discord Embed ---

async function publishPollToDiscord(
    discordGuildId: string,
    pollId: string,
    channelId: string,
    mentionEveryone: boolean,
    mentionRoleId?: string,
    isUpdate = false
): Promise<void> {
    try {
        const { updateChannelMessage } = await import("@/server/discord");

        // Security: validate channel belongs to guild (only on initial publish)
        if (!isUpdate) {
            const isValid = await validateChannelBelongsToGuild(channelId, discordGuildId);
            if (!isValid) {
                logger.error("[Polls] Channel does not belong to guild", { channelId, discordGuildId });
                return;
            }
        }

        const poll = await db.poll.findUnique({
            where: { id: pollId },
            include: {
                options: {
                    include: {
                        _count: { select: { votes: true } },
                        votes: {
                            select: {
                                voter: { select: { pseudoDofus: true, discordNickname: true } },
                            },
                            take: 5, // récupère les 5 premiers pour le preview embed
                        },
                    },
                    orderBy: { order: "asc" }
                },
                creator: { include: { user: { select: { image: true } } } }
            },
        });
        if (!poll) return;

        const catConfig = POLL_CATEGORY_CONFIG[poll.category as PollCategory];
        const appUrl = getAppBaseUrl();
        const voteUrl = `${appUrl}/dashboard/${discordGuildId}/sondages/${pollId}`;

        // Calculate total votes
        const totalVotes = poll.options.reduce((acc, opt) => acc + (opt._count.votes || 0), 0);

        // Build options list with progress bars
        // Each option gets a numbered label (e.g. 1️⃣) matching the button below
        const NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

        const optionsList = poll.options
            .map((o: any, i: number) => {
                const votes = o._count.votes || 0;
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                const bar = getProgressBar(pct, 10);
                const prefix = o.emoji ? o.emoji : (NUMBER_EMOJIS[i] || `${i + 1}.`);

                // Affiche les noms des votants pour les sondages non-anonymes
                let votersLine = "";
                if (!poll.isAnonymous && o.votes && o.votes.length > 0) {
                    const names = (o.votes as any[]).slice(0, 3).map((v: any) =>
                        v.voter.pseudoDofus || v.voter.discordNickname || "Membre"
                    );
                    const remaining = votes - (o.votes as any[]).length;
                    const suffix = remaining > 0 ? ` +${remaining} autres` : "";
                    votersLine = `\n👥 *${names.join(", ")}${suffix}*`;
                }

                return `${prefix} **${o.label}**\n${bar} \`${pct}%\` (${votes} vote${votes !== 1 ? 's' : ''})${votersLine}`;
            })
            .join("\n\n");

        const descriptionParts = [];

        if (poll.description) {
            descriptionParts.push(`> *${poll.description}*`);
        }

        if (poll.externalUrl) {
            descriptionParts.push(`🔗 **Source externe :** [Ouvrir le lien ↗](${poll.externalUrl})`);
        }

        descriptionParts.push(`\n**📊 Choix :**\n${optionsList}`);

        const metadata = [];
        if (poll.expiresAt) {
            metadata.push(`⏰ **Expire** — <t:${Math.floor(poll.expiresAt.getTime() / 1000)}:R>`);
        }
        metadata.push(poll.allowMultipleVotes ? "✅ **Votes multiples** — Autorisés" : "👆 **Vote unique** — Un seul choix");

        if (poll.isAnonymous) {
            metadata.push("🕵️ **Anonymat** — Activé");
        }

        descriptionParts.push(`\n---\n${metadata.join(" · ")}`);
        descriptionParts.push(`\n*👉 Clique sur le bouton correspondant à ton choix pour voter !*`);
        descriptionParts.push(`*Seuls les membres de la guilde peuvent voter via [SigilOS](${voteUrl})*`);

        const description = descriptionParts.join("\n");

        // Build mention content (only on first publish)
        let mentionContent: string | undefined;
        if (!isUpdate) {
            if (mentionEveryone) {
                mentionContent = "Bonjour @everyone !";
            } else if (mentionRoleId) {
                if (mentionRoleId === "here") {
                    mentionContent = "Bonjour @here !";
                } else {
                    // Multi-rôles stockés CSV (pattern DJ/songes)
                    const roleMentions = mentionRoleId.split(",").map(id => `<@&${id.trim()}>`).join(" ");
                    mentionContent = `Bonjour ${roleMentions} !`;
                }
            }
        }

        // === BUTTONS ===
        // Discord allows max 5 ActionRows with max 5 buttons each.
        // Strategy: group vote buttons 2 per row → max 5 rows for 10 options.
        // Reserve the last row for the Link button.
        const discordComponents: any[] = [];

        // Build vote buttons — always 2 per ActionRow for visual clarity
        const optionButtons = poll.options.map((o: any, i: number) => {
            const prefix = o.emoji ? o.emoji : (NUMBER_EMOJIS[i] || `${i + 1}.`);
            // Truncate label for Discord button (max 80 chars)
            const rawLabel = `${o.emoji ? '' : (NUMBER_EMOJIS[i] ? '' : `${i + 1}. `)}${o.label}`;
            const truncated = rawLabel.length > 75 ? rawLabel.substring(0, 72) + "..." : rawLabel;
            return {
                type: 2, // Button
                style: 1, // Primary (blurple)
                label: truncated,
                emoji: o.emoji ? { name: o.emoji } : (NUMBER_EMOJIS[i] ? { name: NUMBER_EMOJIS[i] } : undefined),
                custom_id: `poll:vote:${o.id}`,
            };
        });

        // Chunk into rows of 2 buttons each
        const buttonRows: any[] = [];
        for (let i = 0; i < optionButtons.length; i += 2) {
            buttonRows.push({
                type: 1, // ActionRow
                components: optionButtons.slice(i, i + 2)
            });
        }

        // We have max 4 button rows for options + 1 row for link button = 5 total
        // If we overflow (> 4 vote rows), compress last row with link button together
        const linkButton = {
            type: 2,
            style: 5, // Link
            label: "🌐 Résultats & Détails",
            url: voteUrl,
        };

        if (buttonRows.length < 5) {
            // Room for a dedicated link row
            buttonRows.forEach(row => discordComponents.push(row));
            discordComponents.push({ type: 1, components: [linkButton] });
        } else {
            // Overflow: append link button to the last row (it will have ≤2+1=3 buttons — within Discord's limit of 5)
            buttonRows.forEach(row => discordComponents.push(row));
            discordComponents[discordComponents.length - 1].components.push(linkButton);
        }

        const embedOptions = {
            embedTitle: `📊 ${poll.title.toUpperCase()}`,
            embedColor: catConfig.color,
            embedFooter: `SigilOS • ${catConfig.label}`,
            embedAuthor: {
                name: `Sondage lancé par ${poll.creatorName}`,
                iconUrl: (poll.creator as any)?.user?.image || undefined
            },
            // embedUrl intentionnellement absent : évite que le titre de l'embed
            // soit cliquable (confusion avec le lien externe du sondage).
            // La navigation vers le dashboard se fait via le bouton "Résultats & Détails".
            mentionContent,
            components: discordComponents,
        };

        if (isUpdate && poll.discordMessageId && poll.discordChannelId) {
            await updateChannelMessage(poll.discordChannelId, poll.discordMessageId, description, embedOptions);
        } else {
            const messageId = await sendChannelMessage(channelId, description, embedOptions);
            if (messageId) {
                await (db as any).poll.update({
                    where: { id: pollId },
                    data: { discordMessageId: messageId, discordChannelId: channelId },
                });
            }
        }
    } catch (error) {
        logger.error("[Polls] publishToDiscord error", { error, pollId, channelId });
    }
}

export async function publishPollEmbed(
    discordGuildId: string,
    pollId: string,
    channelId: string,
    mentionEveryone: boolean = false,
    mentionRoleId?: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return { success: false, error: "Unauthorized" };

    const guildConfig = await db.guildConfig.findUniqueOrThrow({ where: { discordGuildId } });
    const poll = await db.poll.findUnique({ where: { id: pollId } });
    if (!poll) return { success: false, error: "Sondage introuvable" };
    if (poll.guildId !== guildConfig.id) return { success: false, error: "Access denied" };

    const isCreator = ctx.profileId === poll.creatorId;
    if (!ctx.isAdmin && !isCreator) return { success: false, error: "Permission refusée" };

    await publishPollToDiscord(discordGuildId, pollId, channelId, mentionEveryone, mentionRoleId);
    revalidatePath(`/dashboard/${discordGuildId}/sondages`);
    return { success: true };
}

// --- SigilOS Role Check (exported for UI) ---

export async function checkCanCreatePoll(discordGuildId: string): Promise<ActionResponse<{ canCreate: boolean }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: true, data: { canCreate: false } };

    const ctx = await getUserContext(discordGuildId);
    // In the PIM system, all active members can potentially create a poll 
    // (after acquiring the role), so we show the button to all members.
    return { success: true, data: { canCreate: ctx.isMember } };
}
export async function getMicroStatus(discordGuildId: string): Promise<ActionResponse<{
    holder: { id: string; name: string; image?: string } | null;
    expiresAt?: string;
    isMicroHolder: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
}>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const ctx = await getUserContext(discordGuildId);
        const guildConfig = await db.guildConfig.findUniqueOrThrow({ where: { discordGuildId } });

        const activeGrant = await (db as any).sigilRoleGrant.findFirst({
            where: {
                role: { guildId: guildConfig.id, slug: "poll-creator" },
                revokedAt: null,
                expiresAt: { gt: new Date() }
            },
            include: {
                profile: {
                    include: { user: { select: { image: true, name: true } } }
                }
            }
        });

        if (!activeGrant) return { success: true, data: { holder: null, isMicroHolder: false, isAdmin: ctx.isAdmin, isSuperAdmin: ctx.isSuperAdmin } };

        return {
            success: true,
            data: {
                holder: {
                    id: activeGrant.profileId,
                    name: getGameDisplayName(activeGrant.profile),
                    image: activeGrant.profile.user.image || undefined
                },
                expiresAt: activeGrant.expiresAt?.toISOString(),
                isMicroHolder: activeGrant.profile.userId === session.user.id,
                isAdmin: ctx.isAdmin,
                isSuperAdmin: ctx.isSuperAdmin
            }
        };
    } catch (e) {
        return { success: false, error: "Impossible de récupérer le statut du micro" };
    }
}

export async function acquirePollCreatorRole(discordGuildId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(discordGuildId);
    if (!ctx.profileId) return { success: false, error: "Profil introuvable" };

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({ where: { discordGuildId } });

        // Ensure role exists
        let role = await db.sigilRole.findUnique({
            where: { guildId_slug: { guildId: guildConfig.id, slug: "poll-creator" } }
        });

        if (!role) {
            role = await db.sigilRole.create({
                data: {
                    guildId: guildConfig.id,
                    slug: "poll-creator",
                    label: "Créateur de Sondages",
                    description: "Permet de créer des sondages (Micro de Guilde)",
                    permissions: ["polls:create"],
                    color: "#06b6d4"
                }
            });
        }

        // Check for active holder
        const activeGrant = await (db as any).sigilRoleGrant.findFirst({
            where: {
                roleId: role.id,
                revokedAt: null,
                expiresAt: { gt: new Date() }
            },
            include: { profile: true }
        });

        // Bypass active holder check only for SuperAdmins (GOD Mode)
        if (!ctx.isSuperAdmin && activeGrant) {
            if (activeGrant.profileId === ctx.profileId) {
                return { success: false, error: "Vous avez déjà le micro" };
            }
            const name = activeGrant.profile.pseudoDofus || activeGrant.profile.discordNickname || "Membre";
            return { success: false, error: `Le micro est déjà pris par ${name}` };
        }

        // --- SECURITY: 24h Cooldown (SuperAdmins bypass this) ---
        if (!ctx.isSuperAdmin) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentGrant = await (db as any).sigilRoleGrant.findFirst({
                where: {
                    roleId: role.id,
                    profileId: ctx.profileId,
                    grantedAt: { gt: twentyFourHoursAgo }
                },
                orderBy: { grantedAt: 'desc' }
            });

            if (recentGrant) {
                const diff = Date.now() - new Date(recentGrant.grantedAt).getTime();
                const remainingMs = (24 * 60 * 60 * 1000) - diff;
                const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

                const timeStr = remainingHours > 0
                    ? `${remainingHours}h ${remainingMins}min`
                    : `${remainingMins}min`;

                return {
                    success: false,
                    error: `Sécurité : Cooldown de 24h actif. Disponible dans environ ${timeStr}.`
                };
            }
        }
        // ------------------------------

        // Exclusivity: Revoke any other grants
        await db.sigilRoleGrant.updateMany({
            where: { roleId: role.id, revokedAt: null },
            data: { revokedAt: new Date() }
        });

        // Grant role for 1 hour
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await (db as any).sigilRoleGrant.upsert({
            where: {
                roleId_profileId: {
                    roleId: role.id,
                    profileId: ctx.profileId
                }
            },
            create: {
                roleId: role.id,
                profileId: ctx.profileId,
                grantedBy: ctx.profileId,
                expiresAt,
                revokedAt: null
            },
            update: {
                grantedBy: ctx.profileId,
                grantedAt: new Date(),
                expiresAt,
                revokedAt: null
            }
        });

        // Audit Log
        const actorName = ctx.name || "Membre";
        await createAuditLog({
            guildId: discordGuildId,
            actorUserId: session.user.id,
            actorName,
            action: "POLL_CREATOR_ROLE_ACQUIRED",
            targetType: "ROLE",
            targetId: role.id,
            metadata: {
                roleSlug: "poll-creator",
                duration: "1h",
                reason: "Acquisition du droit de sondage"
            },
        });

        revalidatePath(`/dashboard/${discordGuildId}/sondages`);
        return { success: true };
    } catch (error) {
        logger.error("[Polls] acquirePollCreatorRole error", { error });
        return { success: false, error: "Erreur lors de l'acquisition du rôle" };
    }
}

export async function releasePollCreatorRole(discordGuildId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(discordGuildId);
    if (!ctx.profileId) return { success: false, error: "Profil introuvable" };

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({ where: { discordGuildId } });

        // Revoke the active grant for this profile and role
        // We use updateMany to be safe/simple, scoped to this profile.
        const result = await db.sigilRoleGrant.updateMany({
            where: {
                profileId: ctx.profileId,
                role: { guildId: guildConfig.id, slug: "poll-creator" },
                revokedAt: null
            },
            data: { revokedAt: new Date() }
        });

        if (result.count === 0) {
            return { success: false, error: "Vous n'avez pas le micro actuellement." };
        }

        // Audit Log
        await createAuditLog({
            guildId: discordGuildId,
            actorUserId: session.user.id,
            actorName: ctx.name || "Membre",
            action: "POLL_CREATOR_ROLE_RELEASED" as any,
            targetType: "ROLE",
            targetId: "poll-creator",
            metadata: { reason: "Libération manuelle" },
        });

        revalidatePath(`/dashboard/${discordGuildId}/sondages`);
        return { success: true };
    } catch (error) {
        logger.error("[Polls] releasePollCreatorRole error", { error });
        return { success: false, error: "Erreur lors de la libération du micro" };
    }
}

