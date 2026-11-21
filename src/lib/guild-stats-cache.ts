/**
 * Cache Redis des statistiques de guilde (B-3, 21/11/2026).
 *
 * Règle pure et unique : la clé est **cloisonnée par guilde** et le TTL reste borné
 * (2–5 min). Ce sont des données de **guilde**, jamais personnelles : un TTL plus long
 * supprime les `count`/`aggregate` coûteux du chemin chaud sans retarder une donnée
 * individuelle. Toute invalidation ciblée devra passer par `guildStatsCacheKey`.
 */
export const GUILD_STATS_CACHE_TTL_SECONDS = 180;

export function guildStatsCacheKey(discordGuildId: string): string {
    return `guild:stats:${discordGuildId}`;
}
