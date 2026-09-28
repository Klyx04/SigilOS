/**
 * 🎫 Tickets — **icônes et styles de bouton** (pur : aucun I/O).
 *
 * Parité TicketTool / Tickets.bot, en sobre :
 *   · emoji unicode **ou** emoji custom `<:nom:id>` / `<a:nom:id>` ;
 *   · un emoji par bouton, jamais obligatoire (repli : ticket 🎫) ;
 *   · 4 couleurs Discord : PRIMARY (bleu), SECONDARY (gris), SUCCESS (vert),
 *     DANGER (rouge) — même vocabulaire que les deux bots de référence.
 */

export const TICKET_ICON_FALLBACK = "🎫";

/** Presets sobres proposés dans le dashboard (l'utilisateur peut coller autre chose). */
export const TICKET_ICON_PRESETS = [
    "🎫",
    "🛡️",
    "📩",
    "🔑",
    "🐛",
    "💡",
    "📝",
    "🎓",
    "🤝",
    "⚔️",
    "🏪",
    "📢",
] as const;

export const TICKET_BUTTON_STYLES = ["PRIMARY", "SECONDARY", "SUCCESS", "DANGER"] as const;
export type TicketButtonStyle = (typeof TICKET_BUTTON_STYLES)[number];

/** Libellés FR vulgarisés des 4 couleurs (le dashboard i18n porte la version EN). */
export const TICKET_BUTTON_STYLE_LABELS_FR: Record<TicketButtonStyle, string> = {
    PRIMARY: "Bleu",
    SECONDARY: "Gris",
    SUCCESS: "Vert",
    DANGER: "Rouge",
};

const CUSTOM_EMOJI_PATTERN = /^<a?:[a-zA-Z0-9_]{2,32}:\d{5,}>$/;

/**
 * Valide un emoji de bouton : unicode (1-8 caractères visibles) ou custom
 * `<:nom:id>` / `<a:nom:id>`. Vide = repli 🎫 (jamais d'erreur bloquante :
 * le dashboard corrige, Discord ne casse pas).
 */
export function normalizeTicketIcon(raw: string | null | undefined): string {
    const value = String(raw ?? "").trim();
    if (!value) return TICKET_ICON_FALLBACK;
    if (CUSTOM_EMOJI_PATTERN.test(value)) return value;
    // Unicode : on refuse ce qui ressemble à un identifiant collé par erreur.
    if (/^\d{5,}$/.test(value)) return TICKET_ICON_FALLBACK;
    if (value.length > 16) return TICKET_ICON_FALLBACK;
    return value;
}

/** `true` = emoji custom Discord (rendu `{ name, id, animated }`, pas `{ name }`). */
export function isCustomTicketIcon(icon: string): boolean {
    return CUSTOM_EMOJI_PATTERN.test(icon);
}

/** Forme Discord d'un emoji de bouton (`{ name }` ou `{ name, id, animated }`). */
export function ticketIconPayload(icon: string): { name: string; id?: string; animated?: boolean } {
    const match = /^<(a?):([a-zA-Z0-9_]{2,32}):(\d{5,})>$/.exec(icon);
    if (!match) return { name: icon };
    const [, animated, name, id] = match;
    return animated ? { name, id, animated: true } : { name, id };
}

/** Style Discord (1-4) d'un bouton, repli bleu. */
export function ticketButtonStyleNumber(value: string | null | undefined): number {
    switch (value) {
        case "SECONDARY":
            return 2;
        case "SUCCESS":
            return 3;
        case "DANGER":
            return 4;
        default:
            return 1;
    }
}
