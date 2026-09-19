/**
 * Identifiants Discord : **snowflake** ou **ID différé d'outbox**.
 * Module **pur** (aucune I/O) — une seule source pour une règle qui a déjà
 * coûté deux bugs de production.
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────────
 * Avec `DISCORD_OUTBOX_ENABLED=true` (actif en bêta), `sendChannelMessage` ne
 * renvoie **pas** un ID Discord : l'écriture est déposée dans la file BullMQ et
 * la fonction rend `outbox:<jobId>`. Seul un **snowflake** (15-21 chiffres) est
 * acceptable dans `PATCH /channels/{salon}/messages/{id}` : tout autre format
 * produit un `404` définitif.
 *
 * Deux incidents mesurés à cause de ce piège :
 *  - **Status Discord** (17/09/2026) : l'ID `outbox:<jobId>` rejoué à chaque
 *    tick ⇒ le living status repartait en création (spam) ;
 *  - **Raids du calendrier** (19/09/2026) : `GuildEvent.discordMessageId` valait
 *    `outbox:<jobId>` ⇒ chaque inscription PATCHait un message inexistant, donc
 *    l'embed restait **figé** (compteur + inscrits) et le joueur lisait
 *    « ⚠️ L'embed Discord n'a pas pu être rafraîchi — le dashboard fait foi ».
 *
 * Le worker d'outbox **ré-ancre** le vrai snowflake dans Redis quand
 * l'appelant fournit `storeMessageIdKey` (voir `enqueueDiscordWrite`) — d'où le
 * duo `isOutboxMessageId` (ici) + résolution Redis (chez l'appelant).
 */

/** Un ID de message Discord est un snowflake : 15 à 21 chiffres. */
export const DISCORD_SNOWFLAKE_RE = /^\d{15,21}$/;

/** Préfixe des IDs **en file** renvoyés par l'outbox (jamais un ID Discord). */
export const DISCORD_OUTBOX_PREFIX = "outbox:";

/** Nature d'un identifiant stocké (sert aux logs ET aux gardes). */
export type DiscordIdKind = "snowflake" | "outbox" | "invalid";

/**
 * `true` si la valeur est un ID Discord exploitable en `PATCH`.
 * Type-guard : `unknown` en entrée (valeur SQLite/JSON/postgres), `string` en
 * sortie — les appelants n'ont plus besoin de re-vérifier le type.
 */
export function isDiscordSnowflake(v: unknown): v is string {
    return typeof v === "string" && DISCORD_SNOWFLAKE_RE.test(v);
}

/** `true` si la valeur est un ID **différé** (`outbox:<jobId>`) de la file d'écritures. */
export function isOutboxMessageId(v: unknown): v is string {
    return typeof v === "string" && v.startsWith(DISCORD_OUTBOX_PREFIX);
}

/**
 * Classe un identifiant stocké :
 *  - `snowflake` → utilisable tel quel ;
 *  - `outbox` → **résoudre** le vrai ID (Redis) avant tout PATCH ;
 *  - `invalid` → ni l'un ni l'autre (null, vide, valeur tronquée) : ne jamais
 *    l'envoyer à Discord.
 */
export function discordIdKind(v: unknown): DiscordIdKind {
    if (isDiscordSnowflake(v)) return "snowflake";
    if (isOutboxMessageId(v)) return "outbox";
    return "invalid";
}
