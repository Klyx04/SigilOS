/**
 * 🎫 Tickets v2 — **le tunnel d'ouverture** (pur, sans I/O) : ce qu'on demande au
 * membre, dans quel ordre, et quand le ticket peut réellement s'ouvrir.
 *
 * Contrainte Discord qui dicte tout le reste : une **modale** ne transporte que des
 * champs texte et **5 lignes au plus**, et une modale soumise ne peut pas en ouvrir une
 * autre. Le tunnel est donc une **machine à états** :
 *
 *   CHOICES ──(tous les choix répondus)──▶ modale page 1 ──« Continuer »──▶ page 2 …
 *                                                        └──(dernière page)──▶ ouverture
 *
 * L'état vit dans `TicketDraft` (`step` = `CHOICES` ou `TEXTS:<page>`, `answersJson` cles
 * par `id` de champ) : un membre qui ferme Discord au milieu d'un questionnaire de 20
 * questions **reprend où il en était**, et rien n'est inventé côté serveur — les réponses
 * sont revalidées par `evaluateAnswers` avant la création du ticket.
 *
 * Une question déjà répondue n'est **jamais** reposée : `nextTicketTunnelStep` saute les
 * pages complètes et rend `open` quand il n'y a plus rien à demander.
 */

import {
    DISCORD_ACTION_ROW,
    DISCORD_BUTTON,
    TICKET_NO_VALUE,
    TICKET_YES_VALUE,
    buildChoiceStep,
    buildTicketModalPage,
    splitTicketForm,
    type DiscordActionRow,
    type TicketFormDefinition,
    type TicketMultiSelectField,
    type TicketSelectField,
    type TicketYesNoField,
} from "./form-schema";

/** Valeurs persistées dans `TicketDraft.step` (pas de migration : la colonne est libre). */
export const TICKET_DRAFT_STEP_CHOICES = "CHOICES";
export const TICKET_DRAFT_STEP_TEXTS = "TEXTS";

/**
 * Durée de vie d'un brouillon d'ouverture : **30 minutes**. Un membre qui ferme Discord au
 * milieu d'un questionnaire de 20 questions reprend sa demande ; au-delà, le brouillon est
 * périmé (il repart d'un questionnaire propre plutôt que de rouvrir un ticket fantôme).
 */
export const TICKET_DRAFT_TTL_MS = 30 * 60 * 1000;

/** Expiration d'un brouillon créé maintenant (persistée dans `TicketDraft.expiresAt`). */
export function ticketDraftExpiresAt(now: Date = new Date()): Date {
    return new Date(now.getTime() + TICKET_DRAFT_TTL_MS);
}

/** Un brouillon périmé (ou sans date lisible) est traité comme **absent** : jamais « au cas où ». */
export function isTicketDraftExpired(
    expiresAt: Date | string | null | undefined,
    now: Date = new Date()
): boolean {
    if (!expiresAt) return true;
    const time = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(String(expiresAt));
    if (!Number.isFinite(time)) return true;
    return time <= now.getTime();
}

/** Réponses d'un brouillon **avant** normalisation (ce que contient `TicketDraft.answersJson`). */
export type TicketDraftAnswers = Record<string, unknown>;

/**
 * Ne garde que les réponses des champs de **ce** formulaire, normalisées en `string[]`.
 * Un brouillon ne peut donc pas grossir avec des clés inventées (ni survivre à un champ
 * supprimé du formulaire), et tout ce qui est relu est déjà au format du tunnel.
 */
export function pruneTicketTunnelAnswers(
    form: TicketFormDefinition,
    answers: TicketDraftAnswers | null | undefined
): Record<string, string[]> {
    const pruned: Record<string, string[]> = {};
    const source = answers ?? {};

    for (const field of form.fields) {
        const value = source[field.id];
        if (value === undefined || value === null) continue;
        const values = Array.isArray(value) ? value.map((item) => String(item)) : [String(value)];
        const cleaned = values.map((item) => item.trim()).filter((item) => item.length > 0);
        if (cleaned.length > 0) pruned[field.id] = cleaned;
    }

    return pruned;
}

export type TicketDraftStage = "CHOICES" | "TEXTS";
export type TicketDraftStep = { stage: TicketDraftStage; page: number };

/** `{ stage: "TEXTS", page: 2 }` → `"TEXTS:2"` (lisible en base, analysable sans ambiguïté). */
export function serializeTicketDraftStep(step: TicketDraftStep): string {
    if (step.stage !== "TEXTS") return TICKET_DRAFT_STEP_CHOICES;
    return `${TICKET_DRAFT_STEP_TEXTS}:${Math.max(0, Math.trunc(step.page))}`;
}

/** Analyse une valeur de `step` ; toute valeur inconnue retombe sur l'étape des choix. */
export function parseTicketDraftStep(raw: string | null | undefined): TicketDraftStep {
    const value = (raw ?? "").trim().toUpperCase();
    if (value === TICKET_DRAFT_STEP_TEXTS) return { stage: "TEXTS", page: 0 };
    if (!value.startsWith(`${TICKET_DRAFT_STEP_TEXTS}:`)) return { stage: "CHOICES", page: 0 };

    const page = Number.parseInt(value.slice(value.indexOf(":") + 1), 10);
    if (!Number.isInteger(page) || page < 0) return { stage: "CHOICES", page: 0 };
    return { stage: "TEXTS", page };
}

/** Réponses **normalisées** d'un brouillon (`yes` / `no` pour les Oui/Non, tableaux sinon). */
export type TicketTunnelAnswers = Record<string, string[]>;

export type TicketTunnelState = {
    /** Choix (Oui/Non, listes) encore sans réponse. */
    pendingChoiceIds: string[];
    /** Pages de modale (5 questions texte au plus) dans l'ordre du formulaire. */
    textPages: number;
    /** Première page de texte où il manque une réponse (`-1` = tout est répondu). */
    firstPendingTextPage: number;
    /** Tout est répondu : le ticket peut s'ouvrir. */
    allAnswered: boolean;
};

function isAnswered(answers: Record<string, unknown>, fieldId: string): boolean {
    const value = answers[fieldId];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim() !== "";
}

/**
 * Où en est ce brouillon ? (source unique : le tunnel et l'écran lisent la même chose.)
 */
export function ticketTunnelState(
    form: TicketFormDefinition,
    answers: Record<string, unknown> = {}
): TicketTunnelState {
    const { choices, textPages } = splitTicketForm(form);

    const pendingChoiceIds = choices.filter((field) => !isAnswered(answers, field.id)).map((field) => field.id);
    const firstPendingTextPage = textPages.findIndex((fields) =>
        fields.some((field) => !isAnswered(answers, field.id))
    );

    return {
        pendingChoiceIds,
        textPages: textPages.length,
        firstPendingTextPage,
        allAnswered: pendingChoiceIds.length === 0 && firstPendingTextPage === -1,
    };
}

/** Le champ visé par un `tb_pick` est-il bien un choix de **ce** formulaire ? */
export function findTicketChoiceField(
    form: TicketFormDefinition,
    fieldId: string
): TicketYesNoField | TicketSelectField | TicketMultiSelectField | null {
    const field = form.fields.find((candidate) => candidate.id === fieldId);
    if (!field) return null;
    if (field.kind === "yes_no" || field.kind === "select" || field.kind === "multi_select") return field;
    return null;
}

/**
 * Applique un choix `tb_pick` aux réponses du brouillon. **Tout est revalidé ici** :
 * un champ qui n'est pas un choix, une option inventée, un Oui/Non ambigu ou un
 * dépassement de `maxChoices` sont refusés — jamais enregistrés « au cas où ».
 */
export function applyTicketChoice(input: {
    form: TicketFormDefinition;
    answers?: Record<string, unknown>;
    fieldId: string;
    values?: unknown;
}): { ok: true; answers: Record<string, string[]> } | { ok: false; reason: string } {
    const field = findTicketChoiceField(input.form, input.fieldId);
    if (!field) return { ok: false, reason: "Cette question n'est pas un choix." };

    const raw = Array.isArray(input.values)
        ? input.values.map((value) => String(value))
        : input.values === undefined || input.values === null
          ? []
          : [String(input.values)];
    const values = raw.map((value) => value.trim()).filter((value) => value.length > 0);
    if (values.length === 0) return { ok: false, reason: "Aucune réponse reçue." };

    const answers = { ...(input.answers ?? {}) } as Record<string, string[]>;

    if (field.kind === "yes_no") {
        const value = values[0].toLowerCase();
        if (values.length !== 1 || (value !== TICKET_YES_VALUE && value !== TICKET_NO_VALUE)) {
            return { ok: false, reason: "Réponse Oui/Non invalide." };
        }
        answers[field.id] = [value];
        return { ok: true, answers };
    }

    const allowed = new Set(field.options.map((option) => option.value));
    const unknown = values.filter((value) => !allowed.has(value));
    if (unknown.length > 0) return { ok: false, reason: `Option inconnue : ${unknown.join(", ")}.` };

    if (field.kind === "select") {
        if (values.length !== 1) return { ok: false, reason: "Une seule option est attendue." };
        answers[field.id] = values;
        return { ok: true, answers };
    }

    if (values.length > field.maxChoices) {
        return { ok: false, reason: `Maximum ${field.maxChoices} option(s) pour « ${field.label} ».` };
    }
    answers[field.id] = values;
    return { ok: true, answers };
}

/** Action du bouton qui ouvre la modale **suivante** (`tb:modal_page:{journeyId}:{page}`). */
export const TICKET_MODAL_PAGE_ACTION = "modal_page";

export type TicketTunnelStep =
    | { kind: "choices"; rows: DiscordActionRow[]; fieldIds: string[]; remaining: number; step: string }
    | {
          kind: "modal";
          rows: DiscordActionRow[];
          fieldIds: string[];
          page: number;
          pageCount: number;
          isLast: boolean;
          step: string;
      }
    | { kind: "open"; step: string };

/**
 * La **prochaine** interaction à montrer au membre.
 *
 * L'ordre du formulaire est respecté (d'abord les choix, puis les pages de modale) et une
 * page **entièrement répondue n'est jamais reposée** : c'est ce qui permet de reprendre un
 * brouillon de 20 questions là où il s'est arrêté. Plus rien à demander ⇒ `open` :
 * l'appelant peut créer le ticket.
 */
export function nextTicketTunnelStep(input: {
    form: TicketFormDefinition;
    journeyId: string;
    answers?: Record<string, unknown>;
    /** Page précise demandée par un bouton « Continuer » (sinon on part de la première). */
    page?: number;
}): TicketTunnelStep {
    const answers = input.answers ?? {};
    const state = ticketTunnelState(input.form, answers);

    if (state.pendingChoiceIds.length > 0) {
        const step = buildChoiceStep(input.form, { journeyId: input.journeyId, answers });
        return {
            kind: "choices",
            rows: step.rows,
            fieldIds: step.fieldIds,
            remaining: step.remainingFieldIds.length,
            step: TICKET_DRAFT_STEP_CHOICES,
        };
    }

    const from = Number.isInteger(input.page) ? Math.max(0, Math.trunc(input.page as number)) : 0;
    for (let page = from; page < state.textPages; page += 1) {
        const compiled = buildTicketModalPage(input.form, page);
        if (compiled.fieldIds.every((fieldId) => isAnswered(answers, fieldId))) continue;
        return {
            kind: "modal",
            rows: compiled.rows,
            fieldIds: compiled.fieldIds,
            page: compiled.page,
            pageCount: compiled.pageCount,
            isLast: compiled.isLast,
            step: serializeTicketDraftStep({ stage: "TEXTS", page: compiled.page }),
        };
    }

    return {
        kind: "open",
        step: serializeTicketDraftStep({ stage: "TEXTS", page: Math.max(0, state.textPages - 1) }),
    };
}

/**
 * Bouton « Continuer » d'une page de modale : une soumission de modale ne peut pas en
 * ouvrir une autre, c'est donc un **clic de bouton** qui rouvre la modale suivante.
 */
export function buildTicketModalContinueRows(input: {
    journeyId: string;
    page: number;
    pageCount: number;
    fieldCount: number;
}): DiscordActionRow[] {
    const label = `📝 Continuer — ${input.fieldCount} question(s) (page ${input.page + 1}/${input.pageCount})`;
    return [
        {
            type: DISCORD_ACTION_ROW,
            components: [
                {
                    type: DISCORD_BUTTON,
                    style: 1,
                    label: label.slice(0, 80),
                    custom_id: `tb:${TICKET_MODAL_PAGE_ACTION}:${input.journeyId}:${input.page}`,
                },
            ],
        },
    ];
}
