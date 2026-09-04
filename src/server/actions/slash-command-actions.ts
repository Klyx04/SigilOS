"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { isSuperAdmin } from "./super-admin-actions";
import { logAction } from "./audit-actions";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";

const updateSlashPermSchema = z.object({
    guildId: z.string().min(1),
    commandName: z.string().min(1),
    roleIds: z.array(z.string()),
    channelIds: z.array(z.string()).default([]),
    isEnabled: z.boolean()
});

/**
 * Récupère les permissions RBAC des commandes slash pour une guilde
 */
export async function getGuildSlashCommandPermissionsAction(guildId: string) {
    try {
        const config = await db.guildConfig.findFirst({
            where: {
                OR: [
                    { id: guildId },
                    { discordGuildId: guildId }
                ]
            },
            select: { id: true, discordGuildId: true }
        });

        if (!config) {
            return { success: false, error: "Guild not found" };
        }

        const user = await getUserContext(config.discordGuildId || guildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Unauthorized" };
        }

        const permissions = await db.guildSlashCommandPermission.findMany({
            where: { guildId: config.id }
        });

        const permMap = new Map(permissions.map(p => [p.commandName, p]));

        const matrix = SLASH_COMMANDS_CATALOG.map(cmd => {
            const existing = permMap.get(cmd.name);
            return {
                command: cmd,
                isEnabled: existing ? existing.isEnabled : true,
                roleIds: existing ? existing.roleIds : [],
                channelIds: existing ? existing.channelIds : []
            };
        });

        return {
            success: true,
            data: matrix
        };
    } catch (err) {
        logger.error("[getGuildSlashCommandPermissionsAction Error]", err);
        return { success: false, error: "Internal Error" };
    }
}

/**
 * Met à jour les permissions d'une commande slash pour une guilde
 */
export async function updateGuildSlashCommandPermissionAction(input: z.infer<typeof updateSlashPermSchema>) {
    try {
        const parsed = updateSlashPermSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Validation failed" };
        }

        const { guildId, commandName, roleIds, channelIds, isEnabled } = parsed.data;

        const config = await db.guildConfig.findFirst({
            where: {
                OR: [
                    { id: guildId },
                    { discordGuildId: guildId }
                ]
            },
            select: { id: true, discordGuildId: true }
        });

        if (!config) {
            return { success: false, error: "Guild not found" };
        }

        const user = await getUserContext(config.discordGuildId || guildId);

        if (!user.isAuthenticated || (!user.isAdmin && !user.canManageRBAC)) {
            return { success: false, error: "Forbidden: Admin or RBAC permission required" };
        }

        const updated = await db.guildSlashCommandPermission.upsert({
            where: {
                guildId_commandName: {
                    guildId: config.id,
                    commandName
                }
            },
            create: {
                guildId: config.id,
                commandName,
                roleIds,
                channelIds,
                isEnabled
            },
            update: {
                roleIds,
                channelIds,
                isEnabled
            }
        });

        await logAction({
            guildId: config.discordGuildId || guildId,
            action: "RBAC_UPDATE",
            targetType: "PERMISSION",
            newValue: { commandName, roleIdsCount: roleIds.length, channelIdsCount: channelIds.length, isEnabled }
        }).catch(() => {});

        return { success: true, data: updated };
    } catch (err) {
        logger.error("[updateGuildSlashCommandPermissionAction Error]", err);
        return { success: false, error: "Failed to update slash command permission" };
    }
}

/**
 * Vérifie si un utilisateur Discord a le droit d'exécuter une commande slash donnée
 */
export async function checkSlashCommandExecutionAllowed(
    discordGuildId: string,
    commandName: string,
    userRoleIds: string[],
    channelId?: string
): Promise<{ allowed: boolean; reason?: string }> {
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            include: {
                slashCommandPermissions: {
                    where: { commandName }
                }
            }
        });

        if (!guild) {
            return { allowed: false, reason: "Guilde non enregistrée sur SigilOS" };
        }

        const perm = guild.slashCommandPermissions[0];
        if (perm) {
            if (!perm.isEnabled) {
                return { allowed: false, reason: "Cette commande est désactivée par le staff de la guilde" };
            }
            if (perm.roleIds.length > 0) {
                const hasRole = userRoleIds.some(r => perm.roleIds.includes(r));
                if (!hasRole) {
                    return { allowed: false, reason: "Rôle requis non possédé pour lancer cette commande" };
                }
            }
            if (channelId && perm.channelIds.length > 0) {
                if (!perm.channelIds.includes(channelId)) {
                    return { allowed: false, reason: "Cette commande n'est pas autorisée dans ce salon Discord" };
                }
            }
        }

        return { allowed: true };
    } catch {
        return { allowed: false, reason: "Erreur de vérification RBAC" };
    }
}
