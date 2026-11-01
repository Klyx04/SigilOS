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
import { rateLimit } from "@/lib/ratelimit";
import { formatDofusPseudo, getAppBaseUrl } from "@/lib/utils";
import { isAgendaMirror } from "@/lib/agenda-mirror";
import { deleteEventDiscordMessage, deleteReminderMessageRefs, type ReminderMessageRef } from "@/server/calendar-message-cleanup";
import { syncDjMirror, syncSongesMirror } from "@/server/agenda-mirror-sync";

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

        const appUrl = getAppBaseUrl();
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
 * Suppression **DÉFINITIVE** du profil d'un membre pour la guilde courante (chantier B, lot B-3).
 *
 * Différences voulues avec `deleteProfileByAdmin` (exclusion **réversible**, tombstone
 * `GuildMemberBan`, onglet « Exclus ») :
 * - **aucun tombstone** : si le membre revient (il garde son rôle Discord), il est ré-provisionné
 *   comme un **nouvel arrivant** — aucune exclusion ne survit à l'action ;
 * - portée **strictement guilde** : seul le `UserProfile` de CETTE guilde (+ ses cascades) est
 *   supprimé. Le compte plateforme (`User`) et les éventuels **autres** profils de guilde sont
 *   préservés ⇒ un admin de guilde ne peut jamais détruire l'accès d'un membre ailleurs
 *   (la purge du compte global reste l'apanage du God) ;
 * - gardée par la permission **dédiée** `staff:member_delete` (fail-closed) + rate-limit.
 */
export async function purgeMemberFromGuild(
    guildId: string,
    profileId: string
): Promise<{ success: boolean; error?: string }> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.canDeleteMembers && !ctx.isAdmin) {
        return { success: false, error: "Permission 'Supprimer un profil de guilde' requise" };
    }
    if (!profileId || typeof profileId !== "string") {
        return { success: false, error: "Profil invalide" };
    }

    // Mutation destructive : rate-limit fail-closed (AGENTS §5.8) — 10 / 5 min / acteur.
    const limit = await rateLimit(`member-purge:${guildId}:${ctx.id ?? "anon"}`, 10, 5 * 60_000);
    if (!limit.success) {
        return {
            success: false,
            error: limit.error
                ? "Sécurité momentanément indisponible, réessayez."
                : "Trop de suppressions en peu de temps, réessayez plus tard.",
        };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, ownerId: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        // 🔒 Isolation de guilde : `guildId` résolu côté serveur, la cible DOIT appartenir à la guilde.
        const target = await db.userProfile.findFirst({
            where: { id: profileId, guildId: guild.id },
            select: {
                id: true,
                userId: true,
                guildId: true,
                pseudoDofus: true,
                discordNickname: true,
                user: {
                    select: {
                        name: true,
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true },
                        },
                    },
                },
            },
        });
        if (!target) return { success: false, error: "Profil introuvable dans cette guilde" };

        // 🔒 Pas d'auto-suppression.
        if (target.userId === ctx.id) {
            return { success: false, error: "Vous ne pouvez pas supprimer votre propre profil." };
        }

        // 🔒 Le propriétaire du serveur Discord n'est jamais supprimé depuis SigilOS.
        const targetDiscordId = target.user.accounts[0]?.providerAccountId;
        if (guild.ownerId && targetDiscordId && guild.ownerId === targetDiscordId) {
            return {
                success: false,
                error: "Le propriétaire du serveur Discord ne peut pas être supprimé depuis SigilOS.",
            };
        }

        const label = target.pseudoDofus || target.discordNickname || target.user.name || "Un membre";

        // Fermer le contenu publié (posts DJ + runs songes) AVANT la cascade du profil.
        await closeMemberPublishedContent(guildId, profileId, target.userId, "MEMBER_DELETED");

        // Suppression du profil de CETTE guilde (cascade : données guilde, journal du registre…).
        await db.userProfile.delete({ where: { id: profileId } });

        // Révocation immédiate : sessions + caches (sinon le membre garde un accès résiduel).
        await db.session.deleteMany({ where: { userId: target.userId } });
        await invalidateUserContextCache(target.userId, target.guildId, guildId).catch(() => {});

        await createAuditLog({
            guildId,
            action: "MEMBER_PURGED" as any,
            actorUserId: ctx.id as string,
            actorName: ctx.name ?? "Inconnu",
            targetType: "PROFILE" as any,
            targetId: profileId,
            metadata: {
                description: `Suppression définitive (guilde uniquement) : ${label}`,
                reason: "Suppression définitive — réapparition possible comme nouvel arrivant",
                scope: "GUILD_ONLY",
            },
        });

        // Carte Discord du cycle de vie (type DELETED). Cette action ne notifiait pas, alors que
        // `deleteProfileByAdmin` (table God) le fait depuis toujours : même événement, deux
        // conduites (mesure du 25/10/2026). `sendLifecycleNotification` est fail-safe (pas de
        // salon configuré ou Discord indisponible ⇒ la suppression reste acquise).
        await sendLifecycleNotification(guildId, target, "DELETED", ctx.name ?? "Un administrateur");

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };
    } catch (e) {
        logger.error("[purgeMemberFromGuild] Error:", e);
        return { success: false, error: "Erreur base de données" };
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

        // 🔒 G4 — limite de guildes : on compte les profils **ACTIVE du membre ciblé** (pas ceux de
        // l'admin qui agit). Message du §7 du plan, jamais un code technique à l'écran.
        {
            const { wouldExceedGuildLimit } = await import("@/server/guild-limit");
            if (await wouldExceedGuildLimit(profile.userId)) {
                return {
                    success: false,
                    error: "Ce membre fait déjà partie du nombre maximum de guildes. Il doit en quitter une avant d'être réintégré ici.",
                };
            }
        }

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
    // 🔒 G5 — même règle que G4, pour la réactivation **automatique** au retour du membre : le
    // profil visé est ARCHIVED à cet instant, donc seules ses **autres** guildes actives comptent.
    {
        const { wouldExceedGuildLimit } = await import("@/server/guild-limit");
        if (await wouldExceedGuildLimit(userId)) return false;
    }

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
                        { name: "Lien Admin", value: `${getAppBaseUrl()}/dashboard/${guildId}/admin/validation?tab=retours` }
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
 * Supprime **définitivement** une exclusion (tombstone) — 31/10/2026.
 *
 * Une exclusion est une **protection contre le ré-provisionnement** : elle n'a de sens que
 * tant qu'on veut empêcher un retour. Quand l'admin a tranché, il doit pouvoir la retirer —
 * sinon les tombstones s'accumulent à vie (mesure du 31/10 sur la bêta : **27** exclusions,
 * aucune action possible, ce qui donnait l'impression d'une liste morte).
 *
 * ⚠️ Supprimer n'est **pas** lever : `liftGuildMemberBan` garde la trace (`liftedAt`) et
 * débloque un profil banni ; celle-ci **efface la ligne** et ne touche pas au profil. Le
 * journal (`MEMBER_BAN_DELETED`) conserve le nom et le motif.
 */
export async function deleteGuildMemberBan(guildId: string, discordId: string) {
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

        const ban = await db.guildMemberBan.findFirst({
            where: { guildId: guild.id, discordId },
            select: { id: true, memberName: true, reason: true },
        });
        if (!ban) return { success: false, error: "Aucune exclusion à supprimer pour ce membre" };

        await db.guildMemberBan.delete({ where: { id: ban.id } });

        await createAuditLog({
            guildId,
            action: "MEMBER_BAN_DELETED",
            actorUserId: ctx.id as string,
            actorName: ctx.name ?? "Inconnu",
            targetType: "PROFILE",
            metadata: {
                description: "Exclusion supprimée définitivement",
                memberName: ban.memberName ?? null,
                reason: ban.reason,
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };
    } catch (e) {
        logger.error("[deleteGuildMemberBan] error:", e);
        return { success: false, error: "Database error" };
    }
}

/**
 * Ferme TOUT le contenu publié par un membre exclu (archivé / banni / supprimé) :
 * - Posts DJ & quêtes en cours (OPEN/FULL) → CLOSED + suppression de l'embed Discord ;
 * - Runs songes en cours (leader) → ABANDONED + suppression de l'embed Discord ;
 * - **Événements du calendrier** encore ouverts (DRAFT/PUBLISHED) → CANCELLED + purge des
 *   rappels et de l'embed (lot B, 30/10/2026 : aucun chemin ne les fermait — un raid dont
 *   le créateur partait restait `PUBLISHED`, et le rappel de clôture pingait un fantôme) ;
 * - Annonces du Marché encore vivantes → WITHDRAWN (S5.11/S8.20, §15.2) + audit du marché.
 * Les **miroirs agenda** DJ/Songes ne sont pas annulés ici : leur état suit leur source
 * (`syncDjMirror` / `syncSongesMirror`), appelés juste après la fermeture.
 * Best-effort et non bloquant. Aucune auto-expiration temporelle : un post se ferme parce
 * que son émetteur a quitté, jamais parce que le temps a passé.
 */
export async function closeMemberPublishedContent(
    guildId: string,
    profileId: string,
    userId: string,
    reason: string
): Promise<{ dj: number; runs: number; events: number; market: number }> {
    const closed = { dj: 0, runs: 0, events: 0, market: 0 };
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

        // 2ter. Événements du calendrier créés par le membre → CANCELLED + purge Discord.
        // `GuildEvent.guildId` porte l'id **interne** (les runs, elles, portent le snowflake).
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (guildConfig) {
            const ownEvents = await db.guildEvent.findMany({
                where: {
                    guildId: guildConfig.id,
                    creatorId: userId,
                    status: { in: ["DRAFT", "PUBLISHED"] },
                },
                select: { id: true, metadata: true, discordChannelId: true, discordMessageId: true },
            });
            // Un miroir suit sa source : il est recopié juste après, pas annulé à la main.
            const directEvents = ownEvents.filter((event) => !isAgendaMirror(event.metadata));
            if (directEvents.length > 0) {
                // Garde d'état dans le WHERE : jamais d'écrasement d'une clôture concurrente.
                await db.guildEvent.updateMany({
                    where: {
                        id: { in: directEvents.map((event) => event.id) },
                        guildId: guildConfig.id,
                        status: { in: ["DRAFT", "PUBLISHED"] },
                    },
                    data: { status: "CANCELLED" },
                });
                // Purge best-effort : rappels (outbox résolu par `messageKey`) puis embed.
                for (const event of directEvents) {
                    const meta = (event.metadata as { reminderMessages?: ReminderMessageRef[] } | null) ?? {};
                    const refs = Array.isArray(meta.reminderMessages) ? meta.reminderMessages : [];
                    await deleteReminderMessageRefs(refs).catch(() => null);
                    await deleteEventDiscordMessage({
                        id: event.id,
                        discordChannelId: event.discordChannelId,
                        discordMessageId: event.discordMessageId,
                    }).catch(() => false);
                }
                closed.events = directEvents.length;
            }
        }

        // 2quater. Miroirs agenda : la copie suit la source **fermée** (DJ → COMPLETED,
        // Songes → COMPLETED/ANNULÉ). Appelé avant toute suppression de profil : après la
        // cascade, la source n'existe plus et le miroir serait simplement orphelin.
        for (const post of djPosts) {
            await syncDjMirror(guildId, post.id).catch(() => null);
        }
        for (const run of dreamRuns) {
            await syncSongesMirror(guildId, run.id).catch(() => null);
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
            logger.info(`[Lifecycle] Contenu fermé pour exclusion (${reason}): ${closed.dj} post(s) DJ, ${closed.runs} run(s) songes, ${closed.events} événement(s) annulé(s), ${closed.market} annonce(s) Marché`);
        }
    } catch (e) {
        logger.error("[closeMemberPublishedContent] error:", e);
    }
    return closed;
}

/**
 * Filet **« contenu fantôme »** (lot B, 30/10/2026) — ferme le contenu publié des profils
 * **non actifs** d'une guilde.
 *
 * Mesure qui justifie cette passe : `closeMemberPublishedContent` n'était appelé que par les
 * actions **humaines** (archivage, ban, suppression) et par une **seconde implémentation**
 * de la synchro restée sans aucun appelant (supprimée dans ce lot). Le cron
 * (`syncMembershipStatusInternal`) et le bot (`GuildMemberRemove`, qui n'a pas accès à
 * `src/`) archivaient donc un partant **sans fermer son contenu** : son post DJ restait
 * `OPEN` et le rappel H-1 continuait de pinger le groupe ; son raid restait `PUBLISHED`
 * avec un rappel de clôture adressé à un fantôme.
 *
 * Ici on ne dépend plus de « qui a archivé » : la passe part des profils non actifs qui
 * portent **encore** du contenu ouvert (une requête bornée, jamais un balayage complet) et
 * applique la même cascade. **Idempotente** : un contenu déjà fermé ne ressort pas.
 *
 * @returns les compteurs cumulés (0 partout si la guilde est introuvable).
 */
export async function closeOrphanContentForGuild(
    discordGuildId: string,
    opts: { limit?: number } = {}
): Promise<{ profiles: number; dj: number; runs: number; events: number; market: number }> {
    const totals = { profiles: 0, dj: 0, runs: 0, events: 0, market: 0 };
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!guild) return totals;

        // Pré-filtre : uniquement les profils exclus qui ont **encore** quelque chose d'ouvert.
        // Les relations évitent de payer la cascade pour des profils déjà propres.
        const candidates = await db.userProfile.findMany({
            where: {
                guildId: guild.id,
                status: { in: ["ARCHIVED", "BANNED"] },
                OR: [
                    { djSearchPosts: { some: { status: { in: ["OPEN", "FULL"] } } } },
                    {
                        user: {
                            dreamRuns: {
                                some: { guildId: discordGuildId, status: { in: ["RECRUITING", "IN_PROGRESS"] } },
                            },
                        },
                    },
                    {
                        user: {
                            guildEvents: { some: { guildId: guild.id, status: { in: ["DRAFT", "PUBLISHED"] } } },
                        },
                    },
                    { marketListings: { some: { status: { in: ["ACTIVE", "RESERVED"] } } } },
                ],
            },
            select: { id: true, userId: true },
            orderBy: { archivedAt: "desc" },
            take: Math.min(200, Math.max(1, opts.limit ?? 50)),
        });

        for (const profile of candidates) {
            const closed = await closeMemberPublishedContent(
                discordGuildId,
                profile.id,
                profile.userId,
                "ORPHAN_SWEEP"
            );
            totals.profiles++;
            totals.dj += closed.dj;
            totals.runs += closed.runs;
            totals.events += closed.events;
            totals.market += closed.market;
        }

        if (totals.profiles > 0) {
            logger.info("[OrphanContent] contenu fantôme fermé", { discordGuildId, ...totals });
        }
    } catch (error) {
        // Best-effort : un échec de la passe ne doit jamais casser la synchro qui l'appelle.
        logger.error("[OrphanContent] passe impossible", { discordGuildId, error: String(error) });
    }
    return totals;
}
