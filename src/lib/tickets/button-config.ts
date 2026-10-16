/**
 * 🎫 Tickets — **boutons du salon** : libellés, icônes et droits (pur : aucun I/O).
 *
 * Demande user (16/10/2026) : dans le salon, **deux boutons seulement** au départ
 * (« Prendre en charge », « Fermer le ticket ») ; quand on ferme, on **révèle**
 * « Transcript » et « Supprimer le salon » ; et chaque bouton doit pouvoir être
 * **renommé, ré-icônifié** et **réservé à certains rôles** (RBAC), comme les gros bots.
 *
 * Stockage : `TicketGuildConfig.settingsJson.buttons` (colonne JSON existante) —
 * **aucune migration**. Forme :
 *
 * ```json
 * { "buttons": {
 *     "claim":      { "label": "Je m'en occupe", "emoji": "🛡️", "access": "staff" },
 *     "close":      { "access": "staff_or_creator" },
 *     "transcript": { "label": "Transcript",     "access": "staff" },
 *     "delete":     { "access": "disabled" } } }
 * ```
 *
 * ⚠️ Deux invariants :
 *   · **fail-closed** — un bouton absent de la configuration garde son défaut, et un
 *     `access` inconnu retombe sur le défaut restrictif ; jamais d'accès ouvert par une
 *     configuration illisible ;
 *   · **`disabled` retire vraiment le bouton** du message (il n'apparaît plus du tout).
 */

import { TICKET_BUTTON_EMOJIS, ticketTexts, type TicketLang } from "./ticket-texts";

/** Boutons qui peuvent vivre **dans le salon** (les outils du dashboard n'en font pas partie). */
export const TICKET_BUTTON_KEYS = ["claim", "close", "reopen", "transcript", "delete"] as const;
export type TicketButtonKey = (typeof TICKET_BUTTON_KEYS)[number];

/** `staff` = équipe seule · `staff_or_creator` = équipe ou demandeur · `disabled` = retiré. */
export const TICKET_BUTTON_ACCESS = ["staff", "staff_or_creator", "disabled"] as const;
export type TicketButtonAccess = (typeof TICKET_BUTTON_ACCESS)[number];

export const TICKET_BUTTON_LABEL_MAX = 80;
export const TICKET_BUTTON_EMOJI_MAX = 32;

export type TicketButtonConfig = {
    label?: string;
    emoji?: string;
    access?: TicketButtonAccess;
};

export type TicketButtonSettings = Partial<Record<TicketButtonKey, TicketButtonConfig>>;

/** Clé de texte FR/EN correspondante (source unique des libellés par défaut). */
const TEXT_KEY: Record<TicketButtonKey, keyof (typeof ticketTexts)["fr"]> = {
    claim: "claim",
    close: "close",
    reopen: "reopen",
    transcript: "transcript",
    delete: "delete",
};

/** Défaut **restrictif** de chaque bouton (ce que le produit promet sans configuration). */
export const TICKET_BUTTON_DEFAULT_ACCESS: Record<TicketButtonKey, TicketButtonAccess> = {
    claim: "staff",
    close: "staff_or_creator",
    reopen: "staff_or_creator",
    transcript: "staff",
    delete: "staff",
};

/** Libellé par défaut d'un bouton (FR/EN depuis `ticket-texts`, jamais dupliqué ici). */
export function defaultTicketButtonLabel(key: TicketButtonKey, lang: TicketLang = "fr"): string {
    return ticketTexts[lang === "en" ? "en" : "fr"][TEXT_KEY[key]].slice(0, TICKET_BUTTON_LABEL_MAX);
}

/** Emoji par défaut d'un bouton. */
export function defaultTicketButtonEmoji(key: TicketButtonKey): string {
    return TICKET_BUTTON_EMOJIS[key];
}

function isAccess(value: unknown): value is TicketButtonAccess {
    return value === "staff" || value === "staff_or_creator" || value === "disabled";
}

/** Lit `settingsJson.buttons` **sans jamais jeter** (JSON invalide = aucun réglage). */
export function readTicketButtonSettings(raw: unknown): TicketButtonSettings {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const buttons = (raw as Record<string, unknown>).buttons;
    if (!buttons || typeof buttons !== "object" || Array.isArray(buttons)) return {};

    const clean: TicketButtonSettings = {};
    for (const key of TICKET_BUTTON_KEYS) {
        const entry = (buttons as Record<string, unknown>)[key];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const input = entry as Record<string, unknown>;
        const config: TicketButtonConfig = {};
        if (typeof input.label === "string" && input.label.trim()) {
            config.label = input.label.trim().slice(0, TICKET_BUTTON_LABEL_MAX);
        }
        if (typeof input.emoji === "string" && input.emoji.trim()) {
            config.emoji = input.emoji.trim().slice(0, TICKET_BUTTON_EMOJI_MAX);
        }
        if (isAccess(input.access)) config.access = input.access;
        if (Object.keys(config).length > 0) clean[key] = config;
    }
    return clean;
}

/** Fusionne les réglages de boutons dans `settingsJson` (ce que l'écran enregistre). */
export function writeTicketButtonSettings(
    current: unknown,
    settings: TicketButtonSettings
): Record<string, unknown> {
    const base =
        current && typeof current === "object" && !Array.isArray(current)
            ? { ...(current as Record<string, unknown>) }
            : {};
    const clean: Record<string, TicketButtonConfig> = {};
    for (const key of TICKET_BUTTON_KEYS) {
        const config = settings[key];
        if (!config) continue;
        const kept: TicketButtonConfig = {};
        if (typeof config.label === "string" && config.label.trim()) {
            kept.label = config.label.trim().slice(0, TICKET_BUTTON_LABEL_MAX);
        }
        if (typeof config.emoji === "string" && config.emoji.trim()) {
            kept.emoji = config.emoji.trim().slice(0, TICKET_BUTTON_EMOJI_MAX);
        }
        if (isAccess(config.access)) kept.access = config.access;
        if (Object.keys(kept).length > 0) clean[key] = kept;
    }
    base.buttons = clean;
    return base;
}

/** Bouton **résolu** : ce que le message Discord porte réellement. */
export type ResolvedTicketButton = {
    key: TicketButtonKey;
    label: string;
    emoji: string;
    access: TicketButtonAccess;
};

/** Un bouton tel qu'il sera rendu (défauts appliqués, bornes Discord respectées). */
export function resolveTicketButton(
    key: TicketButtonKey,
    settings: TicketButtonSettings | null | undefined,
    lang: TicketLang = "fr"
): ResolvedTicketButton {
    const config = settings?.[key] ?? {};
    const label = (config.label || defaultTicketButtonLabel(key, lang)).slice(0, TICKET_BUTTON_LABEL_MAX);
    const emoji = (config.emoji || defaultTicketButtonEmoji(key)).slice(0, TICKET_BUTTON_EMOJI_MAX);
    return { key, label, emoji, access: config.access ?? TICKET_BUTTON_DEFAULT_ACCESS[key] };
}

/**
 * Boutons affichés dans le message, **dans l'ordre**, selon l'état du ticket :
 *   · ouvert ou pris en charge → Prendre en charge, Fermer ;
 *   · fermé → Rouvrir, Transcript, Supprimer.
 * Les boutons `disabled` sont retirés (jamais affichés « pour rien »).
 */
export function ticketButtonLayout(
    status: string,
    settings?: TicketButtonSettings | null,
    lang: TicketLang = "fr"
): ResolvedTicketButton[] {
    const keys: TicketButtonKey[] = status === "CLOSED" ? ["reopen", "transcript", "delete"] : ["claim", "close"];
    return keys
        .map((key) => resolveTicketButton(key, settings, lang))
        .filter((button) => button.access !== "disabled");
}

/**
 * Niveau d'accès exigé au clic pour un bouton : le réglage de la guilde, sinon le défaut.
 * `disabled` = bouton retiré (l'action est refusée, même si un vieux message le porte).
 */
export function ticketButtonAccess(
    key: TicketButtonKey,
    settings?: TicketButtonSettings | null
): TicketButtonAccess {
    return settings?.[key]?.access ?? TICKET_BUTTON_DEFAULT_ACCESS[key];
}

/** Libellé FR d'un niveau d'accès (écran de réglage). */
export const TICKET_BUTTON_ACCESS_LABELS: Record<TicketButtonAccess, string> = {
    staff: "Équipe / Staff",
    staff_or_creator: "Équipe ou demandeur",
    disabled: "Désactivé (bouton retiré)",
};

/** Nom du bouton **côté écran de réglage** (le libellé Discord est celui que l'admin écrit). */
export const TICKET_BUTTON_ADMIN_LABELS: Record<TicketButtonKey, string> = {
    claim: "Prendre en charge",
    close: "Fermer le ticket",
    reopen: "Rouvrir",
    transcript: "Transcript (copie des messages)",
    delete: "Supprimer le salon",
};

/** Explication courte par bouton (ce qu'il fait, quand il apparaît). */
export const TICKET_BUTTON_ADMIN_HINTS: Record<TicketButtonKey, string> = {
    claim: "Visible dès l'ouverture ; seul le staff peut le cliquer tant que le droit reste « Équipe ».",
    close: "Visible dès l'ouverture. Une fois fermé, le salon révèle Rouvrir, Transcript et Supprimer.",
    reopen: "N'apparaît qu'après fermeture.",
    transcript: "Génère la copie des messages (document partageable + annexe staff).",
    delete: "N'apparaît qu'après fermeture : confirmation puis compte à rebours de 4 secondes.",
};
