import { db } from "@/lib/prisma";
import { isDiscordSnowflake } from "@/lib/god-guild-owner";

/**
 * D7 — **une seule écriture** pour `GuildConfig.ownerId`.
 *
 * La cible est l'identifiant interne `User.id` (CUID). On ne peut la produire que
 * si le propriétaire Discord a déjà un compte lié (`Account.providerAccountId`).
 * Tant que ce n'est pas le cas, on conserve le snowflake comme valeur
 * **transitoire** : `getUserContext` la remplace par `User.id` à la première visite
 * du propriétaire (self-heal). On ne devine donc jamais un identifiant.
 *
 * Fail-closed : une erreur de lecture remonte à l'appelant, qui refuse l'écriture.
 * Renvoie `null` pour une entrée vide.
 */
export async function resolveGuildOwnerWriteId(
    discordOwnerId: string | null | undefined,
): Promise<string | null> {
    const value = discordOwnerId?.trim();
    if (!value) return null;
    if (!isDiscordSnowflake(value)) return value;

    const account = await db.account.findFirst({
        where: { provider: "discord", providerAccountId: value },
        select: { userId: true },
    });

    return account?.userId ?? value;
}
