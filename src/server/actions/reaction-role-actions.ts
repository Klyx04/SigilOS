"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import {
    deployReactionRoleMessage,
    verifyBotRoleHierarchy,
    addGuildMemberRole,
    removeGuildMemberRole,
    fetchGuildMember,
    sendChannelMessage
} from "@/server/discord";

export type ActionResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
};

const ReactionRoleOptionSchema = z.object({
    id: z.string().optional(),
    roleId: z.string().min(1, "Rôle Discord requis"),
    roleName: z.string().min(1, "Nom du rôle requis"),
    roleColor: z.string().nullable().optional(),
    emoji: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    buttonStyle: z.enum(["PRIMARY", "SECONDARY", "SUCCESS", "DANGER"]).default("SECONDARY"),
    position: z.number().default(0),
    maxMembers: z.number().nullable().optional(),
    removeRoleId: z.string().nullable().optional(),
    removeRoleName: z.string().nullable().optional(),
    requiredRoleId: z.string().nullable().optional(),
    requiredRoleName: z.string().nullable().optional(),
    blacklistedRoleId: z.string().nullable().optional(),
    blacklistedRoleName: z.string().nullable().optional(),
    extraRoleIds: z.array(z.string()).default([]),
    durationDays: z.number().nullable().optional(),
});

const ReactionRoleGroupSchema = z.object({
    name: z.string().min(1, "Nom du groupe requis"),
    description: z.string().nullable().optional(),
    channelId: z.string().min(1, "Salon Discord requis"),
    logChannelId: z.string().nullable().optional(),
    mode: z.enum(["NORMAL", "UNIQUE", "VERIFY", "REVERSE"]).default("NORMAL"),
    style: z.enum(["BUTTONS", "SELECT_MENU", "REACTIONS"]).default("BUTTONS"),
    maxRoles: z.number().nullable().optional(),
    embedTitle: z.string().nullable().optional(),
    embedDescription: z.string().nullable().optional(),
    embedColor: z.string().nullable().optional(),
    embedThumbnail: z.string().nullable().optional(),
    embedImage: z.string().nullable().optional(),
    embedFooter: z.string().nullable().optional(),
    showRoleCount: z.boolean().default(false),
    options: z.array(ReactionRoleOptionSchema).min(1, "Au moins un rôle requis"),
});

export async function getReactionRoleGroupsAction(guildId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageReactionRoles && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const groups = await db.reactionRoleGroup.findMany({
            where: { guildId: guildConfig.id },
            include: {
                options: {
                    orderBy: { position: "asc" }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return { success: true, data: groups };
    } catch (error: any) {
        logger.error("[getReactionRoleGroupsAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de la récupération des groupes" };
    }
}

export async function getReactionRoleGroupAction(guildId: string, groupId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageReactionRoles && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const group = await db.reactionRoleGroup.findFirst({
            where: { id: groupId, guildId: guildConfig.id },
            include: {
                options: {
                    orderBy: { position: "asc" }
                }
            }
        });

        if (!group) return { success: false, error: "Groupe introuvable" };
        return { success: true, data: group };
    } catch (error: any) {
        logger.error("[getReactionRoleGroupAction] Error:", error);
        return { success: false, error: error?.message || "Erreur serveur" };
    }
}

export async function createReactionRoleGroupAction(guildId: string, rawData: z.infer<typeof ReactionRoleGroupSchema>): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageReactionRoles && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const parsed = ReactionRoleGroupSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const { options, ...groupData } = parsed.data;

        const created = await db.reactionRoleGroup.create({
            data: {
                ...groupData,
                guildId: guildConfig.id,
                options: {
                    create: options.map((opt, idx) => ({
                        roleId: opt.roleId,
                        roleName: opt.roleName,
                        roleColor: opt.roleColor,
                        emoji: opt.emoji,
                        label: opt.label,
                        description: opt.description,
                        buttonStyle: opt.buttonStyle,
                        position: opt.position ?? idx,
                        maxMembers: opt.maxMembers,
                        removeRoleId: opt.removeRoleId || null,
                        removeRoleName: opt.removeRoleName || null,
                        requiredRoleId: opt.requiredRoleId || null,
                        requiredRoleName: opt.requiredRoleName || null,
                        blacklistedRoleId: opt.blacklistedRoleId || null,
                        blacklistedRoleName: opt.blacklistedRoleName || null,
                        extraRoleIds: opt.extraRoleIds || [],
                        durationDays: opt.durationDays || null,
                    }))
                }
            },
            include: { options: true }
        });

        revalidatePath(`/dashboard/${guildId}/reaction-roles`);
        return { success: true, data: created };
    } catch (error: any) {
        logger.error("[createReactionRoleGroupAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de la création" };
    }
}

export async function updateReactionRoleGroupAction(
    guildId: string,
    groupId: string,
    rawData: z.infer<typeof ReactionRoleGroupSchema>
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageReactionRoles && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const parsed = ReactionRoleGroupSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const existing = await db.reactionRoleGroup.findFirst({
            where: { id: groupId, guildId: guildConfig.id }
        });
        if (!existing) return { success: false, error: "Groupe introuvable" };

        const { options, ...groupData } = parsed.data;

        // Atomic transaction: update group, replace options
        const updated = await db.$transaction(async (tx) => {
            await tx.reactionRoleOption.deleteMany({
                where: { groupId }
            });

            return tx.reactionRoleGroup.update({
                where: { id: groupId },
                data: {
                    ...groupData,
                    options: {
                        create: options.map((opt, idx) => ({
                            roleId: opt.roleId,
                            roleName: opt.roleName,
                            roleColor: opt.roleColor,
                            emoji: opt.emoji,
                            label: opt.label,
                            description: opt.description,
                            buttonStyle: opt.buttonStyle,
                            position: opt.position ?? idx,
                            maxMembers: opt.maxMembers,
                            removeRoleId: opt.removeRoleId || null,
                            removeRoleName: opt.removeRoleName || null,
                            requiredRoleId: opt.requiredRoleId || null,
                            requiredRoleName: opt.requiredRoleName || null,
                            blacklistedRoleId: opt.blacklistedRoleId || null,
                            blacklistedRoleName: opt.blacklistedRoleName || null,
                            extraRoleIds: opt.extraRoleIds || [],
                            durationDays: opt.durationDays || null,
                        }))
                    }
                },
                include: { options: true }
            });
        });

        revalidatePath(`/dashboard/${guildId}/reaction-roles`);
        return { success: true, data: updated };
    } catch (error: any) {
        logger.error("[updateReactionRoleGroupAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de la mise à jour" };
    }
}

export async function deleteReactionRoleGroupAction(guildId: string, groupId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageReactionRoles && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.reactionRoleGroup.deleteMany({
            where: { id: groupId, guildId: guildConfig.id }
        });

        revalidatePath(`/dashboard/${guildId}/reaction-roles`);
        return { success: true };
    } catch (error: any) {
        logger.error("[deleteReactionRoleGroupAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de la suppression" };
    }
}

export async function checkRoleHierarchyAction(guildId: string, roleId: string): Promise<ActionResponse> {
    try {
        const res = await verifyBotRoleHierarchy(guildId, roleId);
        return { success: true, data: res };
    } catch (error: any) {
        return { success: false, error: error?.message || "Erreur vérification" };
    }
}

/**
 * Format Discord embed and components from ReactionRoleGroup
 */
function buildDiscordComponents(group: any) {
    const embedColor = group.embedColor
        ? parseInt(group.embedColor.replace("#", ""), 16) || 0x10b981
        : 0x10b981;

    const embed: any = {
        title: group.embedTitle || group.name,
        description: group.embedDescription || undefined,
        color: embedColor,
    };

    if (group.embedThumbnail) embed.thumbnail = { url: group.embedThumbnail };
    if (group.embedImage) embed.image = { url: group.embedImage };
    if (group.embedFooter) embed.footer = { text: group.embedFooter };

    const components: any[] = [];
    const options = group.options || [];

    if (group.style === "SELECT_MENU") {
        // Dropdown Select Menu
        const selectOptions = options.slice(0, 25).map((opt: any) => {
            const item: any = {
                label: opt.label || opt.roleName,
                value: opt.roleId,
                description: opt.description || undefined,
            };
            if (opt.emoji) {
                const match = opt.emoji.match(/<a?:(\w+):(\d+)>/);
                if (match) {
                    item.emoji = { name: match[1], id: match[2] };
                } else {
                    item.emoji = { name: opt.emoji };
                }
            }
            return item;
        });

        components.push({
            type: 1, // Action Row
            components: [
                {
                    type: 3, // String Select Menu
                    custom_id: `rr:select:${group.id}`,
                    placeholder: "Sélectionnez vos rôles…",
                    min_values: 0,
                    max_values: group.mode === "UNIQUE" ? 1 : Math.min(selectOptions.length, group.maxRoles || selectOptions.length),
                    options: selectOptions,
                }
            ]
        });
    } else {
        // Buttons (up to 5 per row, max 5 rows = 25 buttons)
        const rows: any[] = [];
        let currentRow: any[] = [];

        const styleMap: Record<string, number> = {
            PRIMARY: 1,
            SECONDARY: 2,
            SUCCESS: 3,
            DANGER: 4,
        };

        options.forEach((opt: any) => {
            const btn: any = {
                type: 2, // Button
                style: styleMap[opt.buttonStyle] || 2,
                label: opt.label || opt.roleName,
                custom_id: `rr:btn:${group.id}:${opt.id}`,
            };

            if (opt.emoji) {
                const match = opt.emoji.match(/<a?:(\w+):(\d+)>/);
                if (match) {
                    btn.emoji = { name: match[1], id: match[2] };
                } else {
                    btn.emoji = { name: opt.emoji };
                }
            }

            currentRow.push(btn);
            if (currentRow.length === 5) {
                rows.push({ type: 1, components: currentRow });
                currentRow = [];
            }
        });

        if (currentRow.length > 0) {
            rows.push({ type: 1, components: currentRow });
        }

        components.push(...rows.slice(0, 5));
    }

    return { embed, components };
}

export async function deployReactionRoleGroupAction(guildId: string, groupId: string): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.canManageReactionRoles && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const group = await db.reactionRoleGroup.findFirst({
            where: { id: groupId, guildId: guildConfig.id },
            include: { options: { orderBy: { position: "asc" } } }
        });
        if (!group) return { success: false, error: "Groupe introuvable" };

        // Hierarchy pre-check for all roles in group
        for (const opt of group.options) {
            const hierarchy = await verifyBotRoleHierarchy(guildId, opt.roleId);
            if (!hierarchy.canManage) {
                return {
                    success: false,
                    error: `Impossible de déployer : le rôle "${opt.roleName}" est supérieur ou égal au rôle du bot Discord.`
                };
            }
        }

        const { embed, components } = buildDiscordComponents(group);

        const deployRes = await deployReactionRoleMessage(guildId, group.channelId, {
            messageId: group.messageId,
            embed,
            components,
        });

        if (!deployRes.success || !deployRes.messageId) {
            return { success: false, error: deployRes.error || "Échec du déploiement Discord" };
        }

        // Save deployed messageId
        await db.reactionRoleGroup.update({
            where: { id: groupId },
            data: { messageId: deployRes.messageId }
        });

        revalidatePath(`/dashboard/${guildId}/reaction-roles`);
        return { success: true, data: { messageId: deployRes.messageId } };
    } catch (error: any) {
        logger.error("[deployReactionRoleGroupAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors du déploiement" };
    }
}

/**
 * Internal interaction dispatcher called by /api/discord/interactions/route.ts
 */
export async function internalHandleReactionRoleInteraction(params: {
    discordGuildId: string;
    discordUserId: string;
    groupId: string;
    optionId?: string;
    selectedRoleIds?: string[];
}): Promise<{ success: boolean; message: string; details?: string }> {
    const { discordGuildId, discordUserId, groupId, optionId, selectedRoleIds } = params;

    try {
        const group = await db.reactionRoleGroup.findUnique({
            where: { id: groupId },
            include: { options: true }
        });

        if (!group || !group.isActive) {
            return { success: false, message: "Ce panneau de rôles n'est plus actif." };
        }

        const member = await fetchGuildMember(discordGuildId, discordUserId);
        if (!member) {
            return { success: false, message: "Impossible de récupérer vos rôles Discord." };
        }

        const memberRoles = new Set(member.roles || []);
        const addedRoles: string[] = [];
        const removedRoles: string[] = [];

        if (selectedRoleIds) {
            // Select Menu logic
            for (const opt of group.options) {
                const wantsRole = selectedRoleIds.includes(opt.roleId);
                const hasRole = memberRoles.has(opt.roleId);

                if (wantsRole && !hasRole) {
                    const res = await addGuildMemberRole(discordGuildId, discordUserId, opt.roleId, `Reaction Role [${group.name}]`);
                    if (res.success) addedRoles.push(opt.roleName);
                } else if (!wantsRole && hasRole) {
                    const res = await removeGuildMemberRole(discordGuildId, discordUserId, opt.roleId, `Reaction Role [${group.name}]`);
                    if (res.success) removedRoles.push(opt.roleName);
                }
            }
        } else if (optionId) {
            // Button Click logic
            const option = group.options.find(o => o.id === optionId);
            if (!option) {
                return { success: false, message: "Option de rôle introuvable." };
            }

            const hasRole = memberRoles.has(option.roleId);

            // Prerequisite check (Carl-bot / Dyno feature)
            if (!hasRole && option.requiredRoleId && !memberRoles.has(option.requiredRoleId)) {
                return {
                    success: false,
                    message: `🚫 Prérequis manquant : vous devez posséder le rôle **${option.requiredRoleName || "requis"}** pour utiliser cette option.`
                };
            }

            // Blacklist check (Carl-bot / Dyno feature)
            if (!hasRole && option.blacklistedRoleId && memberRoles.has(option.blacklistedRoleId)) {
                return {
                    success: false,
                    message: `🚫 Action interdite : vous possédez le rôle **${option.blacklistedRoleName || "interdit"}** qui vous empêche d'obtenir ce rôle.`
                };
            }

            const executeRoleGrant = async () => {
                const res = await addGuildMemberRole(discordGuildId, discordUserId, option.roleId, `Reaction Role Add [${group.name}]`);
                if (res.success) {
                    addedRoles.push(option.roleName);

                    // Multi-roles assignment (#222)
                    if (option.extraRoleIds && option.extraRoleIds.length > 0) {
                        for (const extraId of option.extraRoleIds) {
                            const extraRes = await addGuildMemberRole(discordGuildId, discordUserId, extraId, `Reaction Role Extra Add [${group.name}]`);
                            if (extraRes.success) {
                                addedRoles.push(extraId);
                            }
                        }
                    }

                    // Timed Role Registration (#222)
                    if (option.durationDays && option.durationDays > 0) {
                        const expiresAt = new Date(Date.now() + option.durationDays * 24 * 60 * 60 * 1000);
                        try {
                            await (db as any).timedRoleGrant.create({
                                data: {
                                    guildId: group.guildId,
                                    discordGuildId,
                                    discordUserId,
                                    roleId: option.roleId,
                                    roleName: option.roleName,
                                    expiresAt,
                                    source: "REACTION_ROLE"
                                }
                            });
                        } catch (e) {
                            logger.error("[ReactionRoles] Failed to record TimedRoleGrant:", e);
                        }
                    }

                    // Automatic Swap / Removal of designated role (removeRoleId)
                    if (option.removeRoleId && memberRoles.has(option.removeRoleId)) {
                        const removeRes = await removeGuildMemberRole(
                            discordGuildId,
                            discordUserId,
                            option.removeRoleId,
                            `Reaction Role Swap Remove [${group.name}]`
                        );
                        if (removeRes.success) {
                            removedRoles.push(option.removeRoleName || "Ancien Rôle");
                        }
                    }
                }
            };

            const executeRoleRevoke = async () => {
                const res = await removeGuildMemberRole(discordGuildId, discordUserId, option.roleId, `Reaction Role Remove [${group.name}]`);
                if (res.success) {
                    removedRoles.push(option.roleName);

                    // Remove extra roles if configured
                    if (option.extraRoleIds && option.extraRoleIds.length > 0) {
                        for (const extraId of option.extraRoleIds) {
                            await removeGuildMemberRole(discordGuildId, discordUserId, extraId, `Reaction Role Extra Remove [${group.name}]`);
                        }
                    }

                    // Mark timed grants revoked
                    try {
                        await (db as any).timedRoleGrant.updateMany({
                            where: {
                                discordGuildId,
                                discordUserId,
                                roleId: option.roleId,
                                revokedAt: null
                            },
                            data: { revokedAt: new Date() }
                        });
                    } catch (e) {
                        logger.error("[ReactionRoles] Failed to update TimedRoleGrant:", e);
                    }
                }
            };

            if (group.mode === "VERIFY") {
                if (!hasRole) {
                    await executeRoleGrant();
                }
            } else if (group.mode === "REVERSE") {
                if (hasRole) {
                    await executeRoleRevoke();
                }
            } else if (group.mode === "UNIQUE") {
                // Remove all other roles in the group
                for (const opt of group.options) {
                    if (opt.id !== option.id && memberRoles.has(opt.roleId)) {
                        const res = await removeGuildMemberRole(discordGuildId, discordUserId, opt.roleId, `Reaction Role Unique switch [${group.name}]`);
                        if (res.success) removedRoles.push(opt.roleName);
                    }
                }
                // Toggle current role
                if (hasRole) {
                    await executeRoleRevoke();
                } else {
                    await executeRoleGrant();
                }
            } else {
                // NORMAL mode: toggle
                if (hasRole) {
                    await executeRoleRevoke();
                } else {
                    // Check maxRoles constraint if configured
                    if (group.maxRoles) {
                        const currentCount = group.options.filter(o => memberRoles.has(o.roleId)).length;
                        if (currentCount >= group.maxRoles) {
                            return {
                                success: false,
                                message: `Vous ne pouvez pas sélectionner plus de ${group.maxRoles} rôle(s) dans ce groupe.`
                            };
                        }
                    }

                    await executeRoleGrant();
                }
            }
        }

        // Build friendly feedback message
        let feedback = "Vos rôles ont été mis à jour !";
        const parts: string[] = [];
        if (addedRoles.length > 0) parts.push(`✅ Rôle(s) ajouté(s) : **${addedRoles.join(", ")}**`);
        if (removedRoles.length > 0) parts.push(`❌ Rôle(s) retiré(s) : **${removedRoles.join(", ")}**`);
        if (parts.length > 0) feedback = parts.join("\n");

        // Optional log in Discord log channel
        if (group.logChannelId && (addedRoles.length > 0 || removedRoles.length > 0)) {
            try {
                await sendChannelMessage(
                    group.logChannelId,
                    `📋 **Reaction Roles** [${group.name}] · <@${discordUserId}> :\n${parts.join("\n")}`,
                    { suppressEmbeds: true }
                );
            } catch (e) {
                logger.error("[ReactionRoles] Log channel message failed:", e);
            }
        }

        return { success: true, message: feedback };
    } catch (error: any) {
        logger.error("[internalHandleReactionRoleInteraction] Error:", error);
        return { success: false, message: "Une erreur est survenue lors de l'attribution du rôle." };
    }
}

/**
 * SuperAdmin / God Icon Pack Actions
 */
export async function getGodIconPacksAction(): Promise<ActionResponse> {
    try {
        const { isSuperAdmin } = await import("./super-admin-actions");
        const isGod = await isSuperAdmin();
        if (!isGod) return { success: false, error: "Non autorisé" };

        const packs = await db.reactionRoleIconPack.findMany({
            orderBy: { createdAt: "desc" },
            include: { guild: { select: { name: true, discordGuildId: true } } }
        });
        return { success: true, data: packs };
    } catch (error: any) {
        logger.error("[getGodIconPacksAction] Error:", error);
        return { success: false, error: error?.message || "Erreur serveur" };
    }
}

export async function saveGodIconPackAction(rawData: {
    id?: string;
    name: string;
    category?: string;
    icons: any[];
    isGodOnly?: boolean;
    guildId?: string | null;
}): Promise<ActionResponse> {
    try {
        const { isSuperAdmin } = await import("./super-admin-actions");
        const isGod = await isSuperAdmin();
        if (!isGod) return { success: false, error: "Non autorisé" };

        const { id, name, category, icons, isGodOnly, guildId } = rawData;
        if (!name?.trim()) return { success: false, error: "Nom du pack requis" };

        let resolvedGuildDbId: string | null = null;
        if (guildId) {
            const g = await db.guildConfig.findFirst({
                where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
                select: { id: true }
            });
            resolvedGuildDbId = g?.id || null;
        }

        if (id) {
            const updated = await db.reactionRoleIconPack.update({
                where: { id },
                data: {
                    name,
                    category: category || "general",
                    icons: icons || [],
                    isGodOnly: !!isGodOnly,
                    guildId: resolvedGuildDbId
                }
            });
            return { success: true, data: updated };
        } else {
            const created = await db.reactionRoleIconPack.create({
                data: {
                    name,
                    category: category || "general",
                    icons: icons || [],
                    isGodOnly: !!isGodOnly,
                    guildId: resolvedGuildDbId
                }
            });
            return { success: true, data: created };
        }
    } catch (error: any) {
        logger.error("[saveGodIconPackAction] Error:", error);
        return { success: false, error: error?.message || "Erreur enregistrement pack" };
    }
}

export async function deleteGodIconPackAction(packId: string): Promise<ActionResponse> {
    try {
        const { isSuperAdmin } = await import("./super-admin-actions");
        const isGod = await isSuperAdmin();
        if (!isGod) return { success: false, error: "Non autorisé" };

        await db.reactionRoleIconPack.delete({
            where: { id: packId }
        });
        return { success: true };
    } catch (error: any) {
        logger.error("[deleteGodIconPackAction] Error:", error);
        return { success: false, error: error?.message || "Erreur suppression pack" };
    }
}

/**
 * Upload multiple icon images for God Icon Packs
 */
export async function uploadIconPackImagesAction(formData: FormData): Promise<ActionResponse<{ name: string; url: string }[]>> {
    try {
        const { isSuperAdmin } = await import("./super-admin-actions");
        const isGod = await isSuperAdmin();
        if (!isGod) return { success: false, error: "Non autorisé" };

        const files = formData.getAll("files") as File[];
        if (!files || files.length === 0) {
            return { success: false, error: "Aucun fichier sélectionné" };
        }

        const path = await import("path");
        const fs = await import("fs/promises");
        const crypto = await import("crypto");

        const targetDir = path.join(process.cwd(), "public", "uploads", "icon-packs");
        await fs.mkdir(targetDir, { recursive: true });

        const uploadedIcons: { name: string; url: string }[] = [];

        for (const file of files) {
            if (!file.type.startsWith("image/")) continue;

            const buffer = Buffer.from(await file.arrayBuffer());
            const ext = path.extname(file.name) || ".png";
            const cleanName = path.basename(file.name, ext).replace(/[-_]/g, " ").trim();
            const uniqueFilename = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
            const filePath = path.join(targetDir, uniqueFilename);

            await fs.writeFile(filePath, buffer);
            uploadedIcons.push({
                name: cleanName || "Icon",
                url: `/uploads/icon-packs/${uniqueFilename}`
            });
        }

        return { success: true, data: uploadedIcons };
    } catch (error: any) {
        logger.error("[uploadIconPackImagesAction] Error:", error);
        return { success: false, error: error?.message || "Erreur upload d'icônes" };
    }
}

/**
 * Fetch available icon packs for a guild to use in the Reaction Roles editor
 */
export async function getAvailableIconPacksForGuildAction(guildId: string): Promise<ActionResponse> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        const packs = await db.reactionRoleIconPack.findMany({
            where: {
                OR: [
                    { isGodOnly: false, guildId: null },
                    ...(guildConfig ? [{ guildId: guildConfig.id }] : [])
                ]
            },
            orderBy: { name: "asc" }
        });

        return { success: true, data: packs };
    } catch (error: any) {
        logger.error("[getAvailableIconPacksForGuildAction] Error:", error);
        return { success: false, error: error?.message || "Erreur chargement packs" };
    }
}

/**
 * ⏰ Traitement CRON des rôles temporaires expirés (#222)
 * Révoque automatiquement les rôles arrivés à échéance sur Discord.
 */
export async function processExpiredTimedRolesAction(): Promise<ActionResponse<{ revokedCount: number }>> {
    try {
        const now = new Date();
        const expiredGrants = await (db as any).timedRoleGrant.findMany({
            where: {
                expiresAt: { lte: now },
                revokedAt: null
            },
            take: 100
        });

        let revokedCount = 0;

        for (const grant of expiredGrants) {
            try {
                await removeGuildMemberRole(
                    grant.discordGuildId,
                    grant.discordUserId,
                    grant.roleId,
                    `Reaction Role Expired [Timed Auto-Revoke]`
                );

                await (db as any).timedRoleGrant.update({
                    where: { id: grant.id },
                    data: { revokedAt: now }
                });

                revokedCount++;
            } catch (err) {
                logger.error(`[processExpiredTimedRoles] Error revoking role ${grant.roleId} for user ${grant.discordUserId}:`, err);
            }
        }

        return { success: true, data: { revokedCount } };
    } catch (error: any) {
        logger.error("[processExpiredTimedRolesAction] Error:", error);
        return { success: false, error: "Échec du traitement des rôles temporaires expirés." };
    }
}


