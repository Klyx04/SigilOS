/**
 * 🏷️ **Formatage du nom de salon d'un ticket** — module **pur, sans aucun import**.
 *
 * Il existe séparément d'`embeds.ts` pour une raison mesurée : le **bot gateway**
 * (`services/discord-bot`) doit recalculer le nom d'un salon quand le demandeur change
 * de pseudo Discord, et il ne peut pas embarquer la chaîne d'imports d'`embeds.ts`
 * (formulaires, boutons, textes…). Une seule règle, deux consommateurs.
 */

/** Limite Discord pour un nom de salon. */
export const DISCORD_CHANNEL_NAME_MAX = 100;

/** Motif par défaut une fois le ticket fermé (`ticket-clos`). */
export const DEFAULT_CLOSED_CHANNEL_PATTERN = "ticket-clos";

export interface TicketChannelNameVars {
    number: number;
    user: string;
    journey: string;
}

/**
 * Nom de salon Discord : minuscules, `[a-z0-9-_]`, 100 caractères maximum.
 * `{num}` `{user}` `{journey}` (alias `{category}`) sont remplacés, puis le résultat
 * est assaini — un nom de parcours accentué ne casse pas la création du salon.
 */
export function formatTicketChannelName(pattern: string, vars: TicketChannelNameVars): string {
    const filled = (pattern || "ticket-{num}")
        .replace(/\{num\}/g, String(vars.number).padStart(4, "0"))
        .replace(/\{user\}/g, vars.user || "membre")
        .replace(/\{journey\}/g, vars.journey || "ticket")
        .replace(/\{category\}/g, vars.journey || "ticket");

    const slug = filled
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, DISCORD_CHANNEL_NAME_MAX);

    return slug.length > 0 ? slug : `ticket-${String(vars.number).padStart(4, "0")}`;
}

/** Nom du salon **une fois le ticket fermé** (`closedChannelPattern`, défaut `ticket-clos`). */
export function formatClosedTicketChannelName(
    pattern: string | null | undefined,
    vars: TicketChannelNameVars
): string {
    const safe = (pattern ?? "").trim() || DEFAULT_CLOSED_CHANNEL_PATTERN;
    return formatTicketChannelName(safe, vars);
}

/**
 * Le motif contient-il le **pseudo du demandeur** (`{user}`) ?
 *
 * C'est la condition du renommage automatique : si le staff a construit le nom du salon
 * avec `{user}` (`ticket-{num}-{user}`), un changement de pseudo Discord doit suivre.
 * Un motif sans `{user}` (`ticket-{num}`, `ticket-clos`…) ne bouge jamais.
 */
export function ticketNameUsesCreator(pattern: string | null | undefined): boolean {
    return typeof pattern === "string" && /\{user\}/i.test(pattern);
}
