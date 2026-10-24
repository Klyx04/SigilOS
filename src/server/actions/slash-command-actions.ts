"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { isSuperAdmin } from "./super-admin-actions";
import { logAction } from "./audit-actions";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";
import { isCatalogCommandDeployed } from "@/lib/discord/command-permissions";
import { registerCommandsForGuild } from "./discord-commands-sync";

const snowflakeSchema = z.string().regex(/^\d{5,25}$/);

const commandConfigSchema = z
    .object({
        addRoleId: snowflakeSchema.nullable(),
        removeRoleId: snowflakeSchema.nullable(),
    })
    .nullable()
    .optional();

const updateSlashPermSchema = z.object({
    guildId: z.string().min(1),
    commandName: z.string().min(1),
    roleIds: z.array(z.string()),
    channelIds: z.array(z.string()).default([]),
    isEnabled: z.boolean(),
    config: commandConfigSchema,
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

        const actualGuildId = config.discordGuildId || (typeof guildId === "string" && /^\d+$/.test(guildId) ? guildId : undefined);
        const user = await getUserContext(actualGuildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Unauthorized" };
        }

        const permissions = await db.guildSlashCommandPermission.findMany({
            where: { guildId: config.id }
        });

        const permMap = new Map(permissions.map(p => [p.commandName, p]));

        const matrix = SLASH_COMMANDS_CATALOG
            // Une commande `staffOnly` (ex. `/valider-recrue`) n'apparaît dans le
            // dashboard que si elle est **déployée** sur la guilde (whitelist God) :
            // afficher une commande absente de Discord ferait mentir l'écran.
            .filter((cmd) => {
                const existing = permMap.get(cmd.name);
                return isCatalogCommandDeployed(
                    cmd,
                    existing ? { commandName: existing.commandName, isEnabled: existing.isEnabled } : null
                );
            })
            .map(cmd => {
            const existing = permMap.get(cmd.name);
            return {
                command: cmd,
                isEnabled: existing ? existing.isEnabled : true,
                roleIds: existing ? existing.roleIds : [],
                channelIds: existing ? existing.channelIds : [],
                config: (existing?.config as { addRoleId: string | null; removeRoleId: string | null } | null) ?? null,
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

        const { guildId, commandName, roleIds, channelIds, isEnabled, config: commandConfig } = parsed.data;

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

        const actualGuildId = config.discordGuildId || (typeof guildId === "string" && /^\d+$/.test(guildId) ? guildId : undefined);
        const user = await getUserContext(actualGuildId);

        // Accès étendu au staff : toute permission de gestion permet de
        // configurer les commandes slash de la guilde (RBAC, tickets, membres…).
        // Les Discord Admin natifs conservent toujours l'accès.
        const hasAccess =
            user.isAuthenticated &&
            (user.isDiscordAdmin ||
                user.isAdmin ||
                user.canManageRBAC ||
                user.canViewSettings ||
                user.canManageTickets ||
                user.canManageMembers ||
                user.canManageMissions);
        if (!hasAccess) {
            return { success: false, error: "Forbidden: insufficient permissions" };
        }

        const updated = await db.guildSlashCommandPermission.upsert({
            where: {
                guildId_commandName: {
                    guildId: config.id,
                    commandName
                }
            },
            // `config` omise quand jamais réglée (null) : Prisma refuse le null
            // direct sur un Json — un objet `{ addRoleId: null, … }` passe, lui.
            create: {
                guildId: config.id,
                commandName,
                roleIds,
                channelIds,
                isEnabled,
                ...(commandConfig ? { config: commandConfig } : {}),
            },
            update: {
                roleIds,
                channelIds,
                isEnabled,
                ...(commandConfig ? { config: commandConfig } : {}),
            }
        });

        await logAction({
            guildId: config.discordGuildId || guildId,
            action: "RBAC_UPDATE",
            targetType: "PERMISSION",
            newValue: { commandName, roleIdsCount: roleIds.length, channelIdsCount: channelIds.length, isEnabled, hasConfig: !!commandConfig }
        }).catch(() => {});

        // 🆕 Le dashboard devient la **source de vérité** : on pousse rôles + salons sur
        // Discord immédiatement. Avant, l'enregistrement restait en base et Discord
        // gardait ses cases cochées à la main (mesure du 24/10/2026).
        const sync = config.discordGuildId
            ? await registerCommandsForGuild(config.discordGuildId)
            : null;

        return {
            success: true,
            data: updated,
            sync: sync
                ? { ok: sync.ok, error: sync.error, permissionErrors: sync.permissionErrors }
                : null,
        };
    } catch (err) {
        logger.error("[updateGuildSlashCommandPermissionAction Error]", err);
        return { success: false, error: "Failed to update slash command permission" };
    }
}

/**
 * Vérifie si un utilisateur Discord a le droit d'exécuter une commande slash donnée
 */
/**
 * Resynchronise **une guilde** (bouton « Resynchroniser » du dashboard) : définitions
 * + permissions réelles. Mêmes droits que la configuration des commandes slash.
 */
export async function syncGuildCommandsAction(guildId: string): Promise<{
    success: boolean;
    count?: number;
    permissionErrors?: string[];
    error?: string;
}> {
    try {
        const config = await db.guildConfig.findFirst({
            where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
            select: { id: true, discordGuildId: true },
        });
        if (!config) return { success: false, error: "Guilde introuvable" };

        const user = await getUserContext(config.discordGuildId || guildId);
        const hasAccess =
            user.isAuthenticated &&
            (user.isDiscordAdmin ||
                user.isAdmin ||
                user.canManageRBAC ||
                user.canViewSettings ||
                user.canManageTickets ||
                user.canManageMembers ||
                user.canManageMissions);
        if (!hasAccess) return { success: false, error: "Non autorisé" };

        if (!config.discordGuildId) {
            return { success: false, error: "Aucun serveur Discord lié à cette guilde" };
        }

        const sync = await registerCommandsForGuild(config.discordGuildId);
        if (!sync.ok) {
            return { success: false, error: sync.error || "Discord a refusé la synchronisation" };
        }
        return {
            success: true,
            count: sync.count,
            permissionErrors: sync.permissionErrors,
        };
    } catch (err) {
        logger.error("[syncGuildCommandsAction Error]", err);
        return { success: false, error: "Erreur de synchronisation" };
    }
}

/**
 * Vérifie si un utilisateur Discord a le droit d'exécuter une commande slash donnée
 * (règle unique, réutilisable hors route).
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
