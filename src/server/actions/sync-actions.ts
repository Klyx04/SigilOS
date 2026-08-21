/**
 * Member Sync Actions
 * 
 * Synchronizes Discord guild membership with database profiles.
 * Archives profiles for members who left the Discord guild.
 * 
 * Usage:
 * - Manual trigger from admin panel
 * - Vercel Cron (recommended: daily)
 * - API endpoint for external cron services
 */

"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { logger } from "@/lib/logger";
import { createAuditLog } from "./audit-actions";
import { fetchGuildBans, fetchAllGuildMembers } from "@/server/discord";
import { sendLifecycleNotification } from "./lifecycle-actions";

interface SyncResult {
    success: boolean;
    archived: number;
    reactivated: number;
    errors: string[];
    details?: {
        totalDiscordMembers: number;
        totalActiveProfiles: number;
        skipped: number;
    };
}



/**
 * Sync membership status for a guild
 * Archives profiles for members who left Discord
 * Can optionally reactivate archived members who returned
 */
export async function syncMembershipStatus(
    discordGuildId: string,
    options: { reactivateReturning?: boolean } = { reactivateReturning: true }
): Promise<SyncResult> {
    // Authorization check
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAdmin) {
        return { success: false, archived: 0, reactivated: 0, errors: ["Unauthorized - Admin only"] };
    }

    const result: SyncResult = {
        success: true,
        archived: 0,
        reactivated: 0,
        errors: [],
    };

    try {
        // 1. Get guild config
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true, name: true }
        });

        if (!guild) {
            return { success: false, archived: 0, reactivated: 0, errors: ["Guild not found in database"] };
        }

        // 2. Fetch all Discord members and bans
        const [discordMemberIds, discordBans] = await Promise.all([
            fetchAllGuildMembers(discordGuildId),
            fetchGuildBans(discordGuildId).catch(() => [])
        ]);

        const bannedUserIds = new Set(discordBans.map(b => b.user.id));

        // 3. Get all profiles for this guild
        const profiles = await db.userProfile.findMany({
            where: { guildId: guild.id },
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


        let skipped = 0;

        for (const profile of profiles) {
            const discordAccount = profile.user.accounts[0];

            if (!discordAccount) {
                // No Discord account linked, skip
                skipped++;
                continue;
            }

            const discordUserId = discordAccount.providerAccountId;
            const isInGuild = discordMemberIds.has(discordUserId);

            if (profile.status === "ACTIVE" && !isInGuild) {
                // Member is no longer in Discord - Check if they were banned
                const isBannedOnDiscord = bannedUserIds.has(discordUserId);
                
                if (isBannedOnDiscord) {
                    // Member was BANNED on Discord - Archive with BANNED status
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            status: "BANNED",
                            archivedAt: new Date(),
                            archiveReason: "BANNED",
                            scheduledDeletion: null // No automatic deletion for bans
                        }
                    });

                    await createAuditLog({
                        guildId: discordGuildId,
                        actorUserId: ctx.id || "SYSTEM",
                        actorName: ctx.name || "Admin Sync",
                        action: "PROFILE_ARCHIVED",
                        targetType: "PROFILE",
                        targetId: profile.id,
                        metadata: { description: profile.discordNickname || profile.userId, reason: "BANNED_FROM_DISCORD" }
                    });
                } else {
                    // Member LEFT Discord - Archive for 12 months (Retention policy)
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
                    
                    // 📝 Audit Log Archival (Sync)
                    await createAuditLog({
                        guildId: discordGuildId,
                        actorUserId: ctx.id || "SYSTEM",
                        actorName: ctx.name || "Admin Sync",
                        action: "PROFILE_ARCHIVED",
                        targetType: "PROFILE",
                        targetId: profile.id,
                        metadata: { 
                            description: profile.discordNickname || profile.userId, 
                            reason: "LEFT_GUILD",
                            retention: "12_MONTHS"
                        }
                    });
                }
                result.archived++;
            }
            else if (
                profile.status === "ARCHIVED" &&
                isInGuild &&
                options.reactivateReturning &&
                // SECURITY: Only auto-reactivate profiles archived because they LEFT Discord.
                // Never reactivate manual bans, suspensions or scheduled deletions.
                (profile.archiveReason === "LEFT" || profile.archiveReason === "LEFT_GUILD")
            ) {
                // Member returned to Discord - Reactivate their profile
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: {
                        status: "ACTIVE",
                        archivedAt: null,
                        archiveReason: null,
                        scheduledDeletion: null
                    }
                });

                // 📝 Audit Log Reactivation (Sync)
                await createAuditLog({
                    guildId: discordGuildId,
                    actorUserId: ctx.id || "SYSTEM",
                    actorName: ctx.name || "Admin Sync",
                    action: "PROFILE_REACTIVATED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId }
                });
                result.reactivated++;
            }
            // Note: BANNED profiles are never reactivated by sync
        }

        result.details = {
            totalDiscordMembers: discordMemberIds.size,
            totalActiveProfiles: profiles.filter(p => p.status === "ACTIVE").length,
            skipped
        };


    } catch (error) {
        result.success = false;
        result.errors.push(error instanceof Error ? error.message : "Unknown error");
        logger.error("[Sync] Error:", error);
    }

    return result;
}

/**
 * Sync all whitelisted guilds
 * For use in cron jobs
 */
export async function syncAllGuilds(): Promise<{ results: Record<string, SyncResult> }> {
    const whitelistVar = process.env.ALLOWED_GUILD_IDS;

    if (!whitelistVar) {
        // No whitelist = get all guilds from database
        const guilds = await db.guildConfig.findMany({
            select: { discordGuildId: true }
        });

        const results: Record<string, SyncResult> = {};
        for (const guild of guilds) {
            // Note: This bypasses admin check intentionally for cron
            results[guild.discordGuildId] = await syncMembershipStatusInternal(guild.discordGuildId);
        }
        return { results };
    }

    const guildIds = whitelistVar.split(",").map(id => id.trim()).filter(Boolean);
    const results: Record<string, SyncResult> = {};

    for (const guildId of guildIds) {
        results[guildId] = await syncMembershipStatusInternal(guildId);
    }

    return { results };
}

/**
 * Internal sync without auth check (for cron use)
 */
async function syncMembershipStatusInternal(discordGuildId: string): Promise<SyncResult> {
    const result: SyncResult = {
        success: true,
        archived: 0,
        reactivated: 0,
        errors: [],
    };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true, name: true }
        });

        if (!guild) {
            return { success: false, archived: 0, reactivated: 0, errors: ["Guild not found"] };
        }

        // 2. Fetch all Discord members and bans
        const [discordMemberIds, discordBans] = await Promise.all([
            fetchAllGuildMembers(discordGuildId),
            fetchGuildBans(discordGuildId).catch(() => [])
        ]);

        const bannedUserIds = new Set(discordBans.map(b => b.user.id));

        const profiles = await db.userProfile.findMany({
            where: { guildId: guild.id },
            include: {
                user: {
                    include: {
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    },
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

        for (const profile of profiles) {
            const discordAccount = profile.user.accounts[0];
            if (!discordAccount) continue;

            const discordUserId = discordAccount.providerAccountId;
            const isInGuild = discordMemberIds.has(discordUserId);

            if (profile.status === "ACTIVE" && !isInGuild) {
                const isBannedOnDiscord = bannedUserIds.has(discordUserId);

                if (isBannedOnDiscord) {
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            status: "BANNED",
                            archivedAt: new Date(),
                            archiveReason: "BANNED",
                            scheduledDeletion: null
                        }
                    });

                    // 🔔 Lifecycle notification (embed Discord)
                    await sendLifecycleNotification(discordGuildId, profile, "BANNED", "SYNC (Détection automatique)").catch(() => null);

                    await createAuditLog({
                        guildId: discordGuildId,
                        actorUserId: "SYSTEM",
                        actorName: "Internal Sync Bot",
                        action: "PROFILE_ARCHIVED",
                        targetType: "PROFILE",
                        targetId: profile.id,
                        metadata: { description: profile.discordNickname || profile.userId, reason: "BANNED_FROM_DISCORD" }
                    });
                } else {
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

                    // 🔔 Lifecycle notification (embed Discord)
                    await sendLifecycleNotification(discordGuildId, profile, "LEFT", "SYNC (Détection automatique)").catch(() => null);

                    // 📝 Audit Log (Internal/Cron)
                    await createAuditLog({
                        guildId: discordGuildId,
                        actorUserId: "SYSTEM",
                        actorName: "Internal Sync Bot",
                        action: "PROFILE_ARCHIVED",
                        targetType: "PROFILE",
                        targetId: profile.id,
                        metadata: { 
                            description: profile.discordNickname || profile.userId, 
                            reason: "LEFT_GUILD",
                            retention: "12_MONTHS"
                        }
                    });
                }
                result.archived++;
            } else if (
                profile.status === "ARCHIVED" &&
                isInGuild &&
                (profile.archiveReason === "LEFT" || profile.archiveReason === "LEFT_GUILD")
            ) {
                // SECURITY: Only reactivate profiles that left voluntarily — not manual bans/suspensions
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: {
                        status: "ACTIVE",
                        archivedAt: null,
                        archiveReason: null,
                        scheduledDeletion: null
                    }
                });

                // 📝 Audit Log (Internal/Cron)
                await createAuditLog({
                    guildId: discordGuildId,
                    actorUserId: "SYSTEM",
                    actorName: "Internal Sync Bot",
                    action: "PROFILE_REACTIVATED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId }
                });
                result.reactivated++;
            }
        }

        result.details = {
            totalDiscordMembers: discordMemberIds.size,
            totalActiveProfiles: profiles.filter(p => p.status === "ACTIVE").length,
            skipped: 0
        };

    } catch (error) {
        result.success = false;
        result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
}
