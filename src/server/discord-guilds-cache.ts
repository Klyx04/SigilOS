/**
 * Cache 60 s des serveurs Discord d'un membre — **I/O uniquement**.
 *
 * Écrit par le callback `signIn` (réponse Discord déjà lue) et par le portail
 * après un appel réussi ; lu par `getGuildsSeparated` avant tout nouvel appel.
 * Redis indisponible ⇒ `null` ⇒ appel Discord normal : le cache ne décide
 * jamais d'un accès, il évite seulement le doublon qui déclenchait un 429.
 *
 * Aucun snowflake dans les logs (règle §5.7).
 */

import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import {
    parseDiscordGuildSnapshot,
    serializeDiscordGuildSnapshot,
    type DiscordGuildSnapshotEntry,
} from "@/lib/discord-guilds-snapshot";

const KEY_PREFIX = "discord:user-guilds:";
const TTL_SECONDS = 60;

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Écrit le snapshot (best-effort : un échec ne bloque jamais la connexion). */
export async function cacheDiscordUserGuilds(
    discordId: string,
    guilds: readonly unknown[]
): Promise<void> {
    if (!discordId) return;
    const payload = serializeDiscordGuildSnapshot(guilds);
    if (!payload) return;
    try {
        await redis.set(`${KEY_PREFIX}${discordId}`, payload, "EX", TTL_SECONDS);
    } catch (error) {
        logger.warn("[Discord] Snapshot des serveurs non mis en cache", { error: errorMessage(error) });
    }
}

/** Lit le snapshot ; `null` = cache absent, expiré, illisible ou invalide. */
export async function readDiscordUserGuildsCache(
    discordId: string
): Promise<DiscordGuildSnapshotEntry[] | null> {
    if (!discordId) return null;
    try {
        return parseDiscordGuildSnapshot(await redis.get(`${KEY_PREFIX}${discordId}`));
    } catch (error) {
        logger.warn("[Portail] Snapshot des serveurs illisible", { error: errorMessage(error) });
        return null;
    }
}
