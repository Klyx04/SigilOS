/**
 * Member Lifecycle Actions
 * Server actions for managing archived profiles and RGPD compliance
 */

"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// Retention periods in days
const RETENTION_DAYS = {
    LEFT: 90,    // Voluntary departure: 90 days
    KICKED: 30,  // Kicked by admin: 30 days
    BANNED: 0,   // Already anonymized immediately
    GDPR_REQUEST: 0 // Immediate deletion on GDPR request
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
        if (result.count > 0) {
            console.log(`[Lifecycle] Deleted ${result.count} ${reason} profiles older than ${days} days`);
        }
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

    if (result.count > 0) {
        console.log(`[Lifecycle] Reactivated profile for returning member ${userId}`);
    }

    return result.count > 0;
}

/**
 * Get archived profiles for admin review
 */
export async function getArchivedProfiles(discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAdmin) {
        return { success: false, error: "Unauthorized", profiles: [] };
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
        take: 50
    });

    return { success: true, profiles };
}

/**
 * Handle GDPR deletion request (Right to be Forgotten)
 * User can request deletion of their own data
 */
export async function handleGdprDeletionRequest(discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAuthenticated || !ctx.id) {
        return { success: false, error: "Unauthorized" };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true }
    });

    if (!guild) {
        return { success: false, error: "Guild not found" };
    }

    // Find the profile first
    const profile = await db.userProfile.findUnique({
        where: {
            userId_guildId: {
                userId: ctx.id,
                guildId: guild.id
            }
        }
    });

    if (!profile) return { success: true, deleted: false };

    // Delete the user's profile for this guild
    await db.userProfile.delete({
        where: { id: profile.id }
    });

    // --- GDPR CLEANUP (Orphaned User check) ---
    // If user has no more profiles in any guild, we delete their account and personal info
    const otherProfilesCount = await db.userProfile.count({
        where: { userId: ctx.id }
    });

    if (otherProfilesCount === 0) {
        console.log(`[GDPR] User ${ctx.id} has no more profiles. Deleting global account data.`);
        await db.user.delete({
            where: { id: ctx.id }
        });
        // Note: Prisma is configured with Cascade Delete for Accounts and Sessions
    }

    return { success: true, deleted: true };
}
/**
 * ARCHIVE & SYNC GUILD MEMBERS
 * Compares Discord members with local profiles and archives members who are no longer in the guild.
 * This is the "Military Grade" cleanup requested.
 */
export async function syncGuildMembers(discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAdmin) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const { listGuildMembers } = await import("@/server/discord");

        // 1. Fetch current members from Discord
        const discordMembers = await listGuildMembers(discordGuildId);
        const discordUserIds = new Set(discordMembers.map(m => m.user.id));

        // 2. Fetch all profiles for this guild with their Discord Accounts
        const profiles = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId },
                status: "ACTIVE" // Only check active ones
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
        const discordBans = await (await import("@/server/discord")).fetchGuildBans(discordGuildId);
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
                    console.log(`[Lifecycle Sync] Anonymizing BANNED member ${profile.discordNickname}`);
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            status: "BANNED",
                            archivedAt: new Date(),
                            archiveReason: "BANNED",
                            // --- GDPR WIPE (Suppression des données lourdes) ---
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
                    bannedCount++;
                } else {
                    console.log(`[Lifecycle Sync] Archiving ${profile.discordNickname} (left Discord)`);
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            status: "ARCHIVED",
                            archivedAt: new Date(),
                            archiveReason: "LEFT"
                        }
                    });
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
 * Force deep anonymization for an archived profile (e.g. after a kick/expulsion)
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
                status: "BANNED", // On passe en statut BANNED pour bloquer tout retour et marquer le wipe
                archiveReason: "KICKED",
                // --- GDPR WIPE ---
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
