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
import { fetchGuildBans, fetchAllGuildMembers, fetchAuditExecutor, executorMetadata, DISCORD_AUDIT_ACTIONS } from "@/server/discord";
import { sendLifecycleNotification } from "./lifecycle-actions";
import { isGuildUnavailableError } from "@/lib/discord-guild-errors";

interface SyncResult {
    success: boolean;
    archived: number;
    reactivated: number;
    errors: string[];
    /** Guildes ignorées sans échec (bot kické / intent coupé) — remonte en warning God. */
    warnings?: string[];
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
                    // Exécutant réel du ban (staff ou bot tiers), pas le cliqueur du sync.
                    const banEx = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.BAN_ADD, discordUserId).catch(() => null);
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
                        actorUserId: "SYSTEM",
                        actorName: "Vérification auto",
                        action: "PROFILE_ARCHIVED",
                        targetType: "PROFILE",
                        targetId: profile.id,
                        metadata: { description: profile.discordNickname || profile.userId, reason: "Banni sur Discord", ...executorMetadata(banEx, discordUserId) }
                    });
                } else {
                    // Member LEFT Discord - Archive for 12 months (Retention policy)
                    // Auteur réel : exclu par un staff/bot (journal d'audit) ou parti de lui-même.
                    // « lui-même » uniquement si le journal a bien été lu (checked) : sans
                    // permission d'audit on n'accuse personne (aucune mention « par »).
                    let kickEx = null;
                    let kickAuditChecked = false;
                    try {
                        kickEx = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.KICK, discordUserId);
                        kickAuditChecked = true;
                    } catch {
                        kickAuditChecked = false;
                    }
                    const kicked = kickEx && kickEx.userId !== discordUserId ? kickEx : null;
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
                        actorUserId: "SYSTEM",
                        actorName: "Vérification auto",
                        action: "PROFILE_ARCHIVED",
                        targetType: "PROFILE",
                        targetId: profile.id,
                        metadata: { 
                            description: profile.discordNickname || profile.userId, 
                            reason: kicked ? "Exclu du serveur" : "A quitté le serveur",
                            retention: "12_MONTHS",
                            ...(kicked
                                ? executorMetadata(kicked, discordUserId)
                                : kickAuditChecked
                                  ? { executorId: discordUserId, executorIsSelf: true }
                                  : {})
                        }
                    });
                }
                result.archived++;
            }
            else if (profile.status === "ARCHIVED" && !isInGuild && bannedUserIds.has(discordUserId)) {
                // Banni Discord APRÈS le départ → promotion ARCHIVED → BANNED.
                // Exécutant réel du ban (staff ou bot tiers), pas le cliqueur du sync.
                const banEx2 = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.BAN_ADD, discordUserId).catch(() => null);
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
                    actorUserId: "SYSTEM",
                    actorName: "Vérification auto",
                    action: "PROFILE_ARCHIVED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId, reason: "Banni sur Discord après son départ", ...executorMetadata(banEx2, discordUserId) }
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

                // 📝 Audit Log Reactivation (Sync)
                await createAuditLog({
                    guildId: discordGuildId,
                    actorUserId: "SYSTEM",
                    actorName: "Vérification auto",
                    action: "PROFILE_REACTIVATED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId, reason: "De retour sur le serveur", executorId: discordUserId, executorIsSelf: true }
                });
                result.reactivated++;
            }
            else if (profile.status === "BANNED" && !isInGuild && !bannedUserIds.has(discordUserId)) {
                // Déban Discord sans retour → BANNED → ARCHIVED (réactivé auto au retour, sans staff).
                const unbanEx = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.BAN_REMOVE, discordUserId).catch(() => null);
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
                await db.guildMemberBan.updateMany({
                    where: { guildId: (profile as { guildId?: string }).guildId ?? "", discordId: discordUserId, liftedAt: null },
                    data: { liftedAt: new Date(), liftedBy: "SYSTEM", liftedByName: "Vérification auto" }
                }).catch(() => null);
                await createAuditLog({
                    guildId: discordGuildId,
                    actorUserId: "SYSTEM",
                    actorName: "Vérification auto",
                    action: "PROFILE_REACTIVATED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId, reason: "Débanni sur Discord", ...executorMetadata(unbanEx, discordUserId) }
                });
                result.reactivated++;
            }
            else if (profile.status === "BANNED" && isInGuild && !bannedUserIds.has(discordUserId)) {
                // Déban partout → ACTIVE direct, sans étape staff (débanni + de retour = actif).
                const unbanEx2 = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.BAN_REMOVE, discordUserId).catch(() => null);
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: { status: "ACTIVE", archivedAt: null, archiveReason: null, scheduledDeletion: null }
                });
                await db.guildMemberBan.updateMany({
                    where: { guildId: (profile as { guildId?: string }).guildId ?? "", discordId: discordUserId, liftedAt: null },
                    data: { liftedAt: new Date(), liftedBy: "SYSTEM", liftedByName: "Vérification auto" }
                }).catch(() => null);
                await createAuditLog({
                    guildId: discordGuildId,
                    actorUserId: "SYSTEM",
                    actorName: "Vérification auto",
                    action: "PROFILE_REACTIVATED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId, reason: "Débanni sur Discord", ...executorMetadata(unbanEx2, discordUserId) }
                });
                result.reactivated++;
            }
            // Note: BANNED + hors guilde + toujours banni → on ne touche à rien
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
        // Fail-soft : 404 (bot kické / guilde supprimée) ou 403 (intent coupé)
        // = état de config permanent → on ignore LA guilde en warning SANS
        // faire échouer tout le cron. Toute autre erreur reste un échec
        // (fail-closed : état inconnu → on n'archive personne en silence).
        let discordMemberIds: Set<string>;
        try {
            discordMemberIds = await fetchAllGuildMembers(discordGuildId);
        } catch (err) {
            if (isGuildUnavailableError(err)) {
                const reason = err instanceof Error ? err.message : "Discord indisponible";
                logger.warn(`[Sync] Guilde ${discordGuildId} ignorée: ${reason}`);
                return { success: true, archived: 0, reactivated: 0, errors: [], warnings: [`${discordGuildId}: ${reason}`] };
            }
            throw err;
        }
        const discordBans = await fetchGuildBans(discordGuildId).catch(() => []);

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
                    // Exécutant réel du ban (staff ou bot tiers).
                    const banExCron = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.BAN_ADD, discordUserId).catch(() => null);
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
                    await sendLifecycleNotification(discordGuildId, profile, "BANNED", "Vérification automatique").catch(() => null);

                    await createAuditLog({
                        guildId: discordGuildId,
                        actorUserId: "SYSTEM",
                        actorName: "Vérification auto",
                        action: "PROFILE_ARCHIVED",
                        targetType: "PROFILE",
                        targetId: profile.id,
                        metadata: { description: profile.discordNickname || profile.userId, reason: "Banni sur Discord", ...executorMetadata(banExCron, discordUserId) }
                    });
                } else {
                    // Auteur réel : exclu par un staff/bot ou parti de lui-même (cf. manuel).
                    let kickExCron = null;
                    let kickAuditCheckedCron = false;
                    try {
                        kickExCron = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.KICK, discordUserId);
                        kickAuditCheckedCron = true;
                    } catch {
                        kickAuditCheckedCron = false;
                    }
                    const kickedCron = kickExCron && kickExCron.userId !== discordUserId ? kickExCron : null;
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
                    await sendLifecycleNotification(discordGuildId, profile, "LEFT", "Vérification automatique").catch(() => null);

                    // 📝 Audit Log (Internal/Cron)
                    await createAuditLog({
                        guildId: discordGuildId,
                        actorUserId: "SYSTEM",
                        actorName: "Vérification auto",
                        action: "PROFILE_ARCHIVED",
                        targetType: "PROFILE",
                        targetId: profile.id,
                        metadata: { 
                            description: profile.discordNickname || profile.userId, 
                            reason: kickedCron ? "Exclu du serveur" : "A quitté le serveur",
                            retention: "12_MONTHS",
                            ...(kickedCron
                                ? executorMetadata(kickedCron, discordUserId)
                                : kickAuditCheckedCron
                                  ? { executorId: discordUserId, executorIsSelf: true }
                                  : {})
                        }
                    });
                }
                result.archived++;
            } else if (profile.status === "ARCHIVED" && !isInGuild && bannedUserIds.has(discordUserId)) {
                // Banni Discord APRÈS le départ → promotion ARCHIVED → BANNED.
                const banExCron2 = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.BAN_ADD, discordUserId).catch(() => null);
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: {
                        status: "BANNED",
                        archivedAt: new Date(),
                        archiveReason: "BANNED",
                        scheduledDeletion: null
                    }
                });

                await sendLifecycleNotification(discordGuildId, profile, "BANNED", "Vérification automatique").catch(() => null);

                await createAuditLog({
                    guildId: discordGuildId,
                    actorUserId: "SYSTEM",
                    actorName: "Vérification auto",
                    action: "PROFILE_ARCHIVED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId, reason: "Banni sur Discord après son départ", ...executorMetadata(banExCron2, discordUserId) }
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

                // 📝 Audit Log (Internal/Cron)
                await createAuditLog({
                    guildId: discordGuildId,
                    actorUserId: "SYSTEM",
                    actorName: "Vérification auto",
                    action: "PROFILE_REACTIVATED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId, reason: "De retour sur le serveur", executorId: discordUserId, executorIsSelf: true }
                });
                result.reactivated++;
            } else if (profile.status === "BANNED" && !isInGuild && !bannedUserIds.has(discordUserId)) {
                // Déban Discord sans retour → BANNED → ARCHIVED (réactivé auto au retour, sans staff).
                const unbanExCron = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.BAN_REMOVE, discordUserId).catch(() => null);
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
                await db.guildMemberBan.updateMany({
                    where: { guildId: (profile as { guildId?: string }).guildId ?? "", discordId: discordUserId, liftedAt: null },
                    data: { liftedAt: new Date(), liftedBy: "SYSTEM", liftedByName: "Vérification auto" }
                }).catch(() => null);
                await createAuditLog({
                    guildId: discordGuildId,
                    actorUserId: "SYSTEM",
                    actorName: "Vérification auto",
                    action: "PROFILE_REACTIVATED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId, reason: "Débanni sur Discord", ...executorMetadata(unbanExCron, discordUserId) }
                });
                result.reactivated++;
            } else if (profile.status === "BANNED" && isInGuild && !bannedUserIds.has(discordUserId)) {
                // Déban partout → ACTIVE direct, sans étape staff.
                const unbanExCron2 = await fetchAuditExecutor(discordGuildId, DISCORD_AUDIT_ACTIONS.BAN_REMOVE, discordUserId).catch(() => null);
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: { status: "ACTIVE", archivedAt: null, archiveReason: null, scheduledDeletion: null }
                });
                await db.guildMemberBan.updateMany({
                    where: { guildId: (profile as { guildId?: string }).guildId ?? "", discordId: discordUserId, liftedAt: null },
                    data: { liftedAt: new Date(), liftedBy: "SYSTEM", liftedByName: "Vérification auto" }
                }).catch(() => null);
                await createAuditLog({
                    guildId: discordGuildId,
                    actorUserId: "SYSTEM",
                    actorName: "Vérification auto",
                    action: "PROFILE_REACTIVATED",
                    targetType: "PROFILE",
                    targetId: profile.id,
                    metadata: { description: profile.discordNickname || profile.userId, reason: "Débanni sur Discord", ...executorMetadata(unbanExCron2, discordUserId) }
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
