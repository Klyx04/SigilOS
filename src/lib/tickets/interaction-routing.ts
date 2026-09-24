/**
 * 🎫 Tickets v2 — **routage des interactions Discord** (pur, testable, sans I/O).
 *
 * Constat de l'audit du 24/09/2026 : le préfixe `tb` était **absent de
 * `DISCORD_PERM_MAP`** (`interactions/route.ts:90-96`), donc
 * `isDiscordPrefixAuthorized` retournait `true` **sans aucun contrôle** — un
 * demandeur pouvait « Prendre en charge », ajouter une note « interne » et fermer
 * son propre ticket depuis son salon.
 *
 * Ce fichier est la **source unique** qui remplace ce trou : il dit, pour chaque
 * `custom_id`, *quelle action* est demandée et *qui* peut la déclencher. La route
 * traduit ; le service applique. Un `custom_id` inconnu renvoie `null` ⇒ refus
 * (fail-closed : jamais d'action devinée, jamais de droit supposé).
 */

/** Préfixe des boutons, menus et modales du module (`tb:...`). */
export const TICKET_PREFIX = "tb";

/** Préfixe de l'étape « choix » (Oui/Non et sélecteurs avant la modale). */
export const TICKET_PICK_PREFIX = "tb_pick";

/** `custom_id` borné : Discord refuse au-delà de 100 caractères. */
export const TICKET_CUSTOM_ID_MAX = 100;

/** Actions reconnues du module. */
export type TicketActionKind =
    | "open"
    | "select_open"
    | "select_journey"
    | "modal_open"
    | "pick"
    | "claim"
    | "release"
    | "note"
    | "rename"
    | "close"
    | "reopen"
    | "csat"
    | "approve"
    | "refuse";

/** Niveau d'accès minimal exigé par une action. */
export type TicketAccessLevel = "public" | "staff" | "creator" | "staff_or_creator";

export type TicketActionDescriptor = {
    kind: TicketActionKind;
    access: TicketAccessLevel;
    /** `tb` = bouton/menu/modale ; `tb_pick` = étape choix. */
    source: "tb" | "tb_pick";
    panelId?: string;
    journeyId?: string;
    ticketId?: string;
    fieldId?: string;
    /** Valeur d'un choix (`yes` / `no`). */
    value?: string;
    /** Note de CSAT (1-5). */
    rating?: number;
};

/** Niveaux d'accès par action — table **exhaustive** (aucune action oubliée). */
const ACTION_ACCESS: Record<TicketActionKind, TicketAccessLevel> = {
    // Ouverture : tout membre du serveur (le parcours publié est vérifié par le service).
    open: "public",
    select_open: "public",
    select_journey: "public",
    modal_open: "public",
    pick: "public",
    // Actions de staff — vérifiées par `decideTicketAccess`.
    claim: "staff",
    release: "staff",
    note: "staff",
    rename: "staff",
    approve: "staff",
    refuse: "staff",
    // Fermeture : staff, ou le demandeur si le parcours le publie.
    close: "staff_or_creator",
    reopen: "staff_or_creator",
    // Avis : seul le demandeur du ticket.
    csat: "creator",
};

const FIELD_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * Analyse un `custom_id` du module. Renvoie `null` si le format est inconnu :
 * l'appelant **doit** refuser (jamais de `catch`-all silencieux).
 */
export function parseTicketCustomId(customId: string): TicketActionDescriptor | null {
    if (typeof customId !== "string" || customId.length === 0 || customId.length > TICKET_CUSTOM_ID_MAX) {
        return null;
    }

    const parts = customId.split(":");
    const [prefix, action, first, second] = parts;

    // Étape « choix » : `tb_pick:<fieldId>` ou `tb_pick:<fieldId>:<yes|no>`.
    // ⚠️ Ici le segment 1 est l'**identifiant de champ** (il n'y a pas d'« action ») :
    // compter les segments évite d'accepter un `tb_pick:a:b:c` fantaisiste.
    if (prefix === TICKET_PICK_PREFIX) {
        if (parts.length > 3) return null;
        const fieldId = action;
        if (!fieldId || !FIELD_ID_PATTERN.test(fieldId)) return null;
        const value = first;
        if (value !== undefined && value !== "yes" && value !== "no") return null;
        return { kind: "pick", access: ACTION_ACCESS.pick, source: "tb_pick", fieldId, value };
    }

    if (prefix !== TICKET_PREFIX || !action) return null;

    const kind = action as TicketActionKind;
    if (!(kind in ACTION_ACCESS)) return null;

    const descriptor: TicketActionDescriptor = { kind, access: ACTION_ACCESS[kind], source: "tb" };

    // Nombre de segments attendu par action : tout segment surnuméraire est un refus.
    // (`pick` est traité plus haut : sa forme n'a pas d'« action ».)
    const expectedSegments: Partial<Record<TicketActionKind, number>> = {
        open: 4,
        modal_open: 4,
        select_open: 3,
        select_journey: 3,
        claim: 3,
        release: 3,
        note: 3,
        rename: 3,
        close: 3,
        reopen: 3,
        approve: 3,
        refuse: 3,
        csat: 4,
    };
    const expectedLength = expectedSegments[kind];
    if (expectedLength !== undefined && parts.length !== expectedLength) return null;

    switch (kind) {
        case "open":
        case "modal_open": {
            if (!first || !second) return null;
            descriptor.panelId = first;
            descriptor.journeyId = second;
            return descriptor;
        }
        case "select_open":
        case "select_journey": {
            if (!first) return null;
            descriptor.panelId = first;
            return descriptor;
        }
        case "csat": {
            if (!first || !second) return null;
            const rating = Number.parseInt(second, 10);
            if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
            descriptor.ticketId = first;
            descriptor.rating = rating;
            return descriptor;
        }
        case "claim":
        case "release":
        case "note":
        case "rename":
        case "close":
        case "reopen":
        case "approve":
        case "refuse": {
            if (!first) return null;
            descriptor.ticketId = first;
            return descriptor;
        }
        default:
            return null;
    }
}

/** Niveau d'accès à appliquer pour un `custom_id` donné (`null` = action inconnue). */
export function resolveTicketAccessLevel(customId: string): TicketAccessLevel | null {
    return parseTicketCustomId(customId)?.access ?? null;
}

/** Libellé FR d'une action (journal d'audit, inbox, messages d'erreur). */
export const TICKET_ACTION_LABELS: Record<TicketActionKind, string> = {
    open: "Ouverture d'un ticket",
    select_open: "Ouverture d'un ticket (menu)",
    select_journey: "Ouverture d'un ticket (menu des parcours)",
    modal_open: "Formulaire d'ouverture",
    pick: "Réponse à un choix",
    claim: "Prise en charge",
    release: "Remise en file",
    note: "Note interne",
    rename: "Renommage",
    close: "Clôture",
    reopen: "Réouverture",
    csat: "Avis de satisfaction",
    approve: "Acceptation de la demande",
    refuse: "Refus de la demande",
};

/** Le `custom_id` appartient-il au module ? (garde : toute la famille `tb*` passe ici) */
export function isTicketCustomId(customId: string): boolean {
    return customId.startsWith(`${TICKET_PREFIX}:`) || customId.startsWith(`${TICKET_PICK_PREFIX}:`);
}

