/**
 * 🎫 Tickets v2 — **contrat de formulaire** (pur : aucun I/O, aucun import serveur).
 *
 * Règle de conception (§5 du blueprint) : les réponses sont **clés par `id` de champ**,
 * jamais par libellé — renommer une question ne casse donc plus la relecture d'un
 * ticket passé. Le contrat est **versionné** (`schemaVersion`) et figé dans
 * `TicketFormVersion` au moment de la publication : un ticket garde la version avec
 * laquelle il a été rempli (`TicketRecord.formVersionId`).
 *
 * Deux natures de champs, deux moments de collecte (contrainte Discord réelle) :
 *   · **choix** (`yes_no`, `select`, `multi_select`) → étape « message éphémère »
 *     AVANT la modale, parce qu'une modale Discord ne transporte que des champs texte ;
 *   · **textes** (`text_short`, `text_long`) → modale, **5 lignes maximum** ⇒ les
 *     questions texte sont **paginées** (20 questions = 4 modales au plus), chaînées par
 *     un bouton « Continuer » : une modale soumise ne peut pas en ouvrir une autre ;
 *   · `info` ne consomme aucune réponse : il explique.
 *
 * ⚠️ Une case cochée ne vaut pas un « Non » : `yes_no` produit un booléen **et** le
 * libellé affiché, et une politique explicite (`onNo`) est revalidée côté serveur.
 */

import { z } from "zod";

/** Version du contrat persisté (`TicketForm.draftSchemaJson`, `TicketFormVersion.schemaJson`). */
export const TICKET_FORM_SCHEMA_VERSION = 2 as const;

/** Types de champ du moteur v2. */
export const TICKET_FIELD_KINDS = [
    "text_short",
    "text_long",
    "yes_no",
    "select",
    "multi_select",
    "info",
] as const;
export type TicketFieldKind = (typeof TICKET_FIELD_KINDS)[number];

/** Natures de collecte déduites du type de champ. */
export const TICKET_CHOICE_KINDS: readonly TicketFieldKind[] = ["yes_no", "select", "multi_select"];
export const TICKET_TEXT_KINDS: readonly TicketFieldKind[] = ["text_short", "text_long"];

/**
 * Limites **Discord**, appliquées à la compilation (on ne promet jamais plus que ce
 * que le client accepte) : 5 lignes par modale, 45 caractères de libellé, 100 de
 * placeholder, 256 pour un champ court, 4 000 pour un paragraphe, 25 options.
 */
export const TICKET_MODAL_LIMITS = {
    maxRows: 5,
    labelMax: 45,
    placeholderMax: 100,
    shortMax: 256,
    longMax: 4000,
    optionsMax: 25,
} as const;

/** Bornes d'édition du dashboard (au-delà, l'expérience se dégrade). */
export const TICKET_FORM_MAX_FIELDS = 20;
/**
 * Les 20 questions ne tiennent **pas** dans une modale (Discord en accepte 5 lignes) :
 * les questions texte sont donc paginées en **4 modales au plus**. C'est la raison
 * d'être de `buildTicketModalPage` — et la raison du bouton « Continuer » du tunnel.
 */
export const TICKET_MODAL_PAGES_MAX = Math.ceil(TICKET_FORM_MAX_FIELDS / TICKET_MODAL_LIMITS.maxRows);
export const TICKET_FIELD_LABEL_MAX = 120;
export const TICKET_FIELD_HELP_MAX = 200;

/** Politique appliquée quand la réponse honnête est « Non ». */
export const TICKET_ON_NO_POLICIES = ["continue", "warn", "block", "manual_review"] as const;
export type TicketOnNoPolicy = (typeof TICKET_ON_NO_POLICIES)[number];

export const TICKET_ON_NO_LABELS: Record<TicketOnNoPolicy, string> = {
    continue: "Continuer normalement",
    warn: "Avertir le demandeur, puis continuer",
    block: "Bloquer l'envoi",
    manual_review: "Envoyer en revue manuelle",
};

export const TICKET_FIELD_KIND_LABELS: Record<TicketFieldKind, string> = {
    text_short: "Réponse courte",
    text_long: "Paragraphe",
    yes_no: "Oui / Non",
    select: "Choix unique",
    multi_select: "Choix multiple",
    info: "Information (aucune réponse)",
};

export const TICKET_FIELD_KIND_HELP: Record<TicketFieldKind, string> = {
    text_short: "Une ligne : pseudo, lien, nombre…",
    text_long: "Plusieurs lignes : description, motivation…",
    yes_no: "Deux réponses exclusives — le demandeur peut vraiment refuser.",
    select: "Une seule option dans une liste fermée.",
    multi_select: "Plusieurs options dans une liste fermée.",
    info: "Un texte affiché au demandeur, sans réponse à saisir.",
};

// ---------------------------------------------------------------------------
// Contrat zod — valide l'entrée du dashboard ET les données déjà persistées
// ---------------------------------------------------------------------------

/** `id` de champ : stable, technique, jamais dérivé du libellé. */
const fieldIdSchema = z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,63}$/, "Identifiant technique invalide (a-z, 0-9, _ ; 64 caractères max)");

const optionSchema = z.object({
    value: z.string().min(1).max(100),
    label: z.string().min(1).max(100),
    emoji: z.string().max(32).optional(),
});

const commonField = {
    id: fieldIdSchema,
    label: z.string().min(1, "Libellé requis").max(TICKET_FIELD_LABEL_MAX),
    help: z.string().max(TICKET_FIELD_HELP_MAX).optional(),
};

export const ticketTextFieldSchema = z.object({
    ...commonField,
    kind: z.literal("text_short"),
    required: z.boolean().default(false),
    placeholder: z.string().max(TICKET_MODAL_LIMITS.placeholderMax).optional(),
    minLength: z.number().int().min(0).max(TICKET_MODAL_LIMITS.shortMax).default(0),
    maxLength: z.number().int().min(1).max(TICKET_MODAL_LIMITS.shortMax).default(TICKET_MODAL_LIMITS.shortMax),
});

export const ticketParagraphFieldSchema = z.object({
    ...commonField,
    kind: z.literal("text_long"),
    required: z.boolean().default(false),
    placeholder: z.string().max(TICKET_MODAL_LIMITS.placeholderMax).optional(),
    minLength: z.number().int().min(0).max(TICKET_MODAL_LIMITS.longMax).default(0),
    maxLength: z.number().int().min(1).max(TICKET_MODAL_LIMITS.longMax).default(TICKET_MODAL_LIMITS.longMax),
});

/**
 * Oui / Non — **les deux valeurs sont enregistrées** (`true`/`false`) avec le libellé
 * affiché. `required` porte sur la réponse, jamais sur le « oui » : refuser est une
 * réponse légitime, et `onNo` décide de ce qui s'ensuit.
 */
export const ticketYesNoFieldSchema = z.object({
    ...commonField,
    kind: z.literal("yes_no"),
    required: z.boolean().default(true),
    yesLabel: z.string().min(1).max(80).default("Oui"),
    noLabel: z.string().min(1).max(80).default("Non"),
    onNo: z.enum(TICKET_ON_NO_POLICIES).default("continue"),
    onNoMessage: z.string().max(400).optional(),
});

export const ticketSelectFieldSchema = z.object({
    ...commonField,
    kind: z.literal("select"),
    required: z.boolean().default(true),
    options: z
        .array(optionSchema)
        .min(1, "Au moins une option")
        .max(TICKET_MODAL_LIMITS.optionsMax, `Maximum ${TICKET_MODAL_LIMITS.optionsMax} options`),
});

export const ticketMultiSelectFieldSchema = z.object({
    ...commonField,
    kind: z.literal("multi_select"),
    required: z.boolean().default(true),
    options: z
        .array(optionSchema)
        .min(1, "Au moins une option")
        .max(TICKET_MODAL_LIMITS.optionsMax, `Maximum ${TICKET_MODAL_LIMITS.optionsMax} options`),
    maxChoices: z.number().int().min(1).max(TICKET_MODAL_LIMITS.optionsMax).default(1),
});

export const ticketInfoFieldSchema = z.object({
    id: fieldIdSchema,
    kind: z.literal("info"),
    label: z.string().min(1).max(TICKET_FIELD_LABEL_MAX),
    body: z.string().max(1000).default(""),
});

export const ticketFieldSchema = z.discriminatedUnion("kind", [
    ticketTextFieldSchema,
    ticketParagraphFieldSchema,
    ticketYesNoFieldSchema,
    ticketSelectFieldSchema,
    ticketMultiSelectFieldSchema,
    ticketInfoFieldSchema,
]);

export type TicketField = z.infer<typeof ticketFieldSchema>;
export type TicketTextField = z.infer<typeof ticketTextFieldSchema>;
export type TicketParagraphField = z.infer<typeof ticketParagraphFieldSchema>;
export type TicketYesNoField = z.infer<typeof ticketYesNoFieldSchema>;
export type TicketSelectField = z.infer<typeof ticketSelectFieldSchema>;
export type TicketMultiSelectField = z.infer<typeof ticketMultiSelectFieldSchema>;
export type TicketInfoField = z.infer<typeof ticketInfoFieldSchema>;
export type TicketSelectOption = z.infer<typeof optionSchema>;

/** Formulaire complet : version de contrat + champs ordonnés, `id` et valeurs uniques. */
export const ticketFormDefinitionSchema = z
    .object({
        schemaVersion: z.literal(TICKET_FORM_SCHEMA_VERSION),
        fields: z.array(ticketFieldSchema).max(TICKET_FORM_MAX_FIELDS),
    })
    .superRefine((form, ctx) => {
        const seenIds = new Set<string>();
        for (const field of form.fields) {
            if (seenIds.has(field.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Identifiant de champ dupliqué : ${field.id}`,
                });
            }
            seenIds.add(field.id);

            // Contrôles croisés (placés ici : `discriminatedUnion` n'accepte que des `ZodObject`,
            // un `.refine()` sur chaque champ en ferait des `ZodEffects` invalides).
            if (
                (field.kind === "text_short" || field.kind === "text_long") &&
                field.minLength > field.maxLength
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `« ${field.label} » : longueur minimale supérieure à la longueur maximale`,
                });
            }
            if (field.kind === "multi_select" && field.maxChoices > field.options.length) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `« ${field.label} » : maximum de choix supérieur au nombre d'options`,
                });
            }

            if (field.kind === "select" || field.kind === "multi_select") {
                const seenValues = new Set<string>();
                for (const option of field.options) {
                    if (seenValues.has(option.value)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: `Valeur d'option dupliquée dans « ${field.label} » : ${option.value}`,
                        });
                    }
                    seenValues.add(option.value);
                }
            }
        }
    });

export type TicketFormDefinition = z.infer<typeof ticketFormDefinitionSchema>;

// ---------------------------------------------------------------------------
// Composants Discord (JSON brut : le moteur n'importe pas discord.js)
// ---------------------------------------------------------------------------

export const DISCORD_ACTION_ROW = 1 as const;
export const DISCORD_BUTTON = 2 as const;
export const DISCORD_STRING_SELECT = 3 as const;
export const DISCORD_TEXT_INPUT = 4 as const;

export type DiscordComponent = Record<string, unknown>;
export type DiscordActionRow = { type: 1; components: DiscordComponent[] };

/** Valeurs de bouton Oui / Non : les deux sont stockées telles quelles. */
export const TICKET_YES_VALUE = "yes" as const;
export const TICKET_NO_VALUE = "no" as const;

/** `custom_id` d'un champ : `tf_<id>` (jamais le libellé, qui peut changer). */
export const TICKET_FIELD_CUSTOM_ID_PREFIX = "tf_";
export function fieldCustomId(field: { id: string }): string {
    return `${TICKET_FIELD_CUSTOM_ID_PREFIX}${field.id}`;
}
export function fieldIdFromCustomId(customId: string): string | null {
    if (!customId.startsWith(TICKET_FIELD_CUSTOM_ID_PREFIX)) return null;
    const id = customId.slice(TICKET_FIELD_CUSTOM_ID_PREFIX.length);
    return /^[a-z][a-z0-9_]{0,63}$/.test(id) ? id : null;
}

// ---------------------------------------------------------------------------
// Lecture du contrat
// ---------------------------------------------------------------------------

export type TicketFormParseResult = { ok: true; form: TicketFormDefinition } | { ok: false; errors: string[] };

/** Issues zod → messages FR lisibles (jamais un code technique nu à l'écran). */
function issueMessages(error: z.ZodError): string[] {
    return error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path} : ${issue.message}` : issue.message;
    });
}

/** Valide un formulaire (brouillon édité au dashboard **ou** version publiée relue). */
export function parseTicketForm(input: unknown): TicketFormParseResult {
    const parsed = ticketFormDefinitionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: issueMessages(parsed.error) };
    return { ok: true, form: parsed.data };
}

/** Formulaire vide : un parcours sans question reste utilisable (ouverture directe). */
export function createEmptyTicketForm(): TicketFormDefinition {
    return { schemaVersion: TICKET_FORM_SCHEMA_VERSION, fields: [] };
}

/** Lit un JSON persisté **sans jamais jeter** (un ancien schéma devient un formulaire vide). */
export function readTicketForm(raw: unknown): TicketFormDefinition {
    const parsed = parseTicketForm(raw);
    return parsed.ok ? parsed.form : createEmptyTicketForm();
}

/** Découpe une liste en pages (aucun élément perdu, page vide ⇒ aucune page). */
function chunk<T>(items: T[], size: number): T[][] {
    if (size <= 0) return items.length > 0 ? [items] : [];
    const pages: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        pages.push(items.slice(index, index + size));
    }
    return pages;
}

/** Découpe le formulaire selon le moment de collecte (l'ordre du formulaire est respecté). */
export function splitTicketForm(form: TicketFormDefinition): {
    infos: TicketInfoField[];
    choices: (TicketYesNoField | TicketSelectField | TicketMultiSelectField)[];
    texts: (TicketTextField | TicketParagraphField)[];
    /** Questions texte réparties en modales de 5 lignes (c'est ce qui permet 20 questions). */
    textPages: (TicketTextField | TicketParagraphField)[][];
    modalPages: number;
    modalRows: number;
    modalOverflow: number;
    choiceRows: number;
} {
    const infos: TicketInfoField[] = [];
    const choices: (TicketYesNoField | TicketSelectField | TicketMultiSelectField)[] = [];
    const texts: (TicketTextField | TicketParagraphField)[] = [];

    for (const field of form.fields) {
        if (field.kind === "info") infos.push(field);
        else if (field.kind === "text_short" || field.kind === "text_long") texts.push(field);
        else choices.push(field);
    }

    const textPages = chunk(texts, TICKET_MODAL_LIMITS.maxRows);

    return {
        infos,
        choices,
        texts,
        textPages,
        modalPages: textPages.length,
        modalRows: Math.min(texts.length, TICKET_MODAL_LIMITS.maxRows),
        modalOverflow: Math.max(0, texts.length - TICKET_MODAL_LIMITS.maxRows),
        choiceRows: choices.length,
    };
}

/** Une ligne de modale = une question texte (libellé, aide, bornes, obligatoire). */
function buildModalRow(field: TicketTextField | TicketParagraphField): DiscordActionRow {
    return {
        type: DISCORD_ACTION_ROW,
        components: [
            {
                type: DISCORD_TEXT_INPUT,
                custom_id: fieldCustomId(field),
                label: field.label.slice(0, TICKET_MODAL_LIMITS.labelMax),
                style: field.kind === "text_long" ? 2 : 1,
                placeholder: field.placeholder
                    ? field.placeholder.slice(0, TICKET_MODAL_LIMITS.placeholderMax)
                    : undefined,
                required: field.required !== false,
                min_length: field.minLength > 0 ? field.minLength : undefined,
                max_length: field.maxLength,
            },
        ],
    };
}

/**
 * **Une page** de modale : 5 questions texte au plus (ce qui permet d'en poser 20).
 * `isLast` dit quand toutes les réponses texte sont réunies ; `fieldIds` permet de
 * prouver qu'aucune question n'a été perdue en route.
 */
export function buildTicketModalPage(
    form: TicketFormDefinition,
    page = 0
): { rows: DiscordActionRow[]; fieldIds: string[]; page: number; pageCount: number; isLast: boolean } {
    const { textPages } = splitTicketForm(form);
    const pageCount = textPages.length;
    const index = pageCount === 0 ? 0 : Math.min(Math.max(0, Math.trunc(page)), pageCount - 1);
    const fields = textPages[index] ?? [];

    return {
        rows: fields.map(buildModalRow),
        fieldIds: fields.map((field) => field.id),
        page: index,
        pageCount,
        isLast: pageCount === 0 || index === pageCount - 1,
    };
}

/** **Première** page de modale (raccourci : la page 1 des questions texte). */
export function buildTicketModalRows(form: TicketFormDefinition): DiscordActionRow[] {
    return buildTicketModalPage(form, 0).rows;
}

/**
 * Étape « choix » (message éphémère **avant** la modale) : Oui/Non en boutons,
 * sélections en menu. 5 lignes au plus par message — `remainingFieldIds` dit
 * combien de choix restent à demander (jamais de réponse perdue en silence).
 *
 * ⚠️ Le `custom_id` porte le **parcours** (`tb_pick:<journeyId>:<fieldId>`) : c'est lui
 * qui permet de retrouver le brouillon du membre au clic, sans jamais faire confiance à
 * un identifiant venu du client.
 */
export function buildChoiceStep(
    form: TicketFormDefinition,
    options: { journeyId: string; answers?: Record<string, unknown> }
): { rows: DiscordActionRow[]; fieldIds: string[]; remainingFieldIds: string[] } {
    const journeyId = options.journeyId;
    const answers = options.answers ?? {};
    const { choices } = splitTicketForm(form);
    const pending = choices.filter((field) => answers[field.id] === undefined || answers[field.id] === null);
    const covered = pending.slice(0, TICKET_MODAL_LIMITS.maxRows);
    const rest = pending.slice(TICKET_MODAL_LIMITS.maxRows);

    const rows: DiscordActionRow[] = covered.map((field) => {
        if (field.kind === "yes_no") {
            return {
                type: DISCORD_ACTION_ROW,
                components: [
                    {
                        type: DISCORD_BUTTON,
                        style: 3,
                        label: field.yesLabel.slice(0, 80),
                        custom_id: `tb_pick:${journeyId}:${field.id}:${TICKET_YES_VALUE}`,
                    },
                    {
                        type: DISCORD_BUTTON,
                        style: 4,
                        label: field.noLabel.slice(0, 80),
                        custom_id: `tb_pick:${journeyId}:${field.id}:${TICKET_NO_VALUE}`,
                    },
                ],
            };
        }

        const isMulti = field.kind === "multi_select";
        return {
            type: DISCORD_ACTION_ROW,
            components: [
                {
                    type: DISCORD_STRING_SELECT,
                    custom_id: `tb_pick:${journeyId}:${field.id}`,
                    placeholder: field.label.slice(0, TICKET_MODAL_LIMITS.placeholderMax),
                    min_values: isMulti ? (field.required ? 1 : 0) : 1,
                    max_values: isMulti ? field.maxChoices : 1,
                    options: field.options.slice(0, TICKET_MODAL_LIMITS.optionsMax).map((option) => ({
                        label: option.label.slice(0, 100),
                        value: option.value,
                        emoji: option.emoji ? { name: option.emoji } : undefined,
                    })),
                },
            ],
        };
    });

    return {
        rows,
        fieldIds: covered.map((field) => field.id),
        remainingFieldIds: rest.map((field) => field.id),
    };
}

/**
 * Réponses d'une soumission de modale : **clés = `id` de champ**.
 * Toute clé inconnue est **rejetée** (jamais devinée) et signalée à l'appelant.
 */
export function answersFromModalSubmit(
    form: TicketFormDefinition,
    submitted: Array<{ customId: string; value: string }>
): { answers: Record<string, string>; rejected: string[] } {
    const allowed = new Set(form.fields.map((field) => field.id));
    const answers: Record<string, string> = {};
    const rejected: string[] = [];

    for (const entry of submitted) {
        const id = fieldIdFromCustomId(entry.customId);
        if (!id || !allowed.has(id)) {
            rejected.push(entry.customId);
            continue;
        }
        answers[id] = (entry.value ?? "").trim();
    }

    return { answers, rejected };
}

// ---------------------------------------------------------------------------
// Validation métier des réponses : types, bornes, politique « Non »
// ---------------------------------------------------------------------------

export type TicketAnswersDecision =
    | { kind: "ok" }
    | { kind: "warn"; message: string }
    | { kind: "manual_review"; message: string }
    | { kind: "blocked"; message: string };

export type TicketAnswersVerdict = {
    /** `true` = réponses valides **et** ouverture autorisée. */
    ok: boolean;
    /** Réponses invalides (type, borne, option inconnue) — messages FR. */
    errors: string[];
    /** `id` des champs obligatoires restés sans réponse. */
    missing: string[];
    /** Politique `onNo` agrégée (priorité : bloqué > revue > avertissement). */
    decision: TicketAnswersDecision;
    /** Valeurs normalisées : `["yes"]` / `["no"]` pour Oui/Non, tableau sinon. */
    answers: Record<string, string[]>;
    /** Champs Oui/Non répondus « Non » (revue manuelle, statistiques, règle métier). */
    negativeFieldIds: string[];
};

function asStringArray(value: unknown): string[] | null {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    if (typeof value === "string") return value.length > 0 ? [value] : [];
    if (typeof value === "boolean") return [value ? TICKET_YES_VALUE : TICKET_NO_VALUE];
    return null;
}

function isAffirmative(value: string): boolean {
    return value === TICKET_YES_VALUE || value === "oui" || value === "true";
}
function isNegative(value: string): boolean {
    return value === TICKET_NO_VALUE || value === "non" || value === "false";
}

/**
 * Valide les réponses **côté serveur** (jamais depuis le client) et applique la
 * politique « Non » : une réponse négative honnête n'est pas une erreur de saisie.
 * Au moindre doute on refuse (`ok: false`) — jamais d'ouverture accordée par défaut.
 */
export function evaluateAnswers(form: TicketFormDefinition, raw: Record<string, unknown>): TicketAnswersVerdict {
    const errors: string[] = [];
    const missing: string[] = [];
    const answers: Record<string, string[]> = {};
    const negativeFieldIds: string[] = [];

    let blocked: string | null = null;
    let manualReview: string | null = null;
    let warning: string | null = null;

    for (const field of form.fields) {
        if (field.kind === "info") continue;

        const value = asStringArray(raw[field.id]);
        const empty = value === null || value.length === 0 || value.every((item) => item.trim() === "");

        if (empty) {
            if (field.required) missing.push(field.id);
            continue;
        }

        switch (field.kind) {
            case "text_short":
            case "text_long": {
                const text = value[0];
                let valid = true;
                if (text.length < field.minLength) {
                    errors.push(`« ${field.label} » : ${field.minLength} caractères minimum`);
                    valid = false;
                }
                if (text.length > field.maxLength) {
                    errors.push(`« ${field.label} » : ${field.maxLength} caractères maximum`);
                    valid = false;
                }
                // Une réponse invalide n'est **jamais** enregistrée : le ticket ne sera
                // pas créé, et rien de faux ne doit subsister dans les réponses.
                if (valid) answers[field.id] = [text];
                break;
            }
            case "yes_no": {
                const first = value[0];
                if (!isAffirmative(first) && !isNegative(first)) {
                    errors.push(`« ${field.label} » : réponse Oui / Non attendue`);
                    break;
                }
                const negative = isNegative(first);
                answers[field.id] = [negative ? TICKET_NO_VALUE : TICKET_YES_VALUE];
                if (negative) {
                    negativeFieldIds.push(field.id);
                    if (field.onNo === "block") {
                        blocked ??=
                            field.onNoMessage ||
                            `« ${field.label} » : la réponse « ${field.noLabel} » empêche l'ouverture.`;
                    } else if (field.onNo === "manual_review") {
                        manualReview ??=
                            field.onNoMessage ||
                            `« ${field.label} » : répondue « ${field.noLabel} », l'équipe va examiner la demande.`;
                    } else if (field.onNo === "warn") {
                        warning ??= field.onNoMessage || `« ${field.label} » : répondue « ${field.noLabel} ».`;
                    }
                }
                break;
            }
            case "select": {
                const chosen = value[0];
                const allowed = field.options.map((option) => option.value);
                if (!allowed.includes(chosen)) {
                    errors.push(`« ${field.label} » : option inconnue`);
                    break;
                }
                answers[field.id] = [chosen];
                break;
            }
            case "multi_select": {
                const allowed = field.options.map((option) => option.value);
                if (value.some((item) => !allowed.includes(item))) {
                    errors.push(`« ${field.label} » : option(s) inconnue(s)`);
                    break;
                }
                if (value.length > field.maxChoices) {
                    errors.push(`« ${field.label} » : ${field.maxChoices} choix maximum`);
                    break;
                }
                answers[field.id] = value;
                break;
            }
        }
    }

    const decision: TicketAnswersDecision = blocked
        ? { kind: "blocked", message: blocked }
        : manualReview
          ? { kind: "manual_review", message: manualReview }
          : warning
            ? { kind: "warn", message: warning }
            : { kind: "ok" };

    return {
        ok: errors.length === 0 && missing.length === 0 && decision.kind !== "blocked",
        errors,
        missing,
        decision,
        answers,
        negativeFieldIds,
    };
}

/** Paires libellé/valeur **dans l'ordre du formulaire** (embed d'accueil, inbox, transcript). */
export function formatAnswersForDisplay(
    form: TicketFormDefinition,
    answers: Record<string, unknown>
): Array<{ label: string; value: string }> {
    const rows: Array<{ label: string; value: string }> = [];

    for (const field of form.fields) {
        if (field.kind === "info") continue;
        const value = asStringArray(answers[field.id]);
        if (value === null || value.length === 0) continue;

        let display: string;
        if (field.kind === "yes_no") {
            display = isAffirmative(value[0]) ? field.yesLabel : field.noLabel;
        } else if (field.kind === "select" || field.kind === "multi_select") {
            display = value
                .map((item) => field.options.find((option) => option.value === item)?.label || item)
                .join(", ");
        } else {
            display = value.join(", ");
        }

        rows.push({ label: field.label, value: display });
    }

    return rows;
}






