"use server";

/**
 * Module Membres — **« en guilde en jeu »** (décision user du 25/10/2026).
 *
 * Deux réglages, deux actions :
 *  1. `setInGameGuildRoleIds` : quels **rôles Discord** comptent comme « en guilde en jeu »
 *     (`GuildConfig.inGameGuildRoleIds`). Les IDs sont validés contre les rôles
 *     **réellement présents** sur le serveur — un rôle supprimé ne reste pas compté.
 *  2. `setMuleInGameGuild` : tag d'**une** mule déclarée (`altPseudos`, JSON existant,
 *     aucune migration) sur un profil dashboard **ou** une ligne de registre.
 *
 * Gardes : RBAC fail-closed (`Gérer les membres` ou admin) sur **chaque** action, cible
 * résolue **dans la guilde** avant écriture, entrées Zod bornées, rate limit Redis,
 * audit. Les lectures ne passent pas par ici (la page lit la configuration).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getUserContext } from "@/server/actions/user-actions";
import { createAuditLog } from "@/server/actions/audit-actions";
import { fetchGuildRoles } from "@/server/discord";
import {
    IN_GAME_GUILD_MAX_ROLES,
    isInGameGuildRoleId,
    mulePseudoKey,
    normalizeInGameGuildRoleIds,
} from "@/lib/in-game-guild";

const RoleIdsSchema = z.array(z.string().refine(isInGameGuildRoleId, "Identifiant de rôle invalide")).max(
    IN_GAME_GUILD_MAX_ROLES
);

const TargetSchema = z
    .object({
        profileId: z.string().min(1).max(64).nullish(),
        discordId: z.string().regex(/^\d{15,21}$/).nullish(),
    })
    .refine((value) => Boolean(value.profileId) !== Boolean(value.discordId), {
        message: "Indique soit le profil, soit le compte Discord",
    });

const PseudoSchema = z.string().trim().min(1).max(60);

/**
 * Enregistre les rôles Discord comptés comme « en guilde en jeu ».
 * `roleIds` est assaini (dédupliqué, borné) puis **intersecté** avec les rôles réels :
 * un ID inconnu du serveur est écarté, jamais stocké en silence.
 */
export async function setInGameGuildRoleIds(
    guildId: string,
    roleIds: string[]
): Promise<{ success: boolean; error?: string; roleIds?: string[] }> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }
    const actorUserId = ctx.id;
    if (!actorUserId) return { success: false, error: "Non authentifié" };

    const parsed = RoleIdsSchema.safeParse(roleIds);
    if (!parsed.success) return { success: false, error: "Sélection de rôles invalide" };

    // Rate limit Redis (jamais une variable mémoire) : réglage rare, 10 par minute.
    const rl = await rateLimit(`in-game-guild:roles:${actorUserId}:${guildId}`, 10, 60 * 1000);
    if (!rl.success) return { success: false, error: "Trop de modifications. Réessaie dans une minute." };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, inGameGuildRoleIds: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        // Fail-closed : sans la liste réelle des rôles du serveur, on ne devine rien.
        const discordRoles = await fetchGuildRoles(guildId, { excludeManaged: false }).catch(() => []);
        if (discordRoles.length === 0) {
            return { success: false, error: "Discord injoignable : impossible de valider les rôles" };
        }
        const normalized = normalizeInGameGuildRoleIds(
            parsed.data,
            new Set(discordRoles.map((role) => role.id))
        );

        await db.guildConfig.update({
            where: { id: guild.id },
            data: { inGameGuildRoleIds: normalized },
        });

        await createAuditLog({
            guildId,
            actorUserId,
            actorName: ctx.name || "Staff",
            action: "SETTINGS_UPDATED",
            targetType: "CONFIG",
            targetId: guild.id,
            oldValue: { inGameGuildRoleIds: guild.inGameGuildRoleIds },
            newValue: { inGameGuildRoleIds: normalized },
            metadata: { module: "membres", setting: "inGameGuildRoleIds" },
        }).catch(() => null);

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true, roleIds: normalized };
    } catch (error) {
        logger.error("[InGameGuild] Échec de l'enregistrement des rôles", { error: String(error) });
        return { success: false, error: "Erreur lors de l'enregistrement" };
    }
}

/**
 * Bascule le tag « en guilde en jeu » d'**une** mule déclarée.
 *
 * La cible est un profil dashboard (`profileId`) **ou** une ligne de registre
 * (`discordId`) — toujours **résolue dans la guilde** avant écriture. Le pseudo est
 * comparé comme la règle pure (casse/accents ignorés) ; les autres mules et leurs
 * champs (`classe`, `level`) sont conservés tels quels.
 */
export async function setMuleInGameGuild(
    guildId: string,
    target: { profileId?: string | null; discordId?: string | null },
    pseudo: string,
    value: boolean
): Promise<{ success: boolean; error?: string }> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }
    const actorUserId = ctx.id;
    if (!actorUserId) return { success: false, error: "Non authentifié" };

    const targetParsed = TargetSchema.safeParse(target ?? {});
    if (!targetParsed.success) return { success: false, error: "Membre ciblé invalide" };
    const pseudoParsed = PseudoSchema.safeParse(pseudo);
    if (!pseudoParsed.success) return { success: false, error: "Pseudo de mule invalide" };

    const rl = await rateLimit(`in-game-guild:mule:${actorUserId}:${guildId}`, 30, 60 * 1000);
    if (!rl.success) return { success: false, error: "Trop de modifications. Réessaie dans une minute." };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const { profileId, discordId } = targetParsed.data;
        const key = mulePseudoKey(pseudoParsed.data);
        if (!key) return { success: false, error: "Pseudo de mule invalide" };

        // Résolution de la cible DANS la guilde (isolation) avant toute écriture.
        let owner: { kind: "profile" | "registry"; id: string; altPseudos: unknown } | null = null;
        if (profileId) {
            const profile = await db.userProfile.findFirst({
                where: { id: profileId, guildId: guild.id },
                select: { id: true, altPseudos: true },
            });
            if (profile) owner = { kind: "profile", id: profile.id, altPseudos: profile.altPseudos };
        } else if (discordId) {
            const entry = await db.memberRegistryEntry.findFirst({
                where: { guildId: guild.id, discordId },
                select: { id: true, altPseudos: true },
            });
            if (entry) owner = { kind: "registry", id: entry.id, altPseudos: entry.altPseudos };
        }
        if (!owner) return { success: false, error: "Membre introuvable dans cette guilde" };

        const rawList: unknown[] = Array.isArray(owner.altPseudos) ? (owner.altPseudos as unknown[]) : [];
        let matched = false;
        const updated = rawList.map((entry) => {
            if (typeof entry === "string") {
                if (mulePseudoKey(entry) !== key) return entry;
                matched = true;
                return value ? { pseudo: entry, inGameGuild: true } : entry;
            }
            if (!entry || typeof entry !== "object") return entry;
            const candidate = entry as Record<string, unknown>;
            if (mulePseudoKey(typeof candidate.pseudo === "string" ? candidate.pseudo : null) !== key) {
                return entry;
            }
            matched = true;
            if (value) return { ...candidate, inGameGuild: true };
            const next = { ...candidate };
            delete next.inGameGuild;
            return next;
        });

        if (!matched) return { success: false, error: "Mule introuvable sur ce membre" };

        if (owner.kind === "profile") {
            await db.userProfile.update({ where: { id: owner.id }, data: { altPseudos: updated as never } });
        } else {
            await db.memberRegistryEntry.update({
                where: { id: owner.id },
                data: { altPseudos: updated as never },
            });
        }

        await createAuditLog({
            guildId,
            actorUserId,
            actorName: ctx.name || "Staff",
            action: "SETTINGS_UPDATED",
            targetType: owner.kind === "profile" ? "USER_PROFILE" : "MEMBER",
            targetId: owner.id,
            oldValue: { altPseudos: rawList },
            newValue: { altPseudos: updated },
            metadata: { module: "membres", setting: "muleInGameGuild", mule: pseudoParsed.data, value },
        }).catch(() => null);

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true };
    } catch (error) {
        logger.error("[InGameGuild] Échec du tag de mule", { error: String(error) });
        return { success: false, error: "Erreur lors de l'enregistrement" };
    }
}
