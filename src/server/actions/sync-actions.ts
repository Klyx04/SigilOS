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

const DISCORD_API = "https://discord.com/api/v10";

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
 * Fetch all members from a Discord guild
 * Uses pagination to handle large guilds (1000 members per request)
 */
async function fetchAllGuildMembers(discordGuildId: string): Promise<Set<string>> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("DISCORD_BOT_TOKEN not configured");

    const memberIds = new Set<string>();
    let after = "0";
    let hasMore = true;

    while (hasMore) {
        const res = await fetch(
            `${DISCORD_API}/guilds/${discordGuildId}/members?limit=1000&after=${after}`,
            {
                headers: { Authorization: `Bot ${token}` },
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error(`[Sync] Failed to fetch members: ${res.status} - ${errText}`);

            if (res.status === 403) {
                throw new Error("Discord API Forbidden (403): Le bot n'a probablement pas l'intent 'Server Members' activé dans le portail développeur Discord.");
            }

            throw new Error(`Discord API error: ${res.status} (${res.statusText})`);
        }

        const members = await res.json();

        for (const member of members) {
            memberIds.add(member.user.id);
        }

        if (members.length < 1000) {
            hasMore = false;
        } else {
            after = members[members.length - 1].user.id;
        }
    }

    logger.info(`[Sync] Successfully fetched ${memberIds.size} unique member IDs from Discord.`);
    return memberIds;
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

        // 2. Fetch all Discord members
        const discordMemberIds = await fetchAllGuildMembers(discordGuildId);

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
                // Member left Discord - Archive their profile
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: {
                        status: "ARCHIVED",
                        archivedAt: new Date(),
                        archiveReason: "LEFT"
                    }
                });
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
        console.error("[Sync] Error:", error);
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

        const discordMemberIds = await fetchAllGuildMembers(discordGuildId);

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

        for (const profile of profiles) {
            const discordAccount = profile.user.accounts[0];
            if (!discordAccount) continue;

            const isInGuild = discordMemberIds.has(discordAccount.providerAccountId);

            if (profile.status === "ACTIVE" && !isInGuild) {
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: {
                        status: "ARCHIVED",
                        archivedAt: new Date(),
                        archiveReason: "LEFT"
                    }
                });
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
