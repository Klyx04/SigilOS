/**
 * Member Lifecycle Actions
 * Server actions for managing archived profiles and RGPD compliance
 */

"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { getUserContext, invalidateUserContextCache } from "./user-actions";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createAuditLog } from "./audit-actions";
import { getDisplayName } from "@/lib/display-name";
import { auth } from "@/auth";
import {
    withdrawMarketListingsForGuildMember,
    withdrawMarketListingsForProfileCore,
} from "@/server/market/lifecycle";

/**
 * Archive a profile (Self-service or Admin)
 */
export async function archiveProfile(guildId: string, profileId?: string, durationMonths?: number) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    const targetProfileId = profileId || ctx.profileId;
    if (!targetProfileId) return { success: false, error: "No profile found" };

    // Security check: Only self or manager can archive
    if (targetProfileId !== ctx.profileId && !ctx.canManageMembers) {
        return { success: false, error: "Forbidden" };
    }

    // 🔒 Prevent archival of the Discord guild owner
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { ownerId: true }
    });

    const targetProfile = await db.userProfile.findUnique({
        where: { id: targetProfileId },
        include: {
            user: {
                include: {
                    accounts: {
                        where: { provider: "discord" },
                        select: { providerAccountId: true }
                    }
                }
            }
        }
    });

    if (targetProfile) {
        const targetDiscordId = targetProfile.user.accounts[0]?.providerAccountId;
        if (guildConfig?.ownerId && targetDiscordId && guildConfig.ownerId === targetDiscordId) {
            return { success: false, error: "Le propriétaire du serveur Discord ne peut pas être archivé. Transférez la propriété sur Discord d'abord." };
        }
    }

    try {
        // Admin Departure Log : Specific high-priority log if an admin leaves
        const userContext = await getUserContext(guildId);
        if (userContext.isAdmin && targetProfileId === ctx.profileId) { // Only log if the admin is archiving their own profile
            await createAuditLog({
                guildId,
                action: "MEMBER_LEFT" as any,
                actorUserId: ctx.id as string,
                actorName: ctx.name ?? "Inconnu",
                targetType: "ADMIN_ACTION" as any,
                metadata: {
                    priority: "HIGH",
                    description: `DÉPART CRITIQUE : L'administrateur ${ctx.name ?? ctx.id} a quitté la guilde.`,
                    impact: "Perte de privilèges administratifs"
                }
            });
        }

        const duration = durationMonths || 12; // Défaut : 12 mois d'archivage automatique
        const days = duration * 30.5;
        const scheduledDeletion = new Date(Date.now() + Math.floor(days * 24 * 60 * 60 * 1000));

        const updatedProfile = await db.userProfile.update({
            where: { id: targetProfileId },
            include: { user: { include: { accounts: { where: { provider: "discord" }, select: { providerAccountId: true } } } } },
            data: {
                status: "ARCHIVED",
                archivedAt: new Date(),
                archiveReason: profileId ? "ADMIN_ACTION" : "USER_LEAVE",
                archiveDuration: duration,
                scheduledDeletion,
                reactivationRequestedAt: null,
                reactivationRequestReason: null,
            }
        });

        // 🔔 Lifecycle Notification — self-archive or admin archive
        const actorName = profileId ? ctx.name ?? "Un administrateur" : undefined;
        await sendLifecycleNotification(guildId, updatedProfile, "ARCHIVED", actorName);

        // ── Chantier #31 : fermer le contenu publié par le membre archivé + embeds Discord ──
        await closeMemberPublishedContent(
            guildId,
            targetProfileId,
            updatedProfile.userId,
            profileId ? "ADMIN_ARCHIVED" : "USER_LEAVE"
        );

        // Invalidate Redis cache to prevent stale restricted access
        await invalidateUserContextCache(
            updatedProfile.userId, 
            updatedProfile.guildId, // Internal UUID
            guildId                 // Discord ID
        );

        await createAuditLog({
            guildId,
            action: "MEMBER_ARCHIVED" as any,
            actorUserId: ctx.id as string,
            actorName: ctx.name ?? "Inconnu",
            targetType: "PROFILE" as any,
            targetId: targetProfileId,
            metadata: {
                description: profileId ? "Archivage administratif" : "Mise en sommeil volontaire",
                reason: profileId ? `Action par ${ctx.name ?? "un admin"}` : "Action utilisateur"
            }
        });

        revalidatePath(`/dashboard/${guildId}`, "layout");
        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (e) {
        logger.error("Archive error:", e);
        return { success: false, error: "Database error" };
    }
}

// =============================================================================
// HELPER: Types for lifecycle notifications
// =============================================================================

type LifecycleEventType = "LEFT" | "BANNED" | "ARCHIVED" | "DELETED" | "REACTIVATED";

const LIFECYCLE_COLORS: Record<LifecycleEventType, number> = {
    LEFT: 0xf59e0b,       // Amber — left voluntarily
    BANNED: 0xef4444,     // Red — banned
    ARCHIVED: 0x6366f1,   // Indigo — archived
    DELETED: 0xdc2626,    // Strong Red — permanently deleted
    REACTIVATED: 0x10b981,// Green — reactivated
};

const LIFECYCLE_EMOJIS: Record<LifecycleEventType, string> = {
    LEFT: "📤",
    BANNED: "🚫",
    ARCHIVED: "💤",
    DELETED: "🗑️",
    REACTIVATED: "🔄",
};

const LIFECYCLE_TITLES: Record<LifecycleEventType, string> = {
    LEFT: "Membre Parti (Discord)",
    BANNED: "Membre Banni (Discord)",
    ARCHIVED: "Membre Archivé",
    DELETED: "Membre Supprimé",
    REACTIVATED: "Membre Réactivé",
};

/**
 * Helper to send lifecycle notifications to the configured Discord channel
 * Supports: LEFT, BANNED, ARCHIVED, DELETED, REACTIVATED
 * Shows: who did it, when, discord pseudo, avatar link, action type
 * Exported for use by internal cron/sync systems.
 */
export async function sendLifecycleNotification(
    guildId: string, 
    profile: any, 
    type: LifecycleEventType, 
    actorName?: string // undefined = action by the member themselves
) {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { lifecycleNotifyChannelId: true, name: true }
        });

        if (!guildConfig?.lifecycleNotifyChannelId) return;

        const { sendChannelMessage } = await import("@/server/discord");
        
        const color = LIFECYCLE_COLORS[type] || 0x6366f1;
        const emoji = LIFECYCLE_EMOJIS[type] || "📋";
        const title = `${emoji} ${LIFECYCLE_TITLES[type] || "Événement Membre"}`;
        
        // #45 : pseudo SERVEUR en priorité (discordNickname), jamais user.name
        // (nom de compte Discord global). Le pseudo Dofus reste le plus lisible
        // pour une guilde, on le met devant, le pseudo serveur en 2e.
        const serverPseudo = profile.discordNickname || profile.discordInfo?.nickname || "";
        const dofusPseudo = profile.pseudoDofus;
        const displayName = dofusPseudo || serverPseudo || getDisplayName(profile) || "Inconnu";
        const discordName = serverPseudo || dofusPseudo || "Inconnu";
        
        // Avatar URL from Discord
        const userAvatar = profile.user?.image || undefined;

        // Determine actor info
        const isSelfAction = !actorName;
        const actionBy = isSelfAction 
            ? "👤 Par lui-même" 
            : `🛡️ Par **${actorName}**`;

        // Build description
        let statusLabel = "";
        let retentionInfo = "";
        switch (type) {
            case "ARCHIVED":
                statusLabel = "Archivé";
                retentionInfo = profile.scheduledDeletion 
                    ? `Suppression programmée le <t:${Math.floor(new Date(profile.scheduledDeletion).getTime() / 1000)}:f>`
                    : "Aucune date de suppression définie";
                break;
            case "LEFT":
                statusLabel = "Parti (Discord)";
                retentionInfo = "Profil archivé automatiquement lors de la synchro Discord";
                break;
            case "BANNED":
                statusLabel = "Banni";
                retentionInfo = "Données personnelles anonymisées immédiatement";
                break;
            case "DELETED":
                statusLabel = "Supprimé définitivement";
                retentionInfo = "Toutes les données liées ont été purgées";
                break;
            case "REACTIVATED":
                statusLabel = "Réactivé";
                retentionInfo = "Le membre a retrouvé l'accès à ses données";
                break;
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const rosterLink = `${appUrl}/dashboard/${guildId}/admin/members?status=${type === "REACTIVATED" ? "ACTIVE" : type === "DELETED" ? "archived" : type}`;

        // Build avatar URL for Discord embed author
        const discordId = profile.user?.accounts?.[0]?.providerAccountId;
        const discordAvatarUrl = discordId && userAvatar
            ? `https://cdn.discordapp.com/avatars/${discordId}/${userAvatar}.${userAvatar.startsWith("a_") ? "gif" : "png"}?size=128`
            : undefined;

        const fields = [
            { name: "Pseudo Dofus", value: dofusPseudo || "Non défini", inline: true },
            { name: "Nom Discord", value: discordName, inline: true },
            { name: "Nouveau Statut", value: `**${statusLabel}**`, inline: true },
            { name: "Action effectuée par", value: actionBy, inline: false },
        ];

        // Add retention info for non-deletion events
        if (type !== "DELETED" && type !== "REACTIVATED") {
            fields.push({ name: "Rétention des données", value: retentionInfo, inline: false });
        }

        // Add reactivation info
        if (type === "REACTIVATED") {
            fields.push({ name: "Raison", value: retentionInfo, inline: false });
        }
        
        // Add guild name context
        if (guildConfig?.name) {
            fields.push({ name: "Guilde", value: guildConfig.name, inline: false });
        }

        await sendChannelMessage(guildConfig.lifecycleNotifyChannelId, "", {
            embedTitle: title,
            embedDescription: `Le membre **${displayName}** a changé de statut dans la guilde.`,
            embedColor: color,
            embedThumbnail: discordAvatarUrl || userAvatar,
            embedAuthor: discordAvatarUrl ? {
                name: displayName,
                iconUrl: discordAvatarUrl,
            } : undefined,
            fields,
            embedFooter: `SigilOS · Lifecycle · ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
        });
    } catch (err) {
        logger.error("[Lifecycle Notification] Failed:", err);
    }
}

/**
 * Hard delete a profile from a guild (Super Admin only)
 * Purges all guild-scoped data and invalidates active sessions.
 * If this is the user's only guild profile → full account deletion (email, OAuth, sessions).
 * For explicit RGPD wipe, use handleGdprDeletionRequest() instead.
 */
export async function deleteProfileByAdmin(guildId: string, profileId: string) {
    const ctx = await getUserContext(guildId);
    // Guild admins with canManageMembers can delete archived/banned profiles.
    // SuperAdmins can delete any profile (including active ones as a last resort).
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageMembers && !ctx.isAdmin && !ctx.isSuperAdmin) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const target = await db.userProfile.findUnique({
            where: { id: profileId },
            include: {
                user: {
                    include: {
                        profiles: { select: { id: true } },
                        accounts: { where: { provider: "discord" }, select: { providerAccountId: true } }
                    }
                }
            }
        });

        if (!target) return { success: false, error: "Profile not found" };

        // 🔒 Prevent self-deletion
        if (target.userId === ctx.id) {
            return { success: false, error: "Vous ne pouvez pas supprimer votre propre profil." };
        }

        // 🔒 Prevent deletion of the Discord guild owner
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { ownerId: true }
        });
        const targetDiscordId = target.user.accounts[0]?.providerAccountId;
        if (guildConfig?.ownerId && targetDiscordId && guildConfig.ownerId === targetDiscordId) {
            return { success: false, error: "Le propriétaire du serveur Discord ne peut pas être supprimé depuis SigilOS." };
        }

        // Send notification BEFORE deletion while we still have the profile data
        await sendLifecycleNotification(guildId, target, "DELETED", ctx.name ?? "Un administrateur");

        const targetUserId = target.userId;
        const hasOtherProfiles = target.user.profiles.length > 1;

        // ── Chantier #31 : fermer le contenu publié (posts DJ + runs songes) + supprimer
        // les embeds Discord AVANT de supprimer le profil (les posts cascade au delete).
        await closeMemberPublishedContent(guildId, profileId, targetUserId, "MEMBER_DELETED");

        // 1. Delete the UserProfile — cascades to all guild-scoped data
        await db.userProfile.delete({ where: { id: profileId } });

        // 2. Invalidate ALL active sessions (force re-auth immediately)
        await db.session.deleteMany({ where: { userId: targetUserId } });

        // ── F-01 : Tombstone guild-scopé — le membre supprimé ne peut PAS être
        // ré-provisionné automatiquement au prochain accès (il a encore son rôle
        // Discord ; sans tombstone, _getUserContext recréait un profil → accès rétabli).
        if (targetDiscordId) {
            try {
                // #105 — capturer le pseudo du membre exclu (affiché dans l'onglet « Exclus »).
                const memberName = target.pseudoDofus || target.discordNickname || target.user?.name || null;
                await db.guildMemberBan.upsert({
                    where: { guildId_discordId: { guildId: target.guildId, discordId: targetDiscordId } },
                    create: {
                        guildId: target.guildId,
                        discordId: targetDiscordId,
                        reason: "MEMBER_DELETED",
                        bannedBy: ctx.id ?? "system",
                        bannedByName: ctx.name ?? "Un administrateur",
                        memberName
                    },
                    update: {
                        reason: "MEMBER_DELETED",
                        liftedAt: null,
                        liftedBy: null,
                        liftedByName: null,
                        memberName
                    }
                });
            } catch (banErr) {
                logger.error("[GuildMemberBan] tombstone on delete failed:", banErr);
            }
        }

        // 2bis. Invalider les caches user:ctx (Redis) + profil (mémoire) → révocation IMMÉDIATE
        // (sans ça, le cache 60s laissait le membre supprimé garder un accès complet)
        await invalidateUserContextCache(targetUserId, guildId, target.guildId).catch(() => { });

        // 3. If no other guild profiles → full account wipe (User + Account OAuth + Notifications)
        if (!hasOtherProfiles) {
            await db.user.delete({ where: { id: targetUserId } });
        }

        // 3bis. Succession automatique si l'utilisateur supprimé était le propriétaire de la guilde (#230)
        if (guildConfig?.ownerId === targetUserId || (targetDiscordId && guildConfig?.ownerId === targetDiscordId)) {
            const { handleGuildOwnerSuccession } = await import("./guild-owner-actions");
            await handleGuildOwnerSuccession(target.guildId, targetUserId).catch(err => {
                logger.error("[Lifecycle] Failed auto-succession after owner deletion:", err);
            });
        }

        await createAuditLog({
            guildId,
            action: "MEMBER_PURGED" as any,
            actorUserId: ctx.id as string,
            actorName: ctx.name ?? "Inconnu",
            targetType: "PROFILE" as any,
            targetId: targetUserId,
            metadata: {
                description: `Purge définitive : ${getDisplayName(target)}`,
                reason: "Purge administrative Super Admin",
                fullAccountDeleted: !hasOtherProfiles,
                sessionsInvalidated: true
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (e) {
        logger.error("Delete error:", e);
        return { success: false, error: "Database error" };
    }
}

/**
 * Reactivate an ARCHIVED or BANNED profile — accessible to guild admins (canManageMembers)
 * Creates an audit log and clears the archival flags.
 */
export async function reactivateProfileByAdmin(
    guildId: string,
    profileId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canManageMembers && !ctx.isAdmin && !ctx.isSuperAdmin) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const profile = await db.userProfile.findUnique({
            where: { id: profileId },
            include: {
                user: {
                    include: {
                        accounts: { where: { provider: "discord" }, select: { providerAccountId: true } }
                    }
                }
            }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };
        if (profile.status === "ACTIVE") return { success: false, error: "Ce profil est déjà actif" };

        const previousStatus = profile.status;

        const updated = await db.userProfile.update({
            where: { id: profileId },
            data: {
                status: "ACTIVE",
                archivedAt: null,
                archiveReason: null,
                scheduledDeletion: null,
                // Restore anonymized fields only if they were wiped by a ban
                ...(previousStatus === "BANNED" ? {
                    pseudoDofus: null,     // Force member to re-set their pseudo
                    discordNickname: null, // Will be re-fetched on next login
                    lastActivityDesc: `Réactiv(é·e) manuellement par ${ctx.name ?? "un admin"} le ${new Date().toLocaleDateString("fr-FR")}.`
                } : {})
            }
        });

        // 🔔 Lifecycle Notification — reactivation
        await sendLifecycleNotification(guildId, profile, "REACTIVATED", ctx.name ?? "Un administrateur");

        // ── F-01 : lever le tombstone guild-scopé (déban/réactivation) ──
        const reactivateDiscordId = profile.user?.accounts?.[0]?.providerAccountId;
        if (reactivateDiscordId) {
            try {
                await db.guildMemberBan.updateMany({
                    where: { guildId: profile.guildId, discordId: reactivateDiscordId, liftedAt: null },
                    data: { liftedAt: new Date(), liftedBy: ctx.id ?? "system", liftedByName: ctx.name ?? "Un administrateur" }
                });
            } catch (banErr) {
                logger.error("[GuildMemberBan] lift on reactivate failed:", banErr);
            }
        }

        // Invalidate Redis cache to ensure the user sees their restored access immediately
        // (⚠️ 2ᵉ arg = UUID interne de la guilde, 3ᵉ = discordGuildId — sinon la clé mémoire
        // `profile:{userId}:{internalGuildId}` que lit getUserContext reste périmée 60s)
        await invalidateUserContextCache(
            updated.userId,
            profile.guildId,
            guildId
        );

        // Invalidate sessions so they must re-auth (picks up new ACTIVE status)
        await db.session.deleteMany({ where: { userId: profile.userId } });

        await createAuditLog({
            guildId,
            action: "PROFILE_REACTIVATED" as any,
            actorUserId: ctx.id as string,
            actorName: ctx.name ?? "Inconnu",
            targetType: "PROFILE" as any,
            targetId: profileId,
            metadata: {
                description: `Réintégration manuelle (ancien statut : ${previousStatus})`,
                reason: reason || `Décision de ${ctx.name ?? "un admin"}`,
                previousStatus
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin`);
        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };
    } catch (e) {
        logger.error("[Reactivate] Error:", e);
        return { success: false, error: "Erreur base de données" };
    }
}

// Retention periods in days — politique d'archivage automatique : 12 mois (365 j)
const RETENTION_DAYS = {
    USER_LEAVE: 365,    // Départ volontaire : 12 mois
    LEFT: 365,          // Départ via sync : 12 mois
    ADMIN_ACTION: 365,  // Archivé par un admin : 12 mois
    KICKED: 365,        // Nettoyé par un admin : 12 mois
    BANNED: 0,          // Déjà anonymisé immédiatement
    GDPR_REQUEST: 0     // Suppression immédiate sur demande RGPD
};

/**
 * Cleanup expired archived profiles
 * Should be called by a cron job (e.g., daily)
 */
export async function cleanupExpiredProfiles(discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAdmin) {
        return { success: false, error: "Unauthorized" };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true }
    });

    if (!guild) {
        return { success: false, error: "Guild not found" };
    }

    const now = new Date();
    let deletedCount = 0;

    // Process each retention type
    for (const [reason, days] of Object.entries(RETENTION_DAYS)) {
        if (days === 0) continue; // Skip immediate deletion types (already handled)

        const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const result = await db.userProfile.deleteMany({
            where: {
                guildId: guild.id,
                status: "ARCHIVED",
                archiveReason: reason,
                archivedAt: { lt: cutoffDate }
            }
        });

        deletedCount += result.count;
    }

    return { success: true, deletedCount };
}

/**
 * Reactivate a profile when a member returns to the Discord
 * Called automatically in getUserContext when detecting a returning archived member
 */
export async function reactivateProfile(userId: string, guildInternalId: string) {
    const result = await db.userProfile.updateMany({
        where: {
            userId,
            guildId: guildInternalId,
            status: "ARCHIVED" // Only reactivate if archived, not if banned
        },
        data: {
            status: "ACTIVE",
            archivedAt: null,
            archiveReason: null
        }
    });

    return result.count > 0;
}

/**
 * Get archived profiles for admin review
 */
export async function getArchivedProfiles(discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    // canManageMembers is enough to view archived/banned profiles
    if (!ctx.canManageMembers && !ctx.isAdmin) {
        return { success: false, error: "Permission 'Gérer les membres' requise", profiles: [] };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true }
    });

    if (!guild) {
        return { success: false, error: "Guild not found", profiles: [] };
    }

    const profiles = await db.userProfile.findMany({
        where: {
            guildId: guild.id,
            status: { in: ["ARCHIVED", "BANNED"] }
        },
        orderBy: { archivedAt: "desc" },
        take: 100,
        select: {
            id: true,
            userId: true,
            status: true,
            archivedAt: true,
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
        }
    });

    return { success: true, profiles };
}

/**
 * Handle GDPR deletion request (Right to be Forgotten)
 * Total platform purge
 */
export async function handleGdprDeletionRequest() {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const userId = session.user.id;

    try {
        // Get Discord ID for correct owner check
        const account = await db.account.findFirst({
            where: { userId, provider: "discord" }
        });
        const discordId = account?.providerAccountId;

        // Get all guilds where this user is active
        const userProfiles = await db.userProfile.findMany({
            where: { userId, status: "ACTIVE" },
            include: { 
                guild: true,
                user: {
                    include: {
                        accounts: { where: { provider: "discord" }, select: { providerAccountId: true } }
                    }
                }
            }
        });

        const { fetchGuild } = await import("@/server/discord");
        const { createAuditLog } = await import("./audit-actions");

        let ownedCount = 0;
        let blockedGuildName = "";

        // 🔒 VÉRIFICATION STRICTE DE PROPRIÉTÉ EN PREMIER (Fail-Closed)
        // Ne JAMAIS envoyer de notification Discord ou d'audit log de suppression
        // tant qu'on n'a pas validé que le compte est autorisé à être supprimé !
        for (const profile of userProfiles) {
            let currentOwnerId = (profile.guild as any).ownerId;

            // Self-healing: If ownerId is missing or we suspect it's outdated, fetch from Discord
            if (!currentOwnerId) {
                try {
                    const discordGuild = await fetchGuild(profile.guild.discordGuildId);
                    currentOwnerId = discordGuild.owner_id;

                    // Update DB with the real owner for future checks
                    await db.guildConfig.update({
                        where: { id: profile.guild.id },
                        data: { ownerId: currentOwnerId } as any
                    });
                } catch (err) {
                    logger.error(`[GDPR Deletion] Failed to fetch owner from Discord for ${profile.guild.name}:`, err);
                }
            }

            // check if user is the owner
            if (currentOwnerId && (currentOwnerId === userId || currentOwnerId === discordId)) {
                ownedCount++;
                blockedGuildName = profile.guild.name;
            }
        }

        // Si l'utilisateur possède au moins une guilde, on BLOQUE IMMÉDIATEMENT sans AUCUNE notification
        if (ownedCount > 0) {
            logger.warn(`[GDPR Deletion] Blocked: User is technical owner of ${ownedCount} guilds (ex: ${blockedGuildName})`);
            return {
                success: false,
                error: `Impossible de supprimer : vous êtes propriétaire de ${ownedCount} guilde(s) (ex: ${blockedGuildName}). Transférez la propriété sur Discord d'abord.`
            };
        }

        // ✅ L'utilisateur n'est propriétaire d'aucune guilde : la suppression est autorisée.
        // On peut maintenant envoyer les notifications Discord et créer les audit logs.
        for (const profile of userProfiles) {
            // Notification Discord de suppression de compte
            await sendLifecycleNotification(profile.guild.discordGuildId, profile, "DELETED", "RGPD (Suppression de compte)");

            // Audit log de suppression RGPD
            try {
                await createAuditLog({
                    guildId: profile.guild.discordGuildId,
                    actorUserId: userId,
                    actorName: profile.pseudoDofus || "Unknown User",
                    action: "USER_GDPR_DELETE" as any,
                    targetType: "USER",
                    targetId: userId,
                    metadata: {
                        reason: "RGPD Deletion Request",
                        discordId: discordId,
                        guildName: profile.guild.name
                    }
                });
            } catch (auditErr) {
                logger.error(`[GDPR Deletion] Audit log failed for guild ${profile.guild.name}:`, auditErr);
            }
        }

        // Supprimons simplement le user (Cascade s'occupe du reste)
        // Mais invalidons d'abord les caches pour éviter les sessions fantômes
        for (const profile of userProfiles) {
            await invalidateUserContextCache(userId, profile.guild.id, profile.guild.discordGuildId);
        }

        // S5.11/S8.20 — RGPD : les annonces **encore vivantes** du membre partent en
        // `WITHDRAWN` (journal d'audit du marché) AVANT la suppression du `User`
        // (dont la cascade effacerait les annonces). Best-effort : un échec du
        // marché ne doit jamais bloquer la suppression RGPD.
        for (const profile of userProfiles) {
            try {
                await withdrawMarketListingsForProfileCore({
                    guildConfigId: profile.guild.id,
                    profileId: profile.id,
                    reason: "GDPR_DELETION",
                    actorUserId: userId,
                });
            } catch (marketError) {
                logger.warn("[GDPR Deletion] cascade Marché différée", { err: String(marketError) });
            }
        }

        await db.user.delete({
            where: { id: userId }
        });

        return { success: true };
    } catch (e: any) {
        logger.error("[GDPR Deletion] FATAL:", e);
        return {
            success: false,
            error: "Une erreur interne s'est produite lors de la suppression. Veuillez contacter un administrateur."
        };
    }
}

/**
 * ARCHIVE & SYNC GUILD MEMBERS
 * Compares Discord members with local profiles and archives members who are no longer in the guild.
 */
export async function syncGuildMembers(discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAdmin) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const { listGuildMembers, fetchGuildBans, fetchAuditExecutor, executorMetadata, DISCORD_AUDIT_ACTIONS } = await import("@/server/discord");

        // 1. Fetch current members from Discord
        const discordMembers = await listGuildMembers(discordGuildId);
        const discordUserIds = new Set(discordMembers.map(m => m.user.id));

        // 2. Fetch all profiles for this guild with their Discord Accounts
        // #1 validé : inclut ARCHIVED pour détecter un ban Discord APRÈS le départ.
        const profiles = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId },
                status: { in: ["ACTIVE", "ARCHIVED"] }
            },
            include: {
                user: {
                    include: {
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    }
                }
            }
        });

        // 3. Fetch current bans from Discord
        const discordBans = await fetchGuildBans(discordGuildId);
        const bannedUserIds = new Set(discordBans.map(b => b.user.id));

        let archivedCount = 0;
        let bannedCount = 0;

        // 4. Compare and archive/anonymize
        for (const profile of profiles) {
            const discordId = profile.user.accounts[0]?.providerAccountId;

            if (discordId && !discordUserIds.has(discordId)) {
                // Check if they are banned or just left
                const isBanned = bannedUserIds.has(discordId);

                // #1 validé : déjà ARCHIVED et pas banni → on ne touche à rien
                // (évite de reset la rétention 12 mois à chaque sync).
                if (!isBanned && (profile as { status?: string }).status === "ARCHIVED") {
                    continue;
                }

                if (isBanned) {
                    // Exécutant réel du ban (staff ou bot tiers).
                    const banExOld = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.BAN_ADD, discordId).catch(() => null);
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            status: "BANNED",
                            archivedAt: new Date(),
                            archiveReason: "BANNED",
                            pseudoDofus: "Utilisateur banni",
                            discordNickname: "Anonyme",
                            metamobPseudo: null,
                            metamobVerified: false,
                            altPseudos: Prisma.JsonNull,
                            availability: Prisma.JsonNull,
                            vacationStart: null,
                            vacationEnd: null,
                            vacationNotify: false,
                            lastActivityDesc: "Détecté banni lors de la synchronisation. Données nettoyées.",
                            succes: Prisma.JsonNull,
                            metiers: Prisma.JsonNull,
                            classeSecondaires: Prisma.JsonNull,
                            dofusBookLinks: Prisma.JsonNull
                        }
                    });

                    // ── F-01 : tombstone guild-scopé (ban Discord détecté) ──
                    try {
                        // #105 — pseudo du membre (pris AVANT l'anonymisation du profil).
                        const memberName = profile.pseudoDofus || profile.discordNickname || null;
                        await db.guildMemberBan.upsert({
                            where: { guildId_discordId: { guildId: profile.guildId, discordId } },
                            create: {
                                guildId: profile.guildId,
                                discordId,
                                reason: "Banni sur le serveur Discord",
                                bannedBy: "SYSTEM",
                                bannedByName: "Vérification auto",
                                memberName
                            },
                            update: {
                                reason: "Banni sur le serveur Discord",
                                liftedAt: null,
                                liftedBy: null,
                                liftedByName: null,
                                memberName
                            }
                        });
                    } catch (banErr) {
                        logger.error("[GuildMemberBan] tombstone on Discord ban failed:", banErr);
                    }

                    // ── Chantier #31 : fermer le contenu publié du membre banni (posts DJ + runs songes) ──
                    await closeMemberPublishedContent(discordGuildId, profile.id, profile.userId, "BANNED (Discord)");

                    // 🔔 Lifecycle Notification
                    await sendLifecycleNotification(discordGuildId, profile, "BANNED", "Vérification automatique");

                    // 📝 AUDIT LOG Departure (Banned)
                    try {
                        const { createAuditLog: log } = await import("./audit-actions");
                        await log({
                            guildId: discordGuildId,
                            actorUserId: "SYSTEM",
                            actorName: "Vérification auto",
                            action: "MEMBER_BANNED" as any,
                            targetType: "PROFILE",
                            targetId: profile.id,
                            metadata: { 
                                description: profile.pseudoDofus || profile.discordNickname || "Inconnu",
                                reason: "Banni sur Discord",
                                ...executorMetadata(banExOld, discordId)
                            }
                        });
                    } catch (e) { logger.error("[Lifecycle Sync] Audit failed", e); }

                    bannedCount++;
                } else {
                    // Auteur réel : exclu par un staff/bot ou parti de lui-même.
                    // « lui-même » uniquement si le journal a bien été lu (checked).
                    let kickExOld = null;
                    let kickCheckedOld = false;
                    try {
                        kickExOld = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.KICK, discordId);
                        kickCheckedOld = true;
                    } catch {
                        kickCheckedOld = false;
                    }
                    const kickedOld = kickExOld && kickExOld.userId !== discordId ? kickExOld : null;
                    const twelveMonthsFromNow = new Date();
                    twelveMonthsFromNow.setFullYear(twelveMonthsFromNow.getFullYear() + 1);

                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            status: "ARCHIVED",
                            archivedAt: new Date(),
                            archiveReason: "LEFT",
                            scheduledDeletion: twelveMonthsFromNow
                        }
                    });

                    // ── Chantier #31 : fermer le contenu publié du membre parti (posts DJ + runs songes) ──
                    await closeMemberPublishedContent(discordGuildId, profile.id, profile.userId, "LEFT");

                    // 🔔 Lifecycle Notification
                    await sendLifecycleNotification(discordGuildId, profile, "LEFT", "Vérification automatique");

                    // 📝 AUDIT LOG Departure (Left)
                    try {
                        const { createAuditLog: log } = await import("./audit-actions");
                        await log({
                            guildId: discordGuildId,
                            actorUserId: "SYSTEM",
                            actorName: "Vérification auto",
                            action: "MEMBER_LEFT" as any,
                            targetType: "PROFILE",
                            targetId: profile.id,
                            metadata: { 
                                description: profile.pseudoDofus || profile.discordNickname || "Inconnu",
                                reason: kickedOld ? "Exclu du serveur" : "A quitté le serveur",
                                ...(kickedOld
                                    ? executorMetadata(kickedOld, discordId)
                                    : kickCheckedOld
                                      ? { executorId: discordId, executorIsSelf: true }
                                      : {})
                            }
                        });
                    } catch (e) { logger.error("[Lifecycle Sync] Audit failed", e); }

                    archivedCount++;
                }
            }
        }

        revalidatePath(`/dashboard/${discordGuildId}/admin`);
        return {
            success: true,
            message: `${archivedCount} archivés et ${bannedCount} nettoyés (bans) sur ${profiles.length} vérifiés.`,
            count: archivedCount + bannedCount
        };
    } catch (error) {
        logger.error("[Lifecycle Sync] Error:", error);
        return { success: false, error: "Échec de la synchronisation" };
    }
}

/**
 * MANUAL WIPE (RGPD)
 */
export async function wipeUserProfile(profileId: string, discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAdmin) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const profile = await db.userProfile.findUnique({
            where: { id: profileId },
            include: {
                user: {
                    include: {
                        accounts: { where: { provider: "discord" }, select: { providerAccountId: true } }
                    }
                }
            }
        });
        if (!profile) return { success: false, error: "Profil introuvable" };

        // 🔒 Prevent self-wipe
        if (profile.userId === ctx.id) {
            return { success: false, error: "Vous ne pouvez pas nettoyer votre propre profil." };
        }

        // 🔒 Prevent wiping the Discord guild owner
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { ownerId: true }
        });
        const targetDiscordId = profile.user?.accounts[0]?.providerAccountId;
        if (guildConfig?.ownerId && targetDiscordId && guildConfig.ownerId === targetDiscordId) {
            return { success: false, error: "Le propriétaire du serveur Discord ne peut pas être nettoyé depuis SigilOS." };
        }

        // 🔔 Lifecycle Notification — before anonymization
        await sendLifecycleNotification(discordGuildId, profile, "BANNED", ctx.name ?? "Un administrateur");

        // ── F-01 : tombstone guild-scopé — le membre « nettoyé » (status BANNED) reste
        // bloqué et visible/réintégrable dans l'onglet « Exclus ». Sans tombstone, il était
        // en « Accès Banni » mais INVISIBLE dans Exclus (impossible à réintégrer via l'UI).
        if (targetDiscordId) {
            try {
                const memberName = profile.pseudoDofus || profile.discordNickname || profile.user?.name || null;
                await db.guildMemberBan.upsert({
                    where: { guildId_discordId: { guildId: profile.guildId, discordId: targetDiscordId } },
                    create: {
                        guildId: profile.guildId,
                        discordId: targetDiscordId,
                        reason: "KICKED (RGPD wipe)",
                        bannedBy: ctx.id ?? "system",
                        bannedByName: ctx.name ?? "Un administrateur",
                        memberName
                    },
                    update: {
                        reason: "KICKED (RGPD wipe)",
                        liftedAt: null,
                        liftedBy: null,
                        liftedByName: null,
                        memberName
                    }
                });
            } catch (banErr) {
                logger.error("[GuildMemberBan] tombstone on wipe failed:", banErr);
            }
        }

        await db.userProfile.update({
            where: { id: profileId },
            data: {
                status: "BANNED",
                archiveReason: "KICKED",
                pseudoDofus: "Utilisateur nettoyé",
                discordNickname: "Anonyme",
                metamobPseudo: null,
                metamobVerified: false,
                altPseudos: Prisma.JsonNull,
                availability: Prisma.JsonNull,
                vacationStart: null,
                vacationEnd: null,
                vacationNotify: false,
                succes: Prisma.JsonNull,
                metiers: Prisma.JsonNull,
                classeSecondaires: Prisma.JsonNull,
                dofusBookLinks: Prisma.JsonNull,
                lastActivityDesc: "Données nettoyées manuellement par un administrateur.",
            }
        });

        // S5.11/S8.20 — un profil nettoyé (BANNED) ne garde pas d'annonces actives :
        // cascade marché best-effort, jamais bloquante pour le nettoyage RGPD.
        try {
            await withdrawMarketListingsForGuildMember({
                discordGuildId,
                profileId,
                reason: "KICKED (RGPD wipe)",
                actorUserId: ctx.id ?? null,
            });
        } catch (marketError) {
            logger.warn("[Manual Wipe] cascade Marché différée", { err: String(marketError) });
        }

        revalidatePath(`/dashboard/${discordGuildId}/admin`);
        return { success: true };
    } catch (error) {
        logger.error("[Manual Wipe] Error:", error);
        return { success: false, error: "Erreur lors du nettoyage" };
    }
}

import { formatDofusPseudo } from "@/lib/utils";

/**
 * Request reactivation for an ARCHIVED profile (User action)
 */
export async function requestProfileReactivation(guildId: string, pseudo?: string, reason?: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, missionValidationChannelId: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: guildConfig.id
                }
            },
            include: { user: { select: { name: true, image: true } } }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };
        if (profile.status !== "ARCHIVED") return { success: false, error: "Seuls les comptes archivés peuvent demander une réintégration." };

        // 🛡️ Protection anti-spam : Une seule demande à la fois
        if (profile.reactivationRequestedAt) {
            return { success: false, error: "Une demande de réintégration est déjà en cours de traitement par le Staff." };
        }

        // Validation stricte du pseudo (pas de chiffres ni caractères spéciaux sauf crochets)
        if (pseudo && /[^a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F\s-\[\]]/.test(pseudo)) {
            return { success: false, error: "Le pseudo contient des caractères invalides (chiffres ou symboles)." };
        }

        const cleanPseudo = pseudo ? formatDofusPseudo(pseudo) : profile.pseudoDofus;

        // Uniqueness check if pseudo changed
        if (cleanPseudo && cleanPseudo !== profile.pseudoDofus) {
            const existing = await db.userProfile.findFirst({
                where: {
                    guildId: guildConfig.id,
                    pseudoDofus: { equals: cleanPseudo, mode: "insensitive" },
                    userId: { not: session.user.id }
                }
            });
            if (existing) return { success: false, error: `Le pseudo "${cleanPseudo}" est déjà utilisé par un autre membre.` };
        }

        // Update profile
        await db.userProfile.update({
            where: { id: profile.id },
            data: {
                pseudoDofus: cleanPseudo,
                reactivationRequestedAt: new Date(),
                reactivationRequestReason: reason || "Demande via le Dashboard"
            }
        });

        // 📝 Audit Log
        const ctx = await getUserContext(guildId);
        const finalName = cleanPseudo || ctx.name || session.user.name || "Membre";

        await createAuditLog({
            guildId,
            action: "MEMBER_JOIN_REQUEST" as any,
            actorUserId: session.user.id,
            actorName: finalName,
            targetType: "PROFILE" as any,
            targetId: profile.id,
            metadata: {
                description: "Demande de réintégration (Retour d'archive)",
                reason: reason || "Action utilisateur"
            }
        });

        // 🔔 Discord Notification
        try {
            const channelId = guildConfig.missionValidationChannelId || guildConfig.missionNotifyChannelId;
            if (channelId) {
                const { sendChannelMessage } = await import("@/server/discord");
                const mentionMode = guildConfig.missionValidationNotifyRoleId;
                const mention = mentionMode ? (mentionMode === "everyone" ? "@everyone" : `<@&${mentionMode}>`) : "Staff";

                await sendChannelMessage(channelId, `Bonjour ${mention} !`, {
                    embedTitle: "🔄 Demande de Réintégration",
                    embedDescription: `Le membre **${finalName}** souhaite réintégrer la guilde.`,
                    embedColor: 0x10b981, // Green
                    embedThumbnail: profile.user.image || undefined,
                    fields: [
                        { name: "Raison", value: reason || "Non précisée" },
                        { name: "Lien Admin", value: `${process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr"}/dashboard/${guildId}/admin/validation?tab=retours` }
                    ],
                    components: [
                        {
                            type: 1, // Action Row
                            components: [
                                {
                                    type: 2, style: 3, // Success
                                    label: "✅ Approuver",
                                    custom_id: `validate:reactivation:approve:${profile.id}:${guildId}`,
                                },
                                {
                                    type: 2, style: 4, // Danger
                                    label: "❌ Refuser",
                                    custom_id: `validate:reactivation:reject:${profile.id}:${guildId}`,
                                },
                            ],
                        },
                    ]
                });
            }
        } catch (discordErr) {
            logger.error("Discord notification failed for reactivation request:", discordErr);
        }

        revalidatePath(`/dashboard/${guildId}`);
        revalidatePath(`/dashboard/${guildId}/admin/validation`);
        return { success: true };
    } catch (e) {
        logger.error("Request reactivation error:", e);
        return { success: false, error: "Erreur lors de la demande" };
    }
}

/**
 * Get pending reactivation requests for admin validation
 */
export async function getPendingReactivations(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canValidateMissions) {
        return { success: false, error: "Forbidden" };
    }

    try {
        const requests = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ARCHIVED",
                reactivationRequestedAt: { not: null }
            },
            select: {
                id: true,
                userId: true,
                pseudoDofus: true,
                discordNickname: true,
                reactivationRequestedAt: true,
                reactivationRequestReason: true,
                archiveReason: true,
                archivedAt: true,
                scheduledDeletion: true,
                user: {
                    select: {
                        name: true,
                        image: true
                    }
                }
            },
            orderBy: { reactivationRequestedAt: "desc" }
        });

        return { success: true, data: requests };
    } catch (e) {
        logger.error("Fetch pending reactivations error:", e);
        return { success: false, error: "Database error" };
    }
}

/**
 * Liste les exclusions (tombstones GuildMemberBan) actives d'une guilde.
 * Accessible aux admins (canManageMembers / isAdmin) — UI « Exclus » du membre.
 */
export async function getGuildMemberBans(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || (!ctx.canManageMembers && !ctx.isAdmin && !ctx.isSuperAdmin)) {
        return { success: false, error: "Permission 'Gérer les membres' requise", data: [] as any[] };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true }
    });
    if (!guild) return { success: false, error: "Guild not found", data: [] };

    // ⚠️ F-01 — pas de `take` : une limite (ex. 100) rendait certains exclusions invisibles
    // dans l'onglet « Exclus » (le membre apparaissait « Accès Banni » sans être réintégrable).
    const bans = await db.guildMemberBan.findMany({
        where: { guildId: guild.id, liftedAt: null },
        orderBy: { createdAt: "desc" }
    });

    return { success: true, data: bans };
}

/**
 * Lève une exclusion (tombstone) — réintègre un membre précédemment supprimé/banni.
 * Le membre pourra de nouveau être provisionné par _getUserContext (accès dashboard).
 */
export async function liftGuildMemberBan(guildId: string, discordId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || (!ctx.canManageMembers && !ctx.isAdmin && !ctx.isSuperAdmin)) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }
    if (!/^\d+$/.test(discordId)) return { success: false, error: "Identifiant Discord invalide" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guild not found" };

        const result = await db.guildMemberBan.updateMany({
            where: { guildId: guild.id, discordId, liftedAt: null },
            data: { liftedAt: new Date(), liftedBy: ctx.id ?? "system", liftedByName: ctx.name ?? "Un administrateur" }
        });

        if (result.count === 0) return { success: false, error: "Aucune exclusion active trouvée pour ce membre" };

        await createAuditLog({
            guildId,
            action: "MEMBER_UNBANNED" as any,
            actorUserId: ctx.id as string,
            actorName: ctx.name ?? "Inconnu",
            targetType: "PROFILE",
            metadata: {
                description: `Exclusion levée pour le membre Discord ${discordId}`,
                reason: "Action manuelle (réintégration)"
            }
        });

        // F-01 : lever le tombstone en BDD ne suffit pas — il faut invalider le
        // contexte user (`user:ctx` = isBanned) + purger les sessions du membre,
        // sinon il reste bloqué sur « Accès Banni » jusqu'à expiration du cache.
        const account = await db.account.findFirst({
            where: { provider: "discord", providerAccountId: discordId },
            select: { userId: true }
        });
        if (account) {
            await invalidateUserContextCache(account.userId, guild.id, guildId);
            await db.session.deleteMany({ where: { userId: account.userId } });
        }

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };
    } catch (e) {
        logger.error("[liftGuildMemberBan] error:", e);
        return { success: false, error: "Database error" };
    }
}

/**
 * Ferme TOUT le contenu publié par un membre exclu (archivé / banni / supprimé) :
 * - Posts DJ & quêtes en cours (OPEN/FULL) → CLOSED + suppression de l'embed Discord
 * - Runs songes en cours (leader) → ABANDONED + suppression de l'embed Discord
 * - Annonces du Marché encore vivantes → WITHDRAWN (S5.11/S8.20, §15.2) + audit du marché
 * Best-effort et non bloquant. Aucune auto-expiration temporelle : un post ne se ferme
 * que si son émetteur quitte le dashboard (chantier #31).
 */
export async function closeMemberPublishedContent(
    guildId: string,
    profileId: string,
    userId: string,
    reason: string
): Promise<{ dj: number; runs: number; market: number }> {
    const closed = { dj: 0, runs: 0, market: 0 };
    try {
        // 1. Posts DJ / quêtes actifs du membre → CLOSED
        const djPosts = await (db as any).djSearchPost.findMany({
            where: { profileId, status: { in: ["OPEN", "FULL"] } },
            select: { id: true, discordChannelId: true, discordMessageId: true }
        });
        if (djPosts.length > 0) {
            await (db as any).djSearchPost.updateMany({
                where: { id: { in: djPosts.map((p: any) => p.id) } },
                data: { status: "CLOSED", closedAt: new Date() }
            });
            closed.dj = djPosts.length;
        }

        // 2. Runs songes en cours dont le membre est leader → ABANDONED
        // (DreamRun.guildId stocke le discordGuildId — voir getUnifiedActiveGroups)
        const dreamRuns = await db.dreamRun.findMany({
            where: { guildId, leaderId: userId, status: { in: ["RECRUITING", "IN_PROGRESS"] } },
            select: { id: true, discordChannelId: true, discordMessageId: true }
        });
        if (dreamRuns.length > 0) {
            await db.dreamRun.updateMany({
                where: { id: { in: dreamRuns.map(r => r.id) } },
                data: { status: "ABANDONED", completedAt: new Date() }
            });
            closed.runs = dreamRuns.length;
        }

        // 2bis. S5.11/S8.20 — annonces du Marché encore vivantes → WITHDRAWN.
        // Le core est **non bloquant** (try/catch local + Discord jamais attendu) :
        // un échec du marché ne doit jamais empêcher l'archivage / la suppression.
        try {
            const marketOutcome = await withdrawMarketListingsForGuildMember({
                discordGuildId: guildId,
                profileId,
                reason,
            });
            closed.market = marketOutcome.withdrawn;
        } catch (marketError) {
            logger.warn("[Lifecycle] cascade Marché différée", { err: String(marketError) });
        }

        // 3. Suppression des embeds Discord (best-effort, jamais bloquant)
        if (closed.dj > 0 || closed.runs > 0) {
            const { deleteChannelMessage } = await import("@/server/discord");
            const deleteTasks: Promise<unknown>[] = [];
            for (const p of djPosts) {
                if (p.discordChannelId && p.discordMessageId) {
                    deleteTasks.push(deleteChannelMessage(p.discordChannelId, p.discordMessageId).catch(() => false));
                }
            }
            for (const r of dreamRuns) {
                if (r.discordChannelId && r.discordMessageId) {
                    deleteTasks.push(deleteChannelMessage(r.discordChannelId, r.discordMessageId).catch(() => false));
                }
            }
            await Promise.allSettled(deleteTasks);
            logger.info(`[Lifecycle] Contenu fermé pour exclusion (${reason}): ${closed.dj} post(s) DJ, ${closed.runs} run(s) songes, ${closed.market} annonce(s) Marché`);
        }
    } catch (e) {
        logger.error("[closeMemberPublishedContent] error:", e);
    }
    return closed;
}