/**
 * 🎫 Tickets — **libellés bilingues FR/EN** (pur : aucun I/O, aucun import serveur).
 *
 * Choix de conception (demande user : « vulgarisé », « doublé français anglais ») :
 *   · sur Discord, pas de locale par guilde en base ⇒ les libellés portent les
 *     deux langues **sur la même ligne** (« Fermer / Close ») : 80 caractères
 *     max par bouton Discord, jamais dépassés (vérifié par test) ;
 *   · mots simples, jamais de jargon (« Je m'en occupe » plutôt que « Claim »,
 *     « Copie des messages » plutôt que « Transcript ») ;
 *   · le dashboard reste traduit par le système i18n (`fr.ts` / `en.ts`) : ce
 *     fichier ne sert que les **messages Discord** (boutons, embeds, refus).
 */

export const TICKET_BUTTON_LABEL_MAX = 80;

export const ticketTexts = {
    claim: "Je m'en occupe / Take it",
    release: "Remettre en file / Unclaim",
    add: "Ajouter / Add",
    remove: "Retirer / Remove",
    note: "Note privée / Private note",
    rename: "Renommer / Rename",
    close: "Fermer / Close",
    closeMine: "Fermer ma demande / Close my request",
    closeConfirmTitle: "Fermer ce ticket ? / Close this ticket?",
    closeConfirmBody:
        "Le salon restera visible par l'équipe. Tu pourras le rouvrir ou le supprimer après fermeture. / The channel stays visible to the staff. You can reopen or delete it after closing.",
    confirmClose: "Oui, fermer / Yes, close",
    cancel: "Annuler / Cancel",
    reopen: "Rouvrir / Reopen",
    transcript: "Copie / Transcript",
    delete: "Supprimer le salon / Delete channel",
    deleteConfirmTitle: "Supprimer ce salon ? / Delete this channel?",
    deleteConfirmBody:
        "Suppression définitive du salon Discord. La copie des messages reste dans les archives si activée. / Permanently deletes the Discord channel. The message copy stays in archives if enabled.",
    confirmDelete: "Oui, supprimer / Yes, delete",
    claimed: "a pris en charge ce ticket. / has claimed this ticket.",
    released: "a remis ce ticket en file. / has released this ticket.",
    memberAdded: "a accès au salon. / now has access to the channel.",
    memberRemoved: "n'a plus accès au salon. / no longer has access to the channel.",
    closed: "Ticket fermé. / Ticket closed.",
    reopened: "Ticket rouvert. / Ticket reopened.",
    deleted: "Salon supprimé. / Channel deleted.",
    closeNeedsReason: "Motif de clôture (optionnel) / Closing reason (optional)",
    addPrompt: "Qui ajouter ? Colle un identifiant ou une mention. / Who to add? Paste an ID or mention.",
    removePrompt: "Qui retirer ? Colle un identifiant ou une mention. / Who to remove? Paste an ID or mention.",
    userLabel: "Membre / Member",
} as const;

export type TicketTextKey = keyof typeof ticketTexts;

/** Libellé Discord prêt à poser sur un bouton (jamais plus de 80 caractères). */
export function ticketLabel(key: TicketTextKey): string {
    return ticketTexts[key].slice(0, TICKET_BUTTON_LABEL_MAX);
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
