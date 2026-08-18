/**
 * Avatar Hash Resync — chantier #134 (reste backend).
 *
 * Le hash d'avatar Discord est figé dans `User.image` au login OAuth. Quand un
 * membre change son avatar sur Discord, l'ancien hash 404 sur le CDN → avatars
 * cassés (ERR_BLOCKED_BY_ORB), aujourd'hui seulement masqués par le fallback UI
 * (DiscordAvatarImage). Ce module re-synchronise périodiquement les hashs via
 * `GET /guilds/{guild_id}/members` :
 *   - avatar de guilde (`member.avatar`) prioritaire sur l'avatar global (`user.avatar`) ;
 *   - `null` → `User.image = null` (l'UI bascule alors sur l'avatar par défaut
 *     officiel `cdn.discordapp.com/embed/avatars/{n}.png` via getDefaultDiscordAvatar).
 *
 * Usage :
 *   - Route cron : /api/cron/avatar-resync (protégée par x-cron-secret).
 *   - Appel manuel/God : resyncGuildAvatarHashes(guildId).
 */

"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { listGuildMembers } from "@/server/discord";
import { buildDiscordAvatarUrl } from "@/lib/discord-avatars";

export interface AvatarSyncResult {
    success: boolean;
    updated: number;
    unchanged: number;
    errors: string[];
}

/**
 * Resync les hashs d'avatars Discord d'une seule guilde.
 * Fail-closed : guilde inconnue → success=false, aucune exception propagée.
 */
export async function resyncGuildAvatarHashes(discordGuildId: string): Promise<AvatarSyncResult> {
    const result: AvatarSyncResult = { success: true, updated: 0, unchanged: 0, errors: [] };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true, name: true },
        });

        if (!guild) {
            return { success: false, updated: 0, unchanged: 0, errors: ["Guild not found"] };
        }

        // 1. Liste Discord actuelle : discordId → hash (avatar de guilde prioritaire).
        const discordMembers = await listGuildMembers(discordGuildId);
        const avatarByDiscordId = new Map<string, string | null>();
        for (const member of discordMembers) {
            const userId = member.user?.id;
            if (!userId) continue;
            avatarByDiscordId.set(userId, member.avatar ?? member.user.avatar ?? null);
        }

        // 2. Profils locaux de la guilde (User + compte Discord).
        const profiles = await db.userProfile.findMany({
            where: { guildId: guild.id },
            select: {
                userId: true,
                user: {
                    select: {
                        id: true,
                        image: true,
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true },
                        },
                    },
                },
            },
        });

        // 3. Comparaison + mise à jour uniquement si changement (anti-writes inutiles).
        for (const profile of profiles) {
            const discordAccount = profile.user.accounts[0];
            if (!discordAccount) continue;

            const discordUserId = discordAccount.providerAccountId;
            const hash = avatarByDiscordId.get(discordUserId);
            // Membres absents de la réponse Discord (quota 1000, etc.) → on les ignore,
            // on ne casse pas un avatar existant sur une donnée incomplète.
            if (!avatarByDiscordId.has(discordUserId)) continue;

            const nextImage = buildDiscordAvatarUrl(discordUserId, hash, 256) ?? null;

            if (profile.user.image === nextImage) {
                result.unchanged++;
                continue;
            }

            await db.user.update({
                where: { id: profile.userId },
                data: { image: nextImage },
            });
            result.updated++;
        }

        logger.info(
            `[AvatarSync] Guild ${guild.name} (${discordGuildId}) — ${result.updated} avatar(s) mis à jour, ${result.unchanged} inchangés.`
        );
    } catch (error) {
        result.success = false;
        result.errors.push(error instanceof Error ? error.message : "Unknown error");
        logger.error("[AvatarSync] Error:", { error });
    }

    return result;
}

/**
 * Resync des hashs d'avatars de toutes les guildes (usage cron).
 * Itération sur la whitelist ALLOWED_GUILD_IDS si définie, sinon toutes les guildes BDD.
 */
export async function syncAllGuildAvatars(): Promise<{ results: Record<string, AvatarSyncResult> }> {
    const whitelistVar = process.env.ALLOWED_GUILD_IDS;

    const guildIds = whitelistVar
        ? whitelistVar.split(",").map(id => id.trim()).filter(Boolean)
        : (await db.guildConfig.findMany({ select: { discordGuildId: true } })).map(g => g.discordGuildId);

    const results: Record<string, AvatarSyncResult> = {};
    for (const guildId of guildIds) {
        results[guildId] = await resyncGuildAvatarHashes(guildId);
    }
    return { results };
}
