"use server";

import { getUserContext } from "@/server/actions/user-actions";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";
import {
    TicketCustomCommandSaveSchema,
    readTicketCustomCommands,
    writeTicketCustomCommands,
    TICKET_CUSTOM_COMMANDS_MAX,
    type TicketCustomCommand,
} from "@/lib/tickets/custom-commands";
import { registerCommandsForGuild } from "./discord-commands-sync";
import { randomUUID } from "node:crypto";

/**
 * Récupère les commandes personnalisées de tickets pour une guilde.
 */
export async function getTicketCustomCommandsAction(guildId: string): Promise<{
    success: boolean;
    data?: TicketCustomCommand[];
    error?: string;
}> {
    try {
        const ctx = await getUserContext(guildId);
        if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
        if (!ctx.isMember) return { success: false, error: "Non membre" };

        const guildConfig = await db.guildConfig.findFirst({
            where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const config = await db.ticketGuildConfig.findUnique({
            where: { guildId: guildConfig.id },
            select: { settingsJson: true },
        });

        const commands = readTicketCustomCommands(config?.settingsJson);
        return { success: true, data: commands };
    } catch (error: any) {
        logger.error("[getTicketCustomCommandsAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de la récupération des commandes" };
    }
}

/**
 * Crée ou modifie une commande personnalisée de ticket et synchronise Discord.
 */
export async function saveTicketCustomCommandAction(
    guildId: string,
    rawInput: unknown
): Promise<{
    success: boolean;
    data?: TicketCustomCommand;
    error?: string;
}> {
    try {
        const ctx = await getUserContext(guildId);
        if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
        if (!ctx.canManageTickets) return { success: false, error: "Action réservée aux gestionnaires de tickets" };

        const rl = await rateLimit(`ticket-cmd:save:${ctx.id}:${guildId}`, 15, 60_000);
        if (!rl.success) {
            return { success: false, error: "Trop de modifications rapprochées. Veuillez patienter un instant." };
        }

        const parsed = TicketCustomCommandSaveSchema.safeParse(rawInput);
        if (!parsed.success) {
            return {
                success: false,
                error: parsed.error.issues[0]?.message || "Données de commande invalides",
            };
        }

        const input = parsed.data;
        const normalizedName = input.name.toLowerCase().trim();

        // Vérification de collision avec le catalogue officiel
        const catalogCollision = SLASH_COMMANDS_CATALOG.some(
            (c) => c.name.toLowerCase() === normalizedName
        );
        if (catalogCollision) {
            return {
                success: false,
                error: `Le nom "/${normalizedName}" est déjà réservé par une commande officielle du catalogue.`,
            };
        }

        const guildConfig = await db.guildConfig.findFirst({
            where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
            select: { id: true, discordGuildId: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const config = await db.ticketGuildConfig.findUnique({
            where: { guildId: guildConfig.id },
            include: { guild: { select: { discordGuildId: true } } },
        });
        if (!config) {
            return { success: false, error: "Configuration du bot ticket introuvable" };
        }

        const existingCommands = readTicketCustomCommands(config.settingsJson);
        const editingIndex = input.id
            ? existingCommands.findIndex((c) => c.id === input.id)
            : -1;

        // Vérification du quota (20 max) pour une nouvelle commande
        if (editingIndex === -1 && existingCommands.length >= TICKET_CUSTOM_COMMANDS_MAX) {
            return {
                success: false,
                error: `Quota maximal atteint (${TICKET_CUSTOM_COMMANDS_MAX} commandes maximum par guilde).`,
            };
        }

        // Vérification de doublon de nom au sein de la guilde
        const nameDuplicate = existingCommands.some(
            (c, i) => i !== editingIndex && c.name.toLowerCase() === normalizedName
        );
        if (nameDuplicate) {
            return {
                success: false,
                error: `Une commande "/${normalizedName}" existe déjà sur votre serveur.`,
            };
        }

        const now = new Date().toISOString();
        const commandToSave: TicketCustomCommand = {
            id: input.id || `cmd_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
            name: normalizedName,
            description: input.description.trim(),
            isEnabled: input.isEnabled,
            ephemeral: input.ephemeral,
            allowTargetMember: input.allowTargetMember,
            content: input.content || "",
            embedEnabled: input.embedEnabled,
            embed: input.embedEnabled ? input.embed : undefined,
            addRoleIds: input.addRoleIds || [],
            removeRoleIds: input.removeRoleIds || [],
            autoCloseTicket: input.autoCloseTicket,
            permissionMode: input.permissionMode,
            allowedRoleIds: input.allowedRoleIds || [],
            createdAt: editingIndex >= 0 ? existingCommands[editingIndex].createdAt : now,
            updatedAt: now,
        };

        const updatedList = [...existingCommands];
        if (editingIndex >= 0) {
            updatedList[editingIndex] = commandToSave;
        } else {
            updatedList.push(commandToSave);
        }

        const updatedSettingsJson = writeTicketCustomCommands(config.settingsJson, updatedList);

        await db.ticketGuildConfig.update({
            where: { guildId: guildConfig.id },
            data: { settingsJson: updatedSettingsJson as any },
        });

        // Synchronisation immédiate avec l'API Discord si le serveur Discord est configuré
        if (config.guild.discordGuildId) {
            try {
                await registerCommandsForGuild(config.guild.discordGuildId);
            } catch (syncErr) {
                logger.warn("[saveTicketCustomCommandAction] Échec synchro Discord immédiate:", syncErr);
            }
        }

        return { success: true, data: commandToSave };
    } catch (error: any) {
        logger.error("[saveTicketCustomCommandAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de l'enregistrement de la commande" };
    }
}

/**
 * Supprime une commande personnalisée de ticket et actualise Discord.
 */
export async function deleteTicketCustomCommandAction(
    guildId: string,
    commandId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const ctx = await getUserContext(guildId);
        if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
        if (!ctx.canManageTickets) return { success: false, error: "Action réservée aux gestionnaires de tickets" };

        const rl = await rateLimit(`ticket-cmd:delete:${ctx.id}:${guildId}`, 15, 60_000);
        if (!rl.success) {
            return { success: false, error: "Trop de suppressions rapprochées. Veuillez patienter un instant." };
        }

        const guildConfig = await db.guildConfig.findFirst({
            where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
            select: { id: true, discordGuildId: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const config = await db.ticketGuildConfig.findUnique({
            where: { guildId: guildConfig.id },
            include: { guild: { select: { discordGuildId: true } } },
        });
        if (!config) return { success: false, error: "Configuration introuvable" };

        const existing = readTicketCustomCommands(config.settingsJson);
        const filtered = existing.filter((c) => c.id !== commandId);

        const updatedSettingsJson = writeTicketCustomCommands(config.settingsJson, filtered);

        await db.ticketGuildConfig.update({
            where: { guildId: guildConfig.id },
            data: { settingsJson: updatedSettingsJson as any },
        });

        if (config.guild.discordGuildId) {
            try {
                await registerCommandsForGuild(config.guild.discordGuildId);
            } catch (syncErr) {
                logger.warn("[deleteTicketCustomCommandAction] Échec synchro Discord:", syncErr);
            }
        }

        return { success: true };
    } catch (error: any) {
        logger.error("[deleteTicketCustomCommandAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de la suppression de la commande" };
    }
}

/**
 * Active ou désactive rapidement une commande de ticket sans la supprimer.
 */
export async function toggleTicketCustomCommandAction(
    guildId: string,
    commandId: string,
    isEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        const ctx = await getUserContext(guildId);
        if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
        if (!ctx.canManageTickets) return { success: false, error: "Action réservée aux gestionnaires de tickets" };

        const rl = await rateLimit(`ticket-cmd:toggle:${ctx.id}:${guildId}`, 30, 60_000);
        if (!rl.success) {
            return { success: false, error: "Trop d'actions rapprochées. Veuillez patienter un instant." };
        }

        const guildConfig = await db.guildConfig.findFirst({
            where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
            select: { id: true, discordGuildId: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const config = await db.ticketGuildConfig.findUnique({
            where: { guildId: guildConfig.id },
            include: { guild: { select: { discordGuildId: true } } },
        });
        if (!config) return { success: false, error: "Configuration introuvable" };

        const existing = readTicketCustomCommands(config.settingsJson);
        const updated = existing.map((c) => (c.id === commandId ? { ...c, isEnabled, updatedAt: new Date().toISOString() } : c));

        const updatedSettingsJson = writeTicketCustomCommands(config.settingsJson, updated);

        await db.ticketGuildConfig.update({
            where: { guildId: guildConfig.id },
            data: { settingsJson: updatedSettingsJson as any },
        });

        if (config.guild.discordGuildId) {
            try {
                await registerCommandsForGuild(config.guild.discordGuildId);
            } catch (syncErr) {
                logger.warn("[toggleTicketCustomCommandAction] Échec synchro Discord:", syncErr);
            }
        }

        return { success: true };
    } catch (error: any) {
        logger.error("[toggleTicketCustomCommandAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors du changement d'état" };
    }
}
