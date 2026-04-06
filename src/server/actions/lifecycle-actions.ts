/**
 * Member Lifecycle Actions
 * Server actions for managing archived profiles and RGPD compliance
 */

"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createAuditLog } from "./audit-actions";
import { auth } from "@/auth";

/**
 * Archive a profile (Self-service or Admin)
 */
export async function archiveProfile(guildId: string, profileId?: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    const targetProfileId = profileId || ctx.profileId;
    if (!targetProfileId) return { success: false, error: "No profile found" };

    // Security check: Only self or manager can archive
    if (targetProfileId !== ctx.profileId && !ctx.canManageMembers) {
        return { success: false, error: "Forbidden" };
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

        await db.userProfile.update({
            where: { id: targetProfileId },
            data: {
                status: "ARCHIVED",
                archivedAt: new Date(),
                archiveReason: profileId ? "ADMIN_ACTION" : "USER_LEAVE"
            }
        });

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

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (e) {
        console.error("Archive error:", e);
        return { success: false, error: "Database error" };
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
                        profiles: { select: { id: true } }
                    }
                }
            }
        });

        if (!target) return { success: false, error: "Profile not found" };

        const targetUserId = target.userId;
        const hasOtherProfiles = target.user.profiles.length > 1;

        // 1. Delete the UserProfile — cascades to all guild-scoped data
        await db.userProfile.delete({ where: { id: profileId } });

        // 2. Invalidate ALL active sessions (force re-auth immediately)
        await db.session.deleteMany({ where: { userId: targetUserId } });

        // 3. If no other guild profiles → full account wipe (User + Account OAuth + Notifications)
        if (!hasOtherProfiles) {
            await db.user.delete({ where: { id: targetUserId } });
        }

        await createAuditLog({
            guildId,
            action: "MEMBER_PURGED" as any,
            actorUserId: ctx.id as string,
            actorName: ctx.name ?? "Inconnu",
            targetType: "PROFILE" as any,
            targetId: targetUserId,
            metadata: {
                description: `Purge définitive : ${target.user.name || profileId}`,
                reason: "Purge administrative Super Admin",
                fullAccountDeleted: !hasOtherProfiles,
                sessionsInvalidated: true
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (e) {
        console.error("Delete error:", e);
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

        await db.userProfile.update({
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
        console.error("[Reactivate] Error:", e);
        return { success: false, error: "Erreur base de données" };
    }
}

// Retention periods in days
const RETENTION_DAYS = {
    USER_LEAVE: 90,    // Voluntary departure: 90 days
    LEFT: 90,          // Left via sync: 90 days
    ADMIN_ACTION: 30,  // Archived by admin: 30 days
    KICKED: 30,        // Wiped by admin: 30 days
    BANNED: 0,         // Already anonymized immediately
    GDPR_REQUEST: 0    // Immediate deletion on GDPR request
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
        include: {
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
            include: { guild: true }
        });

        const { fetchGuild } = await import("@/server/discord");
        const { createAuditLog } = await import("./audit-actions");

        let ownedCount = 0;
        let blockedGuildName = "";

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
                    console.error(`[GDPR Deletion] Failed to fetch owner from Discord for ${profile.guild.name}:`, err);
                }
            }

            // check if user is the owner
            if (currentOwnerId && (currentOwnerId === userId || currentOwnerId === discordId)) {
                ownedCount++;
                blockedGuildName = profile.guild.name;
            }

            // Create Audit Log BEFORE deletion so it persist in God Dashboard
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
                console.error(`[GDPR Deletion] Audit log failed for guild ${profile.guild.name}:`, auditErr);
                // Don't block deletion if audit log fails, but it's bad
            }
        }

        if (ownedCount > 0) {
            console.warn(`[GDPR Deletion] Blocked: User is technical owner of ${ownedCount} guilds`);
            return {
                success: false,
                error: `Impossible de supprimer : vous êtes propriétaire de ${ownedCount} guilde(s) (ex: ${blockedGuildName}). Transférez la propriété sur Discord d'abord.`
            };
        }

        // Supprimons simplement le user (Cascade s'occupe du reste)
        await db.user.delete({
            where: { id: userId }
        });

        return { success: true };
    } catch (e: any) {
        console.error("[GDPR Deletion] FATAL:", e);
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
        const { listGuildMembers, fetchGuildBans } = await import("@/server/discord");

        // 1. Fetch current members from Discord
        const discordMembers = await listGuildMembers(discordGuildId);
        const discordUserIds = new Set(discordMembers.map(m => m.user.id));

        // 2. Fetch all profiles for this guild with their Discord Accounts
        const profiles = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId },
                status: "ACTIVE"
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

                if (isBanned) {
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

                    // 📝 AUDIT LOG Departure (Banned)
                    try {
                        const { createAuditLog: log } = await import("./audit-actions");
                        await log({
                            guildId: discordGuildId,
                            actorUserId: "SYSTEM",
                            actorName: "Sync System",
                            action: "MEMBER_BANNED" as any,
                            targetType: "PROFILE",
                            targetId: profile.id,
                            metadata: { 
                                description: profile.pseudoDofus || profile.discordNickname || "Inconnu",
                                reason: "Bannissement Discord détecté lors de la synchro"
                            }
                        });
                    } catch (e) { console.error("[Lifecycle Sync] Audit failed", e); }

                    bannedCount++;
                } else {
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            status: "ARCHIVED",
                            archivedAt: new Date(),
                            archiveReason: "LEFT"
                        }
                    });

                    // 📝 AUDIT LOG Departure (Left)
                    try {
                        const { createAuditLog: log } = await import("./audit-actions");
                        await log({
                            guildId: discordGuildId,
                            actorUserId: "SYSTEM",
                            actorName: "Sync System",
                            action: "MEMBER_LEFT" as any,
                            targetType: "PROFILE",
                            targetId: profile.id,
                            metadata: { 
                                description: profile.pseudoDofus || profile.discordNickname || "Inconnu",
                                reason: "Départ Discord détecté lors de la synchro"
                            }
                        });
                    } catch (e) { console.error("[Lifecycle Sync] Audit failed", e); }

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
        console.error("[Lifecycle Sync] Error:", error);
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

        revalidatePath(`/dashboard/${discordGuildId}/admin`);
        return { success: true };
    } catch (error) {
        console.error("[Manual Wipe] Error:", error);
        return { success: false, error: "Erreur lors du nettoyage" };
    }
}
