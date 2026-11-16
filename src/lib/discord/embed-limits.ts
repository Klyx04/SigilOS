/**
 * Limites Discord d'un **embed** — source unique, sans I/O.
 *
 * Discord refuse l'interaction **entière** dès qu'un champ dépasse 1024
 * caractères (et un titre 256) : côté utilisateur, cela s'affiche
 * « L'application n'a pas répondu ». Toute valeur construite depuis la base ou
 * depuis une saisie passe donc par `truncate` avant l'envoi.
 *
 * Les tickets (`src/lib/tickets/embeds.ts`) réexportent ces constantes : une
 * seule définition, deux consommateurs.
 */

export const DISCORD_TITLE_MAX = 256;
export const DISCORD_DESCRIPTION_MAX = 4096;
export const DISCORD_FIELD_VALUE_MAX = 1024;
export const DISCORD_FIELD_NAME_MAX = 256;

/** Tronque proprement (coupe visible par une ellipse, jamais muette). */
export function truncate(text: string, max: number): string {
    const value = String(text ?? "");
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(0, max - 1))}…`;
}
