import { cache } from "react";
import { db } from "@/lib/prisma";

/**
 * Id interne d'une guilde, résolu **une seule fois par requête** (React `cache`) puis
 * mémorisé 5 min. La page d'accueil du dashboard lisait `GuildConfig` 5 à 6 fois pour le
 * même `id` (calendrier, activité, présence, sondages) : cette source unique supprime ces
 * lectures en double sur le chemin froid.
 *
 * - Lecture seule, `id` uniquement ; **aucune garde d'accès** ici. Les appelants
 *   authentifient d'abord (`getUserContext`), puis filtrent par cet id.
 * - Un `null` n'est **pas** mémorisé : une guilde créée après le premier appel doit être
 *   résolue au suivant (onboarding).
 * - L'id ne change jamais ; une guilde supprimée peut rester résolue ≤ 5 min, mais les
 *   appelants ont déjà refusé l'accès via `getUserContext` avant d'utiliser l'id.
 */
const TTL_MS = 5 * 60 * 1000;
const idCache = new Map<string, { id: string; expiresAt: number }>();

export const getInternalGuildId = cache(async (discordGuildId: string): Promise<string | null> => {
    const now = Date.now();
    const hit = idCache.get(discordGuildId);
    if (hit && hit.expiresAt > now) return hit.id;

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true },
    });
    if (!guild) return null;

    idCache.set(discordGuildId, { id: guild.id, expiresAt: now + TTL_MS });
    return guild.id;
});
