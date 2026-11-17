/**
 * God — fiche guilde : résolution du **propriétaire** (debug2.md, 16/11/2026).
 *
 * `GuildConfig.ownerId` est historiquement **ambigu** : snowflake Discord (arrivée
 * par le bot) ou identifiant interne `User.id` (transfert de propriété). D7 normalise
 * l'écriture vers l'identifiant interne ; deux règles pures suffisent à ne pas
 * deviner dans l'écran :
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

/**
 * D7 — nature de la valeur stockée dans `GuildConfig.ownerId`.
 *
 * - `DISCORD_SNOWFLAKE` : valeur **transitoire** (bot/onboarding avant que le
 *   propriétaire n'ait de compte interne) — à normaliser ;
 * - `INTERNAL` : identifiant interne `User.id` (CUID) — la cible ;
 * - `NULL` : aucun propriétaire connu.
 *
 * On ne suppose **jamais** un format UUID : `User.id` est un CUID. Tout ce qui
 * n'est pas un snowflake est donc traité comme interne.
 */
export type GuildOwnerIdKind = "NULL" | "DISCORD_SNOWFLAKE" | "INTERNAL";

export function classifyGuildOwnerId(value: string | null | undefined): GuildOwnerIdKind {
    const trimmed = value?.trim();
    if (!trimmed) return "NULL";
    return isDiscordSnowflake(trimmed) ? "DISCORD_SNOWFLAKE" : "INTERNAL";
}

export interface GuildOwnerBackfillRow {
    id: string;
    ownerId: string | null;
}

export interface GuildOwnerBackfillEntry {
    id: string;
    action: "KEEP" | "UPDATE" | "UNRESOLVED";
    from: string | null;
    to: string | null;
}

export interface GuildOwnerBackfillPlan {
    entries: GuildOwnerBackfillEntry[];
    counts: { total: number; keep: number; update: number; unresolved: number };
}

/**
 * Plan de backfill **pur** : aucune écriture, aucun accès base.
 *
 * - snowflake résolu par un compte Discord lié → `UPDATE` vers `User.id` ;
 * - snowflake sans compte lié → `UNRESOLVED` (on garde la valeur transitoire :
 *   le propriétaire n'a pas encore de compte, `getUserContext` la normalisera à
 *   sa première visite) ;
 * - valeur interne ou nulle → `KEEP`.
 */
export function planGuildOwnerBackfill(
    rows: readonly GuildOwnerBackfillRow[],
    ownerToUserId: ReadonlyMap<string, string>,
): GuildOwnerBackfillPlan {
    let keep = 0;
    let update = 0;
    let unresolved = 0;

    const entries = rows.map((row): GuildOwnerBackfillEntry => {
        const kind = classifyGuildOwnerId(row.ownerId);
        if (kind !== "DISCORD_SNOWFLAKE") {
            keep++;
            return { id: row.id, action: "KEEP", from: row.ownerId, to: row.ownerId };
        }

        const from = row.ownerId!.trim();
        const userId = ownerToUserId.get(from);
        if (!userId) {
            unresolved++;
            return { id: row.id, action: "UNRESOLVED", from: row.ownerId, to: null };
        }

        update++;
        return { id: row.id, action: "UPDATE", from: row.ownerId, to: userId };
    });

    return { entries, counts: { total: rows.length, keep, update, unresolved } };
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
