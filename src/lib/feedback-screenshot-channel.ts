/**
 * Salon des captures d'écran — règle pure.
 *
 * Décision produit (14/11/2026) : **aucun upload** de pièce jointe. Les
 * surfaces de retour renvoient vers **un salon Discord configurable côté God**
 * (page `/god/bugs`), jamais vers une invitation en dur. Le lien est construit
 * à partir de deux identifiants Discord (`serveur` + `salon`) ; si l'un des
 * deux manque, on n'affiche **rien** (fail-closed) plutôt qu'une invitation
 * obsolète.
 *
 * Aucune I/O ici : la résolution réseau (salon → serveur) vit dans
 * `src/server/feedback-screenshot-channel.ts`.
 */

/** Snowflake Discord : 17 à 20 chiffres. */
export const DISCORD_SNOWFLAKE_PATTERN = /^\d{17,20}$/;

/** Types de salons acceptés : texte (0), annonces (5) et forum (15). */
export const FEEDBACK_SCREENSHOT_CHANNEL_TYPES = [0, 5, 15] as const;

export function isDiscordSnowflake(value: string | null | undefined): boolean {
    if (typeof value !== "string") return false;
    return DISCORD_SNOWFLAKE_PATTERN.test(value.trim());
}

/**
 * Un salon texte (0), d'annonces (5) ou un forum (15).
 * Sur un forum, le bot crée un post titré et tagué ; le membre y joint sa capture.
 */
export function isWritableTextChannel(type: number | null | undefined): boolean {
    return typeof type === "number" && (FEEDBACK_SCREENSHOT_CHANNEL_TYPES as readonly number[]).includes(type);
}

/**
 * Lien cliquable vers le salon, ou `null` si le serveur ou le salon est
 * absent/invalide. Jamais de repli inventé.
 */
export function buildDiscordChannelUrl(
    guildId: string | null | undefined,
    channelId: string | null | undefined
): string | null {
    if (!isDiscordSnowflake(guildId) || !isDiscordSnowflake(channelId)) return null;
    return `https://discord.com/channels/${guildId!.trim()}/${channelId!.trim()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tags de forum — mapping « type de retour → tag »
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedbackForumTag {
    id: string;
    name: string;
    moderated?: boolean;
}

/** Ne garde que les clés connues et les valeurs snowflake ; jamais un objet brut en base. */
export function sanitizeFeedbackForumTagMap(
    value: unknown,
    allowedTypes: readonly string[]
): Record<string, string> {
    const out: Record<string, string> = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const type of allowedTypes) {
        const raw = (value as Record<string, unknown>)[type];
        if (typeof raw === "string" && isDiscordSnowflake(raw)) out[type] = raw.trim();
    }
    return out;
}

/**
 * Tag d'un post de forum pour un type de retour :
 *   1. le tag mappé côté God, **s'il existe encore** et n'est pas réservé aux modérateurs ;
 *   2. sinon le premier tag utilisable du forum ;
 *   3. sinon `null` — post sans tag, jamais bloquant.
 */
export function resolveFeedbackForumTag(
    feedbackType: string,
    tagMap: Record<string, string> | null | undefined,
    tags: FeedbackForumTag[] | null | undefined
): string | null {
    const usable = (tags ?? []).filter((tag) => isDiscordSnowflake(tag.id) && !tag.moderated);
    const mapped = tagMap?.[feedbackType];
    if (mapped) {
        const found = usable.find((tag) => tag.id === mapped.trim());
        if (found) return found.id;
    }
    return usable[0]?.id ?? null;
}
