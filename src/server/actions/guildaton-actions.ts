"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext } from "./user-actions";
import { ActionResponse } from "./user-actions";
import { z } from "zod";
import { createAuditLog } from "./audit-actions";
import { revalidatePath } from "next/cache";

const GuildatonRecordSchema = z.object({
    discordId: z.string().regex(/^(\d{17,20}|manual_[\w\d_\.\-]+)$/, "ID Discord ou manuel invalide"),
    username: z.string().max(100).default("Membre").transform(v => v.trim().replace(/[^\w\s\-\.]/gi, '')), // Strict alpha-numeric
    ankamaId: z.string().max(100).optional().transform(v => v?.trim().replace(/[^\w\s\-\.#]/gi, '')), // Allow # for Ankama ID
    value: z.number().int().min(0).max(999999),
});

export type GuildatonMember = {
    discordId: string;
    username: string;
    displayName: string;
    ankamaId: string | null;
    currentValue: number;
    isRegistered: boolean;
    isOnDiscord: boolean;
    profileId?: string;
    discordRoleName?: string;
};

export type GuildatonSettings = {
    trackedRoles: string[];
    notifyChannelId: string | null;
    adminNotifyChannelId: string | null;
    weeklyQuota: number;
    reminderDay: number;
    reminderTime: string;
};

export type GuildatonHistoryEntry = {
    createdAt: Date;
    value: number;
    discordId: string;
};

// --- LEVENSHTEIN HELPER ---
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(matrix[i][j - 1] + 1, // insertion
                             matrix[i - 1][j] + 1)); // deletion
            }
        }
    }
    return matrix[b.length][a.length];
}



export async function getGuildatonData(guildId: string): Promise<ActionResponse<{
    members: GuildatonMember[];
    history: GuildatonHistoryEntry[];
    settings?: GuildatonSettings;
    availableRoles?: { id: string, name: string, color: number }[];
    availableChannels?: { id: string, name: string }[];
}>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission requise" };
    }

    try {
        const guildWithData = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            include: { 
                guildatonRecords: true,
                guildatonHistories: {
                    where: { 
                        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                    },
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        if (!guildWithData) return { success: false, error: "Guilde introuvable" };
        
        const records = guildWithData.guildatonRecords;
        const history = guildWithData.guildatonHistories as any[];
        const trackedRoles = guildWithData.guildatonTrackedRoles || [];

        // Fetch Discord members & roles safely
        const { listGuildMembers, fetchGuildRoles } = await import("@/server/discord");
        
        // Parallel fetch for speed
        const [discordMembers, discordRoles, profiles] = await Promise.all([
            listGuildMembers(guildId).catch(() => []),
            fetchGuildRoles(guildId).catch(() => []),
            db.userProfile.findMany({
                where: { guildId: guildWithData.id, status: "ACTIVE" },
                select: { 
                    id: true, 
                    ankamaId: true,
                    user: { 
                        select: { 
                            name: true,
                            accounts: { 
                                where: { provider: "discord" }, 
                                select: { providerAccountId: true } 
                            } 
                        } 
                    } 
                }
            })
        ]);

        const roleMap = new Map();
        discordRoles.forEach(r => roleMap.set(r.id, r.name));

        const profileMap = new Map();
        profiles.forEach(p => {
            const dId = p.user.accounts[0]?.providerAccountId;
            if (dId) profileMap.set(dId, p);
        });

        const recordMap = new Map(records.map(r => [r.discordId, r]));

        // Gather all discordIds we want to show
        const allDiscordIds = new Set<string>();
        
        // 1. All records in DB
        records.forEach(r => allDiscordIds.add(r.discordId));
        
        // 2. All registered profiles
        Array.from(profileMap.keys()).forEach(k => allDiscordIds.add(k));

        // 3. All Discord members having at least ONE tracked role
        const discordMemberMap = new Map<string, any>();
        discordMembers.forEach(m => {
            if (!m.user || (m.user as any).bot) return;
            discordMemberMap.set(m.user.id, m);
            // Check tracked roles intersection
            const hasTrackedRole = m.roles?.some(rId => trackedRoles.includes(rId));
            if (hasTrackedRole) {
                allDiscordIds.add(m.user.id);
            }
        });
        
        let availableChannels: any[] = [];
        try {
            const { fetchGuildChannels } = await import("@/server/discord");
            const channels = await fetchGuildChannels(guildId);
            availableChannels = channels.filter(c => c.type === 0 || c.type === 5).map(c => ({ id: c.id, name: c.name })); // Text & News
        } catch(e) {}
        
        const members: GuildatonMember[] = Array.from(allDiscordIds).map(dId => {
            const record = recordMap.get(dId);
            const profile = profileMap.get(dId);
            const discordMember = discordMemberMap.get(dId);

            // Determine display name
            const displayName = discordMember?.nick 
                            || record?.username 
                            || discordMember?.user?.global_name 
                            || discordMember?.user?.username 
                            || profile?.user.name 
                            || "Inconnu";
                            
            // Discover Role Name
            let mainRoleName = "Membre";
            if (discordMember && discordMember.roles && discordMember.roles.length > 0) {
                // Return the first valid role we mapped
                for (const rId of discordMember.roles) {
                    if (roleMap.has(rId)) {
                        mainRoleName = roleMap.get(rId);
                        break;
                    }
                }
            }

            return {
                discordId: dId,
                username: displayName.replace(/[^\w\s\-\.]/gi, ''),
                displayName,
                ankamaId: record?.ankamaId || profile?.ankamaId || null,
                currentValue: record?.value || 0,
                isRegistered: !!profile,
                isOnDiscord: !!discordMember,
                profileId: profile?.id,
                discordRoleName: mainRoleName
            };
        });

        return {
            success: true,
            data: {
                members: members.sort((a, b) => b.currentValue - a.currentValue),
                history,
                settings: {
                    trackedRoles: guildWithData.guildatonTrackedRoles,
                    notifyChannelId: guildWithData.guildatonNotifyChannelId,
                    adminNotifyChannelId: (guildWithData as any).guildatonAdminChannelId || null,
                    weeklyQuota: guildWithData.guildatonWeeklyQuota,
                    reminderDay: (guildWithData as any).guildatonReminderDay ?? 0,
                    reminderTime: (guildWithData as any).guildatonReminderTime || "18:00",
                },
                availableRoles: discordRoles.map(r => ({ id: r.id, name: r.name, color: r.color })),
                availableChannels
            }
        };

    } catch (error) {
        console.error("[Guildaton Actions] Error:", error);
        return { success: false, error: "Erreur lors de la récupération des données" };
    }
}

export async function updateGuildatonValue(guildId: string, data: z.infer<typeof GuildatonRecordSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const { discordId, value, username, ankamaId } = data;
        const cleanUsername = username?.substring(0, 100).trim();
        const cleanAnkamaId = ankamaId?.substring(0, 100).trim();

        // Update or create record
        const record = await db.guildatonRecord.upsert({
            where: { 
                guildId_discordId: {
                    guildId: guild.id,
                    discordId
                }
            },
            update: { 
                value, 
                username: cleanUsername, 
                ankamaId: cleanAnkamaId 
            },
            create: { 
                guildId: guild.id, 
                discordId, 
                value, 
                username: cleanUsername, 
                ankamaId: cleanAnkamaId 
            }
        });

        // Also add to history if value changed? 
        // Better: store a snapshot
        await db.guildatonHistory.create({
            data: {
                guildId: guild.id,
                discordId,
                value
            }
        });

        await createAuditLog({
            guildId: guild.id,
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "GUILDATON_UPDATE",
            targetType: "MEMBER",
            targetId: discordId,
            newValue: { value }
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };

    } catch (error) {
        console.error("[Guildaton Actions] Update Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

export async function importGuildatonCsv(guildId: string, rows: any[]): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        // 3. Pre-fetch profiles for matching by name if discordId is missing
        const activeProfiles = await db.userProfile.findMany({
            where: { guildId: guild.id, status: "ACTIVE" },
            select: { 
                pseudoDofus: true,
                discordNickname: true,
                user: {
                    select: {
                        name: true,
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    }
                }
            }
        });

        const possibleAliases: { discordId: string, name: string }[] = [];
        activeProfiles.forEach(p => {
            const dId = p.user?.accounts[0]?.providerAccountId;
            if (dId) {
                if (p.pseudoDofus) possibleAliases.push({ discordId: dId, name: p.pseudoDofus.toLowerCase() });
                if (p.discordNickname) possibleAliases.push({ discordId: dId, name: p.discordNickname.toLowerCase() });
                if (p.user?.name) possibleAliases.push({ discordId: dId, name: p.user.name.toLowerCase() });
            }
        });

        // 4. Pre fetch known records for their last recorded usernames too
        const knownRecords = await db.guildatonRecord.findMany({
            where: { guildId: guild.id },
            select: { discordId: true, username: true, ankamaId: true }
        });
        knownRecords.forEach(r => {
            if (r.username) possibleAliases.push({ discordId: r.discordId, name: r.username.toLowerCase() });
            if (r.ankamaId) possibleAliases.push({ discordId: r.discordId, name: r.ankamaId.toLowerCase() });
        });

        const findFuzzyMatch = (targetName: string): string | null => {
            const t = targetName.toLowerCase().trim();
            for (const alias of possibleAliases) {
                if (alias.name === t) return alias.discordId; // exact match
            }
            // Fallback Fuzzy
            let bestMatch = null;
            let lowestDistance = 999;
            for (const alias of possibleAliases) {
                const dist = levenshteinDistance(t, alias.name);
                // Allow up to 2 typos for names > 5 chars, else 1 typo.
                const threshold = t.length > 5 ? 2 : 1;
                if (dist <= threshold && dist < lowestDistance) {
                    lowestDistance = dist;
                    bestMatch = alias.discordId;
                }
            }
            return bestMatch;
        };

        // Transaction for bulk update
        const batchSize = 50;
        for (let i = 0; i < rows.length; i += batchSize) {
            const chunk = rows.slice(i, i + batchSize);
            
            await db.$transaction(async (tx) => {
                for (const row of chunk) {
                    let discordId = row.discordId;
                    const username = row.username || "Membre";
                    const value = row.value;
                    const ankamaId = row.ankamaId;

                    // SMART MATCHING: If discordId is missing or looks like a name, try fuzzy match
                    if (!discordId || !/^\d{17,20}$/.test(discordId)) {
                        const matchedId = findFuzzyMatch(username) || findFuzzyMatch(discordId);
                        if (matchedId) {
                            discordId = matchedId;
                        } else {
                            // Can't match? Force a manual ID
                            const seed = (discordId || username).toLowerCase().replace(/\s+/g, '_').replace(/[^\w\d_.-]/g, '');
                            discordId = `manual_${seed.substring(0, 20)}`;
                        }
                    }

                    const validation = GuildatonRecordSchema.safeParse({
                        discordId,
                        value,
                        username: username.substring(0, 100),
                        ankamaId: ankamaId?.substring(0, 100)
                    });

                    if (!validation.success) continue;
                    const cleanData = validation.data;

                    await tx.guildatonRecord.upsert({
                        where: { 
                            guildId_discordId: {
                                guildId: guild.id,
                                discordId: cleanData.discordId
                            }
                        },
                        update: { 
                            value: cleanData.value, 
                            username: cleanData.username, 
                            ankamaId: cleanData.ankamaId 
                        },
                        create: { 
                            guildId: guild.id, 
                            discordId: cleanData.discordId, 
                            value: cleanData.value,
                            username: cleanData.username, 
                            ankamaId: cleanData.ankamaId 
                        }
                    });

                    await tx.guildatonHistory.create({
                        data: {
                            guildId: guild.id,
                            discordId: cleanData.discordId,
                            value: cleanData.value
                        }
                    });
                }
            });
        }

        await createAuditLog({
            guildId: guild.id,
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "GUILDATON_CSV_IMPORT",
            targetType: "GUILD",
            targetId: guildId,
            metadata: { count: rows.length }
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };

    } catch (error) {
        console.error("[Guildaton Actions] Import Error:", error);
        return { success: false, error: "Erreur lors de l'importation" };
    }
}

export async function updateGuildatonSettings(guildId: string, settings: GuildatonSettings): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: {
                guildatonTrackedRoles: settings.trackedRoles,
                guildatonNotifyChannelId: settings.notifyChannelId || null,
                guildatonAdminChannelId: settings.adminNotifyChannelId || null,
                guildatonWeeklyQuota: settings.weeklyQuota,
                guildatonReminderDay: settings.reminderDay,
                guildatonReminderTime: settings.reminderTime,
            }
        });

        await createAuditLog({
            guildId: ctx.guildId || "",
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "GUILDATON_SETTINGS_UPDATE",
            targetType: "GUILD",
            targetId: guildId,
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };

    } catch (error) {
        console.error("[Guildaton Actions] Settings Update Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour des paramètres" };
    }
}

export async function deleteGuildatonRecord(guildId: string, discordId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        await db.$transaction([
            db.guildatonRecord.delete({
                where: { 
                    guildId_discordId: {
                        guildId: guild.id,
                        discordId
                    }
                }
            }),
            db.guildatonHistory.deleteMany({
                where: { 
                    guildId: guild.id,
                    discordId
                }
            })
        ]);

        await createAuditLog({
            guildId: guild.id,
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "MEMBER_PROFILE_DELETE" as any, // Reusing existing action category for simplicity or defining new one
            targetType: "MEMBER",
            targetId: discordId,
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };

    } catch (error) {
        console.error("[Guildaton Actions] Delete Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

/**
 * Prend un snapshot de tous les records actuels pour l'historique
 * C'est l'action manuelle qui "déclare la semaine terminée"
 */
export async function validateWeeklyGuildaton(guildId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { 
                id: true,
                guildatonRecords: true,
            }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        if (guild.guildatonRecords.length === 0) {
            return { success: false, error: "Aucun membre à valider." };
        }

        // Créer les entrées d'historique
        const historyData = guild.guildatonRecords.map(record => ({
            guildId: guild.id,
            discordId: record.discordId,
            value: record.value,
        }));

        await db.guildatonHistory.createMany({
            data: historyData
        });

        await createAuditLog({
            guildId: guild.id,
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "GUILDATON_WEEKLY_VALIDATION" as any,
            targetType: "GUILD",
            targetId: guildId,
            metadata: { count: historyData.length }
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };

    } catch (error) {
        console.error("[Guildaton Actions] Validation Error:", error);
        return { success: false, error: "Erreur lors de la validation" };
    }
}

/**
 * Force l'envoi du rapport sur Discord immédiatement
 */
export async function sendManualGuildatonReport(guildId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const url = `${baseUrl}/api/cron/guildaton-report?token=${process.env.CRON_SECRET}&forceGuild=${guildId}`;
        
        console.log(`[Guildaton] Triggering manual report: ${url.replace(process.env.CRON_SECRET || "", "SECRET")}`);
        
        const response = await fetch(url, { cache: 'no-store' });
        
        if (response.ok) {
            return { success: true };
        } else {
            const errorText = await response.text();
            console.error(`[Guildaton] Manual report API error: ${response.status}`, errorText);
            return { success: false, error: "Échec de l'envoi Discord" };
        }
    } catch (error: any) {
        console.error("[Guildaton] Manual report fetch error:", error);
        return { success: false, error: "Erreur lors de l'envoi" };
    }
}
