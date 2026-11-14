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

/** Types de salons où un membre peut poster un fichier (texte / annonce). */
export const FEEDBACK_SCREENSHOT_CHANNEL_TYPES = [0, 5] as const;

export function isDiscordSnowflake(value: string | null | undefined): boolean {
    if (typeof value !== "string") return false;
    return DISCORD_SNOWFLAKE_PATTERN.test(value.trim());
}

/** Un salon texte (0) ou d'annonces (5) accepte un message et une pièce jointe. */
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
