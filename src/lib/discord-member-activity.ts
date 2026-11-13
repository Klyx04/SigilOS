/**
 * Lot 7 — rétention de `DiscordMemberActivity` (règle **pure**).
 *
 * Mesure du 18/10/2026 : la table couvre **tous** les membres Discord (les profils ne
 * couvrent que les inscrits), donc elle doit se purger seule. Un membre **parti** est
 * conservé 365 jours (historique d'activité utile au staff), puis effacé ; un membre
 * **présent** n'est jamais purgé (`leftDiscordAt` est `NULL`).
 *
 * Ce module ne touche pas la base : il dit **où est la limite**. La suppression vit dans
 * `src/server/discord-member-activity-retention.ts` et n'est déclenchée que par le cron
 * `account-retention` (aucune action cliente).
 */

/** Durée de conservation après un départ du serveur Discord. */
export const DISCORD_MEMBER_ACTIVITY_RETENTION_DAYS = 365;

const DAY_MS = 86_400_000;

/** Date plancher : tout départ **strictement antérieur** est purgé. */
export function discordActivityCutoff(
    now: Date,
    retentionDays: number = DISCORD_MEMBER_ACTIVITY_RETENTION_DAYS
): Date {
    // Une valeur absurde (0, négative, NaN, non finie) ne doit JAMAIS raccourcir la
    // rétention : elle retombe sur le défaut de 365 jours. Plafond haut : 10 ans.
    const days =
        Number.isFinite(retentionDays) && retentionDays >= 1
            ? Math.min(3650, Math.floor(retentionDays))
            : DISCORD_MEMBER_ACTIVITY_RETENTION_DAYS;
    return new Date(now.getTime() - days * DAY_MS);
}

/** Une ligne est purgeable si elle est partie **avant** la limite (jamais un membre présent). */
export function isDiscordActivityPurgeable(
    leftDiscordAt: Date | string | null | undefined,
    now: Date,
    retentionDays: number = DISCORD_MEMBER_ACTIVITY_RETENTION_DAYS
): boolean {
    if (!leftDiscordAt) return false;
    const left = new Date(leftDiscordAt).getTime();
    if (!Number.isFinite(left)) return false;
    return left < discordActivityCutoff(now, retentionDays).getTime();
}