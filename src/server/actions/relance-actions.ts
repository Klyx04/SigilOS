"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext } from "./user-actions";
import { logger } from "@/lib/logger";
import { 
    sendDirectMessage, 
    sendChannelMessage, 
    addRoleToMember, 
    removeRoleFromMember,
    listGuildMembers
} from "@/server/discord";
import { revalidatePath } from "next/cache";
import { getDofusWeek } from "@/lib/date-utils";
import { getGameDisplayName } from "@/lib/display-name";
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";

export type ActionResponse<T = any> = {
    success: boolean;
    error?: string;
    data?: T;
};

const RelanceSchema = z.object({
    guildId: z.string(),
    targetUserIds: z.array(z.string()), // Discord IDs
    type: z.enum(["DM", "CHANNEL", "BULK"]),
    message: z.string().min(1, "Message requis"),
    channelId: z.string().optional(),
    addRoleId: z.string().optional(),
    removeRoleId: z.string().optional(),
    criteria: z.string().optional(),
});

/**
 * Get potential candidates for a relance
 */
export async function getRelanceCandidates(
    guildId: string, 
    criteria: "MISSING_MISSIONS" | "INACTIVE" | "LADDER_INACTIVE" | "DOFUS_INACTIVE" | "DISCORD_INACTIVE" | "GLOBAL_INACTIVE",
    inactiveDays: number = 7
): Promise<ActionResponse<any[]>> {
    const user = await getUserContext(guildId);
    if (!user.isAdmin && !user.canManageRelance) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            include: { 
                profiles: { 
                    where: { status: "ACTIVE" }, 
                    include: { 
                        user: { include: { accounts: true } } 
                    } 
                } 
            }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        let candidates: any[] = [];
        const now = new Date();

        // 1. Filter out members currently on vacation (unless manual targeting)
        const eligibleProfiles = criteria === "DOFUS_INACTIVE" ? guildConfig.profiles : guildConfig.profiles.filter((p: any) => {
            if (p.vacationStart && p.vacationEnd) {
                return !(now >= p.vacationStart && now <= p.vacationEnd);
            }
            return true;
        });

        if (criteria === "MISSING_MISSIONS") {
            const { week, year } = getDofusWeek();
            
            // Profiles who haven't validated any mission this week
            const validatedSubmissions = await db.submission.findMany({
                where: {
                    mission: {
                        guildId: guildConfig.id,
                        weekNumber: week,
                        year
                    },
                    status: "VALIDATED"
                },
                select: { profileId: true }
            });

            const validatedProfileIds = new Set(validatedSubmissions.map(s => s.profileId));
            
            candidates = eligibleProfiles.filter((p: any) => !validatedProfileIds.has(p.id));
        } else if (criteria === "INACTIVE") {
            const threshold = new Date();
            threshold.setDate(threshold.getDate() - inactiveDays);

            candidates = eligibleProfiles.filter((p: any) => {
                const lastSeen = p.lastSeen || p.lastActivityAt || p.updatedAt;
                return lastSeen < threshold;
            });
        } else if (criteria === "LADDER_INACTIVE") {
            const threshold = new Date(now);
            threshold.setDate(threshold.getDate() - inactiveDays);

            candidates = eligibleProfiles.filter((p: any) => {
                // If they never synchronized their ladder or hasn't updated since threshold
                if (!p.lastLadderUpdate) return true;
                return p.lastLadderUpdate < threshold;
            });
        } else if (criteria === "DOFUS_INACTIVE") {
            // Return all active members for manual selection (no filters)
            candidates = guildConfig.profiles;
        } else if (criteria === "DISCORD_INACTIVE") {
            // No message AND No voice this week
            candidates = eligibleProfiles.filter((p: any) => 
                (p.discordMessageCountWeekly || 0) === 0 && 
                (p.discordVoiceTimeWeekly || 0) === 0
            );
        } else if (criteria === "GLOBAL_INACTIVE") {
            // No mission + No dashboard + No discord
            const { week, year } = getDofusWeek();
            const threshold = new Date(now);
            threshold.setDate(threshold.getDate() - inactiveDays);

            const validatedSubmissions = await db.submission.findMany({
                where: { mission: { guildId: guildConfig.id, weekNumber: week, year }, status: "VALIDATED" },
                select: { profileId: true }
            });
            const validatedProfileIds = new Set(validatedSubmissions.map(s => s.profileId));

            candidates = eligibleProfiles.filter((p: any) => {
                const isNoMission = !validatedProfileIds.has(p.id);
                const lastSeen = p.lastSeen || p.lastActivityAt || p.updatedAt;
                const isDashboardInactive = lastSeen < threshold;
                const isDiscordInactive = (p.discordMessageCountWeekly || 0) === 0 && (p.discordVoiceTimeWeekly || 0) === 0;
                
                return isNoMission && isDashboardInactive && isDiscordInactive;
            });
        }

        // Format candidates for UI
        const formatted = candidates.map(p => {
            const discordAccount = p.user.accounts.find((a: any) => a.provider === "discord");
            return {
                id: p.id,
                discordId: discordAccount?.providerAccountId,
                name: getGameDisplayName(p),
                image: p.user.image,
                lastSeen: p.lastSeen || p.lastActivityAt || p.updatedAt,
                discordStats: {
                    messages: p.discordMessageCountWeekly || 0,
                    voiceMin: p.discordVoiceTimeWeekly || 0,
                    lastMessage: p.lastDiscordMessageAt,
                    lastVoice: p.lastDiscordVoiceAt,
                    lastReaction: p.lastDiscordReactionAt,
                    lastTyping: p.lastDiscordTypingAt
                }
            };
        }).filter(c => !!c.discordId); // Only those with linked Discord

        return { success: true, data: formatted };
    } catch (error: any) {
        logger.error("Get Relance Candidates Error");
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Send the relance pings
 */
export async function sendRelance(rawData: z.infer<typeof RelanceSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = RelanceSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, targetUserIds, type, message, channelId, addRoleId, removeRoleId, criteria } = validation.data;

    if (!guildId) return { success: false, error: "ID de guilde requis" };

    const user = await getUserContext(guildId);
    if (!user.isAdmin && !user.canManageRelance) return { success: false, error: "Unauthorized" };

    // #55 — rate-limit strict : relancer ping des membres = spam Discord potentiel.
    // 5 envois / minute / (user + guilde) ; bornage cible (max 200 pings) fail-closed.
    const rateLimitResult = await rateLimit(`relance:${session.user.id}:${guildId}`, 5, 60_000);
    if (!rateLimitResult.success) {
        return { success: false, error: "Trop de relances envoyées, réessaie dans une minute." };
    }
    if (targetUserIds.length > 200) {
        return { success: false, error: "Maximum 200 membres par relance." };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const results = {
            sent: 0,
            failed: 0,
            rolesUpdated: 0
        };

        // 1. Send Messages
        if (type === "DM") {
            for (const discordId of targetUserIds) {
                const msgId = await sendDirectMessage(discordId, "", {
                    embedTitle: "🔔 Rappel de Guilde - SigilOS",
                    embedDescription: message,
                    embedColor: 0xffa500, // Orange
                    embedFooter: `Envoyé par ${user.name} depuis ${guildConfig.name}`,
                });
                if (msgId) results.sent++; else results.failed++;
            }
        } else if (type === "CHANNEL") {
            if (!channelId) return { success: false, error: "Salon requis for ce type de relance" };
            
            const mentions = targetUserIds.map(id => `<@${id}>`).join(" ");
            const msgId = await sendChannelMessage(channelId, `Bonjour ${mentions} !`, {
                embedTitle: "🔔 Rappel de Guilde",
                embedDescription: message,
                embedColor: 0xffa500,
                embedFooter: `SigilOS • ${guildConfig.name}`
            });
            if (msgId) results.sent = targetUserIds.length; else results.failed = targetUserIds.length;
        } else if (type === "BULK") {
            if (!channelId) return { success: false, error: "Salon requis" };
            const mentions = targetUserIds.map(id => `<@${id}>`).join(" ");
            const msgId = await sendChannelMessage(channelId, `⚠️ **RELANCE GÉNÉRALE**\nBonjour ${mentions} !`, {
                embedTitle: "🎯 Objectifs de Guilde",
                embedDescription: message,
                embedColor: 0xef4444, // Red
                embedFooter: "Ne soyez pas absents !"
            });
            if (msgId) results.sent = targetUserIds.length; else results.failed = targetUserIds.length;
        }

        // 2. Update Roles
        if (addRoleId || removeRoleId) {
            for (const discordId of targetUserIds) {
                if (addRoleId) await addRoleToMember(guildId, discordId, addRoleId);
                if (removeRoleId) await removeRoleFromMember(guildId, discordId, removeRoleId);
                results.rolesUpdated++;
            }
        }

        // 3. Save History
        await (db as any).relance.create({
            data: {
                guildId: guildConfig.id,
                adminId: session.user.id,
                type,
                targetIds: targetUserIds,
                message,
                criteria
            }
        });

        // 4. Audit Log
        const { createAuditLog } = await import("./audit-actions");
        await createAuditLog({
            guildId,
            actorUserId: session.user.id,
            actorName: user.name || "Admin",
            action: "MEMBER_RELANCE",
            targetType: "MEMBER",
            metadata: {
                type,
                count: targetUserIds.length,
                criteria,
                addRole: addRoleId,
                removeRole: removeRoleId
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/relance`);
        
        return { 
            success: true, 
            data: { message: `Relance envoyée avec succès (${results.sent} messages, ${results.rolesUpdated} rôles mis à jour)` } 
        };
    } catch (error: any) {
        logger.error("Send Relance Error");
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Send a manual nudge DM to a specific user to configure their profile
 */
export async function sendManualNudge(guildId: string, targetDiscordId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const user = await getUserContext(guildId);
    if (!user.isAdmin && !user.canManageRelance && !user.canManageMembers) {
        return { success: false, error: "Unauthorized" };
    }

    // #55 — rate-limit sur les nudges manuels (DM envoyés via le bot).
    const rateLimitResult = await rateLimit(`nudge:${session.user.id}:${guildId}`, 10, 60_000);
    if (!rateLimitResult.success) {
        return { success: false, error: "Trop de relances envoyées, réessaie dans une minute." };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const message = `Salut ! Pense à configurer ton pseudo Dofus et ta classe principale sur le Dashboard de la guilde pour avoir accès à tous les modules et fonctionnalités. Ça ne prend que 10 secondes : ${appUrl}/dashboard/${guildId}`;

        const msgId = await sendDirectMessage(targetDiscordId, "", {
            embedTitle: "🎓 Configuration Profil - SigilOS",
            embedDescription: message,
            embedColor: 0xec4899, // Pink
            embedFooter: `Relance envoyée par ${user.name || "un Administrateur"} de ${guildConfig.name}`,
        });

        if (!msgId) {
            return { success: false, error: "Impossible d'envoyer le message privé Discord (le membre a peut-être bloqué les DMs du bot)." };
        }

        // Save nudge in relance history
        await (db as any).relance.create({
            data: {
                guildId: guildConfig.id,
                adminId: session.user.id,
                type: "DM",
                targetIds: [targetDiscordId],
                message,
                criteria: "MANUAL_NUDGE"
            }
        });

        // Audit Log
        const { createAuditLog } = await import("./audit-actions");
        await createAuditLog({
            guildId,
            actorUserId: session.user.id,
            actorName: user.name || "Admin",
            action: "MEMBER_RELANCE",
            targetType: "MEMBER",
            metadata: {
                type: "MANUAL_NUDGE",
                discordId: targetDiscordId
            }
        });

        return { success: true };
    } catch (error: any) {
        logger.error("Send Manual Nudge Error: " + error.message);
        return { success: false, error: "Erreur lors de l'envoi de la relance" };
    }
}


/**
 * Get Relance history
 */
export async function getRelanceHistory(guildId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAdmin && !user.canManageRelance && !user.canManageMembers) throw new Error("Unauthorized");

    try {
        const history = await (db as any).relance.findMany({
            where: {
                guild: { discordGuildId: guildId }
            },
            include: {
                admin: { select: { name: true, image: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 10
        });

        return { success: true, data: history };
    } catch (error) {
        logger.error("Get Relance History Error");
        return { success: true, data: [] }; // Don't throw for history
    }
}
