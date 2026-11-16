/**
 * God — fiche guilde : résolution du **propriétaire** (debug2.md, 16/11/2026).
 *
 * `GuildConfig.ownerId` est historiquement **ambigu** : snowflake Discord (arrivée
 * par le bot) ou UUID interne (transfert de propriété). Deux règles pures suffisent
 * à ne pas deviner dans l'écran :
 *  · `resolveGuildOwnerLookup` dit **comment** chercher (`Account.providerAccountId`
 *    pour un snowflake, `User.id` pour un UUID) ;
 *  · `buildAnkamaLadderUrl` ne construit une URL **que** si le pseudo et le serveur
 *    sont exploitables — jamais une URL inventée.
 */

/** Snowflake Discord : 17 à 20 chiffres. */
export function isDiscordSnowflake(value: string | null | undefined): boolean {
    return !!value && /^\d{17,20}$/.test(value.trim());
}

export type GuildOwnerLookup = { by: "user" | "discord"; value: string };

export function resolveGuildOwnerLookup(ownerId: string | null | undefined): GuildOwnerLookup | null {
    const value = ownerId?.trim();
    if (!value) return null;
    return isDiscordSnowflake(value) ? { by: "discord", value } : { by: "user", value };
}

/** Ladder Ankama public : succès par serveur + pseudo. */
export function buildAnkamaLadderUrl(
    pseudo: string | null | undefined,
    serverId: number | null | undefined,
): string | null {
    const name = pseudo?.trim();
    if (!name) return null;
    if (typeof serverId !== "number" || !Number.isInteger(serverId) || serverId <= 0) return null;
    return `https://www.dofus.com/fr/mmorpg/communaute/ladder/succes?server=${serverId}&name=${encodeURIComponent(name)}`;
}
