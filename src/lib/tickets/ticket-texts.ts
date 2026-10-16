/**
 * 🎫 Tickets — **libellés monolingues FR/EN** (pur : aucun I/O, aucun import serveur).
 *
 * Un serveur = une langue (réglée dans Configuration, stockée dans
 * `settingsJson.ticketLanguage`, repli français) : les boutons et messages
 * Discord ne doublent plus les deux langues sur la même ligne.
 *
 * Vocabulaire simple, jamais de jargon (« Je m'en occupe » plutôt que
 * « Claim », « Copie des messages » plutôt que « Transcript »).
 */

export const TICKET_BUTTON_LABEL_MAX = 80;

export const TICKET_LANGS = ["fr", "en"] as const;
export type TicketLang = (typeof TICKET_LANGS)[number];

/** Langue effective d'une guilde (repli français, jamais d'exception). */
export function resolveTicketLang(raw: unknown): TicketLang {
    return raw === "en" ? "en" : "fr";
}

const FR = {
    claim: "Je m'en occupe",
    inProgress: "En traitement",
    release: "Remettre en file",
    add: "Ajouter",
    remove: "Retirer",
    note: "Note privée",
    rename: "Renommer",
    close: "Fermer",
    closeMine: "Fermer ma demande",
    closeConfirmTitle: "Fermer ce ticket ?",
    closeConfirmBody:
        "Le salon restera visible par l'équipe. Tu pourras le rouvrir ou le supprimer après fermeture.",
    confirmClose: "Oui, fermer",
    cancel: "Annuler",
    reopen: "Rouvrir",
    // Demande user (16/10/2026) : le bouton s'appelle « Transcript », jamais « Copie ».
    transcript: "Transcript",
    delete: "Supprimer le salon",
    deleteConfirmTitle: "Supprimer ce salon ?",
    deleteConfirmBody:
        "Suppression définitive du salon Discord. La copie des messages reste dans les archives si activée.",
    confirmDelete: "Oui, supprimer",
    claimed: "a pris en charge ce ticket.",
    released: "a remis ce ticket en file.",
    memberAdded: "a accès au salon.",
    memberRemoved: "n'a plus accès au salon.",
    closed: "Ticket fermé.",
    reopened: "Ticket rouvert.",
    deleted: "Salon supprimé.",
    closeNeedsReason: "Motif de clôture (optionnel)",
    addPrompt: "Qui ajouter ? Colle un identifiant ou une mention.",
    removePrompt: "Qui retirer ? Colle un identifiant ou une mention.",
    userLabel: "Membre",
} as const;

const EN = {
    claim: "Take it",
    inProgress: "In progress",
    release: "Unclaim",
    add: "Add",
    remove: "Remove",
    note: "Private note",
    rename: "Rename",
    close: "Close",
    closeMine: "Close my request",
    closeConfirmTitle: "Close this ticket?",
    closeConfirmBody:
        "The channel stays visible to the staff. You can reopen or delete it after closing.",
    confirmClose: "Yes, close",
    cancel: "Cancel",
    reopen: "Reopen",
    transcript: "Transcript",
    delete: "Delete channel",
    deleteConfirmTitle: "Delete this channel?",
    deleteConfirmBody:
        "Permanently deletes the Discord channel. The message copy stays in archives if enabled.",
    confirmDelete: "Yes, delete",
    claimed: "has claimed this ticket.",
    released: "has released this ticket.",
    memberAdded: "now has access to the channel.",
    memberRemoved: "no longer has access to the channel.",
    closed: "Ticket closed.",
    reopened: "Ticket reopened.",
    deleted: "Channel deleted.",
    closeNeedsReason: "Closing reason (optional)",
    addPrompt: "Who to add? Paste an ID or mention.",
    removePrompt: "Who to remove? Paste an ID or mention.",
    userLabel: "Member",
} as const;

export const ticketTexts: Record<TicketLang, Record<keyof typeof FR, string>> = { fr: { ...FR }, en: { ...EN } };

export type TicketTextKey = keyof typeof FR;

/** Libellé Discord prêt à poser sur un bouton (jamais plus de 80 caractères). */
export function ticketLabel(key: TicketTextKey, lang: TicketLang = "fr"): string {
    return ticketTexts[lang === "en" ? "en" : "fr"][key].slice(0, TICKET_BUTTON_LABEL_MAX);
}

/** Emojis sobres du module (un seul par bouton, jamais d'emoji animé). */
export const TICKET_BUTTON_EMOJIS = {
    claim: "🛡️",
    add: "👤",
    remove: "👤",
    note: "🔒",
    rename: "✏️",
    close: "📦",
    reopen: "🔓",
    transcript: "📄",
    delete: "🗑️",
    cancel: "↩️",
} as const;
