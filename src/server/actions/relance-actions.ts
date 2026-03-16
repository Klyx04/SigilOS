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
import { z } from "zod";

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
    criteria: "MISSING_MISSIONS" | "INACTIVE" | "DOFUS_INACTIVE",
    inactiveDays: number = 7
): Promise<ActionResponse<any[]>> {
    const user = await getUserContext(guildId);
    if (!user.isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            include: { profiles: { where: { status: "ACTIVE" }, include: { user: { include: { accounts: true } } } } }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        let candidates: any[] = [];

        if (criteria === "MISSING_MISSIONS") {
            const { week, year } = getDofusWeek();
            
            // Profiles who haven't validated any mission this week
            const activeProfiles = guildConfig.profiles;
            
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
            
            candidates = activeProfiles.filter(p => !validatedProfileIds.has(p.id));
        } else if (criteria === "INACTIVE") {
            const threshold = new Date();
            threshold.setDate(threshold.getDate() - inactiveDays);

            candidates = guildConfig.profiles.filter(p => {
                const lastSeen = p.lastSeen || p.lastActivityAt || p.updatedAt;
                return lastSeen < threshold;
            });
        } else if (criteria === "DOFUS_INACTIVE") {
            // Return all active members for manual selection (no filters)
            candidates = guildConfig.profiles;
        }

        // Format candidates for UI
        const formatted = candidates.map(p => {
            const discordAccount = p.user.accounts.find((a: any) => a.provider === "discord");
            return {
                id: p.id,
                discordId: discordAccount?.providerAccountId,
                name: p.pseudoDofus || p.discordNickname || p.user.name || "Inconnu",
                image: p.user.image,
                lastSeen: p.lastSeen || p.lastActivityAt || p.updatedAt,
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
    if (!user.isAdmin) return { success: false, error: "Unauthorized" };

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
            if (!channelId) return { success: false, error: "Salon requis pour ce type de relance" };
            
            const mentions = targetUserIds.map(id => `<@${id}>`).join(" ");
            const msgId = await sendChannelMessage(channelId, mentions, {
                embedTitle: "🔔 Rappel de Guilde",
                embedDescription: message,
                embedColor: 0xffa500,
                embedFooter: `SigilOS • ${guildConfig.name}`
            });
            if (msgId) results.sent = targetUserIds.length; else results.failed = targetUserIds.length;
        } else if (type === "BULK") {
            if (!channelId) return { success: false, error: "Salon requis" };
            const mentions = targetUserIds.map(id => `<@${id}>`).join(" ");
            const msgId = await sendChannelMessage(channelId, `⚠️ **RELANCE GÉNÉRALE**\n${mentions}`, {
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
 * Get Relance history
 */
export async function getRelanceHistory(guildId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAdmin) throw new Error("Unauthorized");

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
