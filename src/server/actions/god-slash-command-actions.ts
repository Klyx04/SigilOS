"use server";

import { z } from "zod";
import { isSuperAdmin } from "./super-admin-actions";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";
import { isCatalogCommandDeployed } from "@/lib/discord/command-permissions";
import type { GodCommandScopesPayload } from "@/lib/discord/command-permissions";
import { registerCommandsForGuild } from "./discord-commands-sync";

/**
 * 🌍 **Portée des commandes slash, guilde par guilde** (God).
 *
 * Demande user du 24/10/2026 : « de base aucune guilde ne doit pouvoir utiliser
 * `/valider-recrue` ; on ajoute un bouton sur God pour whitelister telle guilde, la
 * commande devient alors disponible sur Discord et apparaît dans son dashboard ».
 *
 * Une commande `staffOnly` n'est **pas enregistrée** sur Discord tant que la guilde
 * n'a pas de ligne `GuildSlashCommandPermission` activée : elle n'existe donc nulle
 * part (ni autocomplete, ni liste Intégrations). Une commande publique est déployée
 * par défaut et retirée si elle est désactivée ici.
 */

const scopeInputSchema = z.object({
    guildId: z.string().min(1).max(64),
    commandName: z.string().min(1).max(32),
    enabled: z.boolean(),
});

/** Guildes SigilOS + état réel de déploiement de chaque commande. */
export async function getGodCommandScopesAction(): Promise<GodCommandScopesPayload> {
    if (!(await isSuperAdmin())) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const guilds = await db.guildConfig.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, discordGuildId: true, isActive: true },
            orderBy: { name: "asc" },
            take: 200,
        });
        const rows = await db.guildSlashCommandPermission.findMany({
            select: { guildId: true, commandName: true, isEnabled: true },
        });
        const rowMap = new Map(rows.map((row) => [`${row.guildId}:${row.commandName}`, row.isEnabled]));

        const commands = SLASH_COMMANDS_CATALOG.map((command) => ({
            name: command.name,
            staffOnly: command.staffOnly === true,
        }));

        return {
            success: true,
            commands,
            guilds: guilds.map((guild) => {
                const deployed: Record<string, boolean> = {};
                for (const command of SLASH_COMMANDS_CATALOG) {
                    const enabled = rowMap.get(`${guild.id}:${command.name}`);
                    deployed[command.name] = isCatalogCommandDeployed(
                        command,
                        enabled === undefined ? null : { commandName: command.name, isEnabled: enabled }
                    );
                }
                return {
                    id: guild.id,
                    name: guild.name,
                    discordGuildId: guild.discordGuildId,
                    isActive: guild.isActive,
                    deployed,
                };
            }),
        };
    } catch (err) {
        logger.error("[getGodCommandScopesAction Error]", err);
        return { success: false, error: "Erreur de lecture des portées" };
    }
}

/**
 * Autorise / retire **une commande sur une guilde**, puis resynchronise Discord.
 * Le résultat renvoyé est celui de Discord : jamais un « ok » optimiste.
 */
export async function setGodCommandScopeAction(input: unknown): Promise<{
    success: boolean;
    deployed?: boolean;
    count?: number;
    permissionErrors?: string[];
    error?: string;
}> {
    if (!(await isSuperAdmin())) {
        return { success: false, error: "Unauthorized" };
    }

    const parsed = scopeInputSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: "Requête invalide" };
    }
    const { guildId, commandName, enabled } = parsed.data;

    const command = SLASH_COMMANDS_CATALOG.find((candidate) => candidate.name === commandName);
    if (!command) {
        return { success: false, error: "Commande inconnue du catalogue" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { id: guildId },
            select: { id: true, discordGuildId: true },
        });
        if (!guild) {
            return { success: false, error: "Guilde introuvable" };
        }

        await db.guildSlashCommandPermission.upsert({
            where: { guildId_commandName: { guildId: guild.id, commandName: command.name } },
            create: { guildId: guild.id, commandName: command.name, isEnabled: enabled },
            update: { isEnabled: enabled },
        });

        const sync = await registerCommandsForGuild(guild.discordGuildId);
        if (!sync.ok) {
            return { success: false, deployed: enabled, error: sync.error || "Discord a refusé la synchronisation" };
        }

        return {
            success: true,
            deployed: enabled,
            count: sync.count,
            permissionErrors: sync.permissionErrors,
        };
    } catch (err) {
        logger.error("[setGodCommandScopeAction Error]", err);
        return { success: false, error: "Erreur d'enregistrement de la portée" };
    }
}
