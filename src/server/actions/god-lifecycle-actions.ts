/**
 * 🔒 GOD - Lifecycle Management Server Actions
 * 
 * SECURITY: Super-admin only
 * 
 * Actions:
 * - softDeleteGuild
 * - reactivateGuild
 * - hardDeleteGuild
 * - softDeleteProfile
 * - reactivateProfile
 * - hardDeleteProfile
 * - getSoftDeletedGuilds
 * - getSoftDeletedProfiles
 * - getArchivedProfiles
 * - getPlatformBans
 * - transferGuildOwnership
 * - getGuildOwnerId
 */

'use server';

import { logger } from "@/lib/logger";

import { db } from '@/lib/prisma';
import { isSuperAdmin, canGodAccess, canAccessBrick } from './super-admin-actions';
import { getDisplayName } from "@/lib/display-name";
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

export async function softDeleteGuild(
    guildId: string,
    reason: string,
    graceDays: number = 30
) {
    // Security check
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const session = await auth();
        const adminName = session?.user?.name || "Super Admin";

        const scheduledDeletion = new Date();
        scheduledDeletion.setDate(scheduledDeletion.getDate() + graceDays);

        await db.guildConfig.update({
            where: { id: guildId },
            data: {
                isActive: false,
                deletedAt: new Date(),
                deletionReason: reason,
                scheduledDeletion
            }
        });

        await db.userProfile.updateMany({
            where: { guildId },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
                archiveReason: 'GUILD_DELETED',
                scheduledDeletion
            }
        });

        // NOTIFY GOD (Platform Alert)
        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: reason === 'BOT_REMOVED' ? "🤖 BOT EXPULSÉ" : "🏰 GUILDE DÉSAVOUÉE",
            message: `La guilde "${guildId}" a été marquée pour suppression (Raison: ${reason}).\n👤 Par: **${adminName}**`,
            type: 'SYSTEM',
            success: false,
            ping: reason === 'BOT_REMOVED', // Pinger si le bot est viré (urgent)
            metadata: { guildId, reason, performedBy: adminName, operation: "SOFT_DELETE_GUILD" },
        });

        // revalidatePath handles UI update
        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        logger.error('[GOD] softDeleteGuild error:', error);
        return { success: false, error: 'Failed to soft delete guild' };
    }
}

export async function reactivateGuild(guildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const session = await auth();
        const adminName = session?.user?.name || "Super Admin";

        // Récupérer le nom lisible avant la notif
        const guild = await db.guildConfig.findUnique({
            where: { id: guildId },
            select: { name: true }
        });

        await db.guildConfig.update({
            where: { id: guildId },
            data: {
                isActive: true,
                deletedAt: null,
                deletionReason: null,
                scheduledDeletion: null
            }
        });

        // Also reactivate profiles
        await db.userProfile.updateMany({
            where: {
                guildId,
                archiveReason: 'GUILD_DELETED'
            },
            data: {
                status: 'ACTIVE',
                archivedAt: null,
                archiveReason: null,
                scheduledDeletion: null
            }
        });

        // 🔔 NOTIFY GOD
        const guildName = guild?.name || guildId;
        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: "🏰 Guilde Réactivée",
            message: `La guilde **"${guildName}"** a été réactivée sur la plateforme.\n👤 Par: **${adminName}**`,
            type: "SYSTEM",
            success: true,
            metadata: { guildId, guildName, performedBy: adminName, operation: "REACTIVATE_GUILD" },
        });

        // revalidatePath handles UI update
        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        logger.error('[GOD] reactivateGuild error:', error);
        return { success: false, error: 'Failed to reactivate guild' };
    }
}

export async function hardDeleteGuild(guildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const session = await auth();
        const adminName = session?.user?.name || "Super Admin";

        // 1. Get Discord Guild ID before deleting config
        const guildConfig = await db.guildConfig.findUnique({
            where: { id: guildId },
            select: { discordGuildId: true }
        });

        // 2. Cascade delete configured in schema handles related data
        await db.guildConfig.delete({
            where: { id: guildId }
        });

        // 3. Remove from persistence whitelist (AllowedGuild)
        // This prevents the "Ghost Guild" from reappearing in the GOD Dashboard
        if (guildConfig?.discordGuildId) {
            await db.allowedGuild.deleteMany({
                where: { discordGuildId: guildConfig.discordGuildId }
            });
        }

        // 🔔 NOTIFY GOD
        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: "🗑️ Guilde Supprimée Définitivement",
            message: `La guilde "${guildConfig?.discordGuildId || guildId}" a été supprimée définitivement de la plateforme.\n👤 Par: **${adminName}**`,
            type: "SYSTEM",
            success: false,
            metadata: { guildId, discordGuildId: guildConfig?.discordGuildId, performedBy: adminName, operation: "HARD_DELETE_GUILD" },
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        logger.error('[GOD] hardDeleteGuild error:', error);
        return { success: false, error: 'Failed to hard delete guild' };
    }
}

export async function softDeleteProfile(
    profileId: string,
    reason: string,
    graceDays: number = 7
) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const session = await auth();
        const adminName = session?.user?.name || "Super Admin";

        const scheduledDeletion = new Date();
        scheduledDeletion.setDate(scheduledDeletion.getDate() + graceDays);

        const profile = await db.userProfile.update({
            where: { id: profileId },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
                archiveReason: reason,
                scheduledDeletion
            }
        });

        // 🔔 NOTIFY GOD
        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: "👤 Profil Archivé (Soft Delete)",
            message: `Le profil "${profileId}" a été marqué pour suppression (Raison: ${reason}, Grace: ${graceDays}j).\n👤 Par: **${adminName}**`,
            type: "SYSTEM",
            success: false,
            metadata: { profileId, reason, performedBy: adminName, scheduledDeletion: scheduledDeletion.toISOString(), operation: "SOFT_DELETE_PROFILE" },
        });

        // revalidatePath handles UI update
        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        logger.error('[GOD] softDeleteProfile error:', error);
        return { success: false, error: 'Failed to soft delete profile' };
    }
}

export async function reactivateProfile(profileId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const session = await auth();
        const adminName = session?.user?.name || "Super Admin";

        const profile = await db.userProfile.update({
            where: { id: profileId },
            data: {
                status: 'ACTIVE',
                archivedAt: null,
                archiveReason: null,
                scheduledDeletion: null
            }
        });

        // 🔔 NOTIFY GOD
        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: "👤 Profil Réactivé",
            message: `Le profil "${profileId}" a été réactivé sur la plateforme.\n👤 Par: **${adminName}**`,
            type: "SYSTEM",
            success: true,
            metadata: { profileId, performedBy: adminName, operation: "REACTIVATE_PROFILE" },
        });

        // revalidatePath handles UI update
        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        logger.error('[GOD] reactivateProfile error:', error);
        return { success: false, error: 'Failed to reactivate profile' };
    }
}

export async function hardDeleteProfile(profileId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const session = await auth();
        const adminName = session?.user?.name || "Super Admin";

        // Get profile data BEFORE delete
        const profile = await db.userProfile.findUnique({
            where: { id: profileId },
            select: { guildId: true }
        });

        if (!profile) {
            return { success: false, error: 'Profile not found' };
        }

        // Skip guild-level audit logging if the action is deemed "God-level stealth"
        // The user specifically mentioned "log des dashboard de guilde".
        // So skip AuditLog.create for guildId if actor is God.
        // This means we intentionally do NOT log this action to the guild's audit log.
        // If we wanted to log it to a *platform-level* audit log, that would be a separate implementation.

        await db.userProfile.delete({
            where: { id: profileId }
        });

        // 🔔 NOTIFY GOD
        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: "👤 Profil Supprimé Définitivement",
            message: `Le profil "${profileId}" a été supprimé définitivement (guilde: ${profile.guildId || "inconnue"}).\n👤 Par: **${adminName}**`,
            type: "SYSTEM",
            success: false,
            metadata: { profileId, guildId: profile.guildId, performedBy: adminName, operation: "HARD_DELETE_PROFILE" },
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        logger.error('[GOD] hardDeleteProfile error:', error);
        return { success: false, error: 'Failed to hard delete profile' };
    }
}

/**
 * Get soft-deleted guilds
 * 🔄 R1 — LECTURE compatible scope "guilds".
 */
export async function getSoftDeletedGuilds() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin && !(await canGodAccess("guilds"))) return [];

    return db.guildConfig.findMany({
        where: {
            isActive: false,
            deletedAt: { not: null }
        },
        orderBy: { scheduledDeletion: 'asc' },
        select: {
            id: true,
            name: true,
            discordGuildId: true,
            isActive: true,
            deletedAt: true,
            deletionReason: true,
            scheduledDeletion: true,
            _count: { select: { profiles: true } }
        }
    });
}

/**
 * Get soft-deleted profiles
 * 🔄 R1 — LECTURE compatible scope "guilds".
 */
export async function getSoftDeletedProfiles() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin && !(await canGodAccess("guilds"))) return [];

    return db.userProfile.findMany({
        where: {
            status: 'ARCHIVED',
            archivedAt: { not: null }
        },
        select: {
            id: true,
            userId: true,
            guildId: true,
            status: true,
            archivedAt: true,
            scheduledDeletion: true,
            guild: { select: { name: true } },
            user: { select: { name: true } }
        },
        orderBy: { scheduledDeletion: 'asc' }
    });
}

/**
 * Get all archived profiles (not just soft-deleted)
 * 🔄 R1 — LECTURE compatible scope "guilds".
 */
export async function getArchivedProfiles() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin && !(await canGodAccess("guilds"))) return [];

    return db.userProfile.findMany({
        where: { status: 'ARCHIVED' },
        select: {
            id: true,
            userId: true,
            guildId: true,
            status: true,
            archivedAt: true,
            scheduledDeletion: true,
            guild: { select: { name: true } },
            user: { select: { name: true } }
        },
        orderBy: { archivedAt: 'desc' },
        take: 100
    });
}

/**
 * Get all active guilds for the control panel
 * 🔄 R1 — LECTURE compatible scope "guilds".
 */
export async function getActiveGuilds() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin && !(await canGodAccess("guilds"))) return [];

    return db.guildConfig.findMany({
        where: { isActive: true },
        include: {
            _count: { select: { profiles: true } }
        },
        orderBy: { name: 'asc' }
    });
}

/**
 * Get all platform-level bans
 * 🔄 R1 — LECTURE compatible scope "guilds".
 */
export async function getPlatformBans() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin && !(await canGodAccess("guilds"))) return [];

    return db.platformBan.findMany({
        select: {
            id: true,
            entityType: true,
            discordId: true,
            reason: true,
            bannedBy: true,
            createdAt: true
        },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Ban an entity (Guild or User) at the platform level
 */
export async function banEntity(type: 'GUILD' | 'USER', discordId: string, reason: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    try {
        const session = await auth();
        await db.platformBan.create({
            data: {
                entityType: type,
                discordId,
                reason,
                bannedBy: session?.user?.id || 'UNKNOWN'
            }
        });

        if (type === 'GUILD') {
            // 1. Désactiver la guilde en base de données
            await db.allowedGuild.updateMany({
                where: { discordGuildId: discordId },
                data: { isActive: false }
            });
            await db.guildConfig.updateMany({
                where: { discordGuildId: discordId },
                data: { isActive: false }
            });

            // 2. Invalider immédiatement les caches Redis pour couper tout accès
            try {
                const { invalidateGuildCache } = await import("./user-actions");
                const { invalidateAllowedGuildCache } = await import("./super-admin-actions");
                await invalidateGuildCache(discordId);
                await invalidateAllowedGuildCache(discordId);
            } catch (cacheErr) {
                logger.warn(`[Ban] Failed to invalidate caches for guild ${discordId}:`, cacheErr);
            }

            // 3. Expulser le bot du serveur Discord
            try {
                const { leaveGuild } = await import("@/server/discord");
                await leaveGuild(discordId);
            } catch (botErr) {
                logger.warn(`[Ban] Failed to force bot to leave guild ${discordId}:`, botErr);
            }
        }

        // 🔔 NOTIFY GOD
        const adminName = session?.user?.name || "Super Admin";
        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: type === 'GUILD' ? "🚫 Guilde Bannie & Bot Expulsé" : "🚫 Utilisateur Banni",
            message: `**${type}** \`${discordId}\` a été banni de la plateforme (Raison: ${reason}).\n👤 Par: **${adminName}**`,
            type: "SYSTEM",
            success: false,
            metadata: { entityType: type, discordId, reason, performedBy: adminName, operation: "BAN_ENTITY" },
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to ban entity' };
    }
}

/**
 * Unban an entity
 */
export async function unbanEntity(banId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    try {
        await db.platformBan.delete({
            where: { id: banId }
        });

        const session = await auth();
        const adminName = session?.user?.name || "Super Admin";
        // 🔔 NOTIFY GOD
        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: "✅ Ban Levé",
            message: `Le ban \`${banId}\` a été levé de la plateforme.\n👤 Par: **${adminName}**`,
            type: "SYSTEM",
            success: true,
            metadata: { banId, performedBy: adminName, operation: "UNBAN_ENTITY" },
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to unban entity' };
    }
}
/**
 * Get all members for a specific guild (God view)
 */
export async function getGuildMembersForGod(guildId: string) {
    const isAdmin = await isSuperAdmin();
    // #108 — un sous-god avec la brique "guilds" (whitelist + roster en lecture seule)
    // accède aussi au roster God.
    const isGuildBrick = isAdmin ? true : await canAccessBrick("guilds");
    if (!isAdmin && !isGuildBrick) throw new Error("Unauthorized");

    const [members, guild] = await Promise.all([
        db.userProfile.findMany({
            where: { guildId },
            select: {
                id: true,
                userId: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                archivedAt: true,
                archiveReason: true,
                pseudoDofus: true,
                discordNickname: true,
                scheduledDeletion: true,
                user: {
                    select: {
                        name: true,
                        image: true,
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    }
                }
            },
            orderBy: { updatedAt: "desc" }
        }),
        db.guildConfig.findUnique({
            where: { id: guildId },
            select: { ownerId: true }
        })
    ]);

    return {
        ownerId: guild?.ownerId,
        members: members.map(m => ({
            id: m.id,
            userId: m.userId,
            status: m.status as "ACTIVE" | "ARCHIVED" | "BANNED",
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt.toISOString(),
            archivedAt: m.archivedAt?.toISOString() || null,
            archiveReason: m.archiveReason,
            pseudoDofus: m.pseudoDofus,
            discordNickname: m.discordNickname,
            scheduledDeletion: m.scheduledDeletion?.toISOString() || null,
            user: {
                name: getDisplayName(m),
                image: m.user.image,
                accounts: m.user.accounts
            }
        }))
    };
}

/**
 * Transfer full ownership of a guild to another user (Super-admin only)
 * #230 — Durcissement : validation du destinataire (membre ACTIF de la guilde),
 * garde contre le no-op (déjà propriétaire) et résolution robuste de la guilde.
 */
export async function transferGuildOwnership(guildId: string, newOwnerUserId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    if (!newOwnerUserId || typeof newOwnerUserId !== "string" || !newOwnerUserId.trim()) {
        return { success: false, error: "Destinataire manquant." };
    }

    try {
        const session = await auth();
        const adminName = session?.user?.name || "Super Admin";

        // Résoudre la guilde en interne (id court = discordGuildId, sinon id interne)
        const guild = await db.guildConfig.findFirst({
            where: {
                id: guildId.length < 25 ? undefined : guildId,
                discordGuildId: guildId.length < 25 ? guildId : undefined
            },
            select: { id: true, name: true, ownerId: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable." };

        // Garde anti no-op
        if (guild.ownerId === newOwnerUserId) {
            return { success: false, error: "Cet utilisateur est déjà propriétaire de la guilde." };
        }

        // Le destinataire doit être un membre ACTIF de cette guilde
        const targetMember = await db.userProfile.findFirst({
            where: { userId: newOwnerUserId, guildId: guild.id, status: "ACTIVE" },
            select: { id: true }
        });
        if (!targetMember) {
            return { success: false, error: "Le destinataire doit être un membre actif de cette guilde." };
        }

        await db.guildConfig.update({
            where: { id: guild.id },
            data: { ownerId: newOwnerUserId }
        });

        // 🔔 NOTIFY GOD
        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: "👑 Propriété Transférée",
            message: `La propriété de la guilde "${guild.name || guildId}" a été transférée.\n👤 Par: **${adminName}**`,
            type: "SYSTEM",
            success: true,
            metadata: { guildId, newOwnerUserId, performedBy: adminName, operation: "TRANSFER_OWNERSHIP" },
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        logger.error('[GOD] transferGuildOwnership error:', error);
        return { success: false, error: 'Failed to transfer ownership' };
    }
}

/**
 * 👑 Augmenter ou modifier la capacité max de membres d'une guilde (Super-admin ou God scope "guilds")
 */
export async function updateGuildMaxMembers(guildId: string, maxMembers: number) {
    const isAdmin = await isSuperAdmin();
    const hasScope = await canGodAccess("guilds");
    if (!isAdmin && !hasScope) return { success: false, error: "Non autorisé" };

    if (isNaN(maxMembers) || maxMembers < 1 || maxMembers > 1000) {
        return { success: false, error: "La capacité doit être comprise entre 1 et 1000 membres." };
    }

    try {
        const session = await auth();
        const adminName = session?.user?.name || "Admin SigilOS";

        const isDiscordId = guildId.length < 25;
        const guild = await db.guildConfig.update({
            where: {
                id: isDiscordId ? undefined : guildId,
                discordGuildId: isDiscordId ? guildId : undefined
            },
            data: { maxMembers }
        });

        const { notifyGod } = await import('./god-notif-actions');
        await notifyGod({
            title: "📈 Capacité de Guilde Modifiée",
            message: `La guilde **"${guild.name}"** a une nouvelle capacité max de **${maxMembers}** membres (précédemment : ${guild.maxMembers}).\n👤 Par : **${adminName}**`,
            type: "SYSTEM",
            success: true,
            metadata: { guildId: guild.id, discordGuildId: guild.discordGuildId, maxMembers, performedBy: adminName, operation: "UPDATE_MAX_MEMBERS" },
        });

        revalidatePath('/god');
        revalidatePath(`/dashboard/${guild.discordGuildId}/admin/members`);
        return { success: true, maxMembers: guild.maxMembers };
    } catch (error) {
        logger.error('[GOD] updateGuildMaxMembers error:', error);
        return { success: false, error: 'Échec de la modification de la capacité' };
    }
}

