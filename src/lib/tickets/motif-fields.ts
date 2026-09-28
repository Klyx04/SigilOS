/**
 * 🎫 Tickets — **constructeur de questionnaire du motif** (pur : aucun I/O).
 *
 * Le motif porte 4 natures de questions (vulgarisé, FR) :
 *   · Texte court (pseudo, lien, nombre) ;
 *   · Texte long (description, motivation) ;
 *   · Oui / Non (vrai refus possible + politique si « Non ») ;
 *   · Choix unique (liste fermée).
 * Maximum 20 questions (`TICKET_FORM_MAX_FIELDS`) : Discord les pose 5 par 5
 * avec un bouton « Continuer » (tunnel existant, rien à réinventer).
 *
 * Ce module fait le lien entre l'éditeur (lignes modifiables avec `key`
 * stable côté client) et le contrat v2 (`TicketFormDefinition`, validé par
 * `parseTicketForm` avant toute écriture).
 */

import {
    TICKET_FORM_MAX_FIELDS,
    TICKET_FORM_SCHEMA_VERSION,
    TICKET_ON_NO_POLICIES,
    parseTicketForm,
    type TicketField,
    type TicketFormDefinition,
    type TicketOnNoPolicy,
} from "./form-schema";

/** Les 4 natures proposées dans l'éditeur (les 2 autres du moteur restent serveur). */
export const MOTIF_QUESTION_KINDS = ["text_short", "text_long", "yes_no", "select"] as const;
export type MotifQuestionKind = (typeof MOTIF_QUESTION_KINDS)[number];

export const MOTIF_QUESTION_KIND_LABELS: Record<MotifQuestionKind, string> = {
    text_short: "Texte court",
    text_long: "Texte long",
    yes_no: "Oui / Non",
    select: "Choix unique",
};

export const MOTIF_ON_NO_LABELS: Record<TicketOnNoPolicy, string> = {
    continue: "Continuer normalement",
    warn: "Avertir puis continuer",
    block: "Bloquer l'envoi",
    manual_review: "Envoyer en revue manuelle",
};

export type MotifQuestionOption = { value: string; label: string };

/** Ligne éditable du constructeur (`key` = stabilité React, jamais persistée). */
export type MotifQuestion = {
    key: string;
    kind: MotifQuestionKind;
    label: string;
    help: string;
    required: boolean;
    placeholder: string;
    minLength: number;
    maxLength: number;
    yesLabel: string;
    noLabel: string;
    onNo: TicketOnNoPolicy;
    onNoMessage: string;
    options: MotifQuestionOption[];
};

let motifQuestionCounter = 0;

/** Question neuve avec des défauts sains (obligatoire par défaut, comme TicketTool). */
export function newMotifQuestion(kind: MotifQuestionKind, index: number): MotifQuestion {
    motifQuestionCounter += 1;
    return {
        key: `n${Date.now().toString(36)}${motifQuestionCounter}`,
        kind,
        label: `Question ${index + 1}`,
        help: "",
        required: true,
        placeholder: "",
        minLength: 0,
        maxLength: kind === "text_long" ? 4000 : 256,
        yesLabel: "Oui",
        noLabel: "Non",
        onNo: "continue",
        onNoMessage: "",
        options:
            kind === "select"
                ? [
                      { value: "choix-1", label: "Choix 1" },
                      { value: "choix-2", label: "Choix 2" },
                  ]
                : [],
    };
}

/** `id` de champ stable : `q1`, `q2`… (position dans le formulaire). */
export function motifFieldId(index: number): string {
    return `q${index + 1}`;
}

function cleanOptions(options: MotifQuestionOption[]): MotifQuestionOption[] {
    const seen = new Set<string>();
    const clean: MotifQuestionOption[] = [];
    for (const option of options) {
        const label = option.label.trim().slice(0, 100);
        if (!label) continue;
        const value =
            option.value.trim().slice(0, 100) ||
            label
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 100) ||
            `choix-${clean.length + 1}`;
        if (seen.has(value)) continue;
        seen.add(value);
        clean.push({ value, label });
    }
    return clean;
}

/**
 * Lignes de l'éditeur → contrat v2. Les erreurs sont FR et montrent la question
 * fautive (`Question 3 : …`). 20 questions au plus (`TICKET_FORM_MAX_FIELDS`).
 */
export function motifQuestionsToDefinition(
    questions: MotifQuestion[]
): { ok: true; form: TicketFormDefinition } | { ok: false; errors: string[] } {
    if (questions.length > TICKET_FORM_MAX_FIELDS) {
        return { ok: false, errors: [`Maximum ${TICKET_FORM_MAX_FIELDS} questions (Discord les pose 5 par 5).`] };
    }

    const fields: TicketField[] = questions.map((question, index) => {
        const id = motifFieldId(index);
        const label = question.label.trim().slice(0, 120) || `Question ${index + 1}`;
        const help = question.help.trim().slice(0, 200) || undefined;
        const base = { id, label, help };
        switch (question.kind) {
            case "text_long":
                return {
                    ...base,
                    kind: "text_long" as const,
                    required: question.required,
                    placeholder: question.placeholder.trim().slice(0, 100) || undefined,
                    minLength: Math.max(0, Math.min(4000, Math.trunc(question.minLength) || 0)),
                    maxLength: Math.max(1, Math.min(4000, Math.trunc(question.maxLength) || 4000)),
                };
            case "yes_no":
                return {
                    ...base,
                    kind: "yes_no" as const,
                    required: question.required,
                    yesLabel: question.yesLabel.trim().slice(0, 80) || "Oui",
                    noLabel: question.noLabel.trim().slice(0, 80) || "Non",
                    onNo: TICKET_ON_NO_POLICIES.includes(question.onNo) ? question.onNo : "continue",
                    onNoMessage: question.onNoMessage.trim().slice(0, 400) || undefined,
                };
            case "select":
                return {
                    ...base,
                    kind: "select" as const,
                    required: question.required,
                    options: cleanOptions(question.options),
                };
            case "text_short":
            default:
                return {
                    ...base,
                    kind: "text_short" as const,
                    required: question.required,
                    placeholder: question.placeholder.trim().slice(0, 100) || undefined,
                    minLength: Math.max(0, Math.min(256, Math.trunc(question.minLength) || 0)),
                    maxLength: Math.max(1, Math.min(256, Math.trunc(question.maxLength) || 256)),
                };
        }
    });

    const parsed = parseTicketForm({ schemaVersion: TICKET_FORM_SCHEMA_VERSION, fields });
    if (!parsed.ok) {
        return { ok: false, errors: parsed.errors.slice(0, 5) };
    }
    return { ok: true, form: parsed.form };
}

/** Contrat v2 → lignes de l'éditeur (reprise d'un questionnaire existant). */
export function definitionToMotifQuestions(form: TicketFormDefinition): MotifQuestion[] {
    motifQuestionCounter += form.fields.length;
    return form.fields
        .filter(
            (field): field is Extract<TicketField, { kind: MotifQuestionKind }> =>
                field.kind === "text_short" ||
                field.kind === "text_long" ||
                field.kind === "yes_no" ||
                field.kind === "select"
        )
        .map((field, index) => {
            const base: MotifQuestion = {
                key: `q${index + 1}-${motifQuestionCounter}`,
                kind: field.kind,
                label: field.label,
                help: field.help ?? "",
                required: field.required ?? false,
                placeholder: "",
                minLength: 0,
                maxLength: 256,
                yesLabel: "Oui",
                noLabel: "Non",
                onNo: "continue",
                onNoMessage: "",
                options: [],
            };
            if (field.kind === "text_short" || field.kind === "text_long") {
                base.placeholder = field.placeholder ?? "";
                base.minLength = field.minLength;
                base.maxLength = field.maxLength;
            } else if (field.kind === "yes_no") {
                base.yesLabel = field.yesLabel;
                base.noLabel = field.noLabel;
                base.onNo = field.onNo;
                base.onNoMessage = field.onNoMessage ?? "";
            } else if (field.kind === "select") {
                base.options = field.options.map((option) => ({ ...option }));
            }
            return base;
        });
}

/**
 * Ancien format v1 (`TicketBotCategory.formSchemaJson`, `{label, type: SHORT|PARAGRAPH}`)
 * → lignes de l'éditeur. Utilisé par la migration « tout passer en Motifs ».
 */
export function convertLegacyCategoryQuestions(raw: unknown): MotifQuestion[] {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, TICKET_FORM_MAX_FIELDS).map((entry, index) => {
        const item = (entry ?? {}) as Record<string, unknown>;
        const long = String(item.type ?? "SHORT").toUpperCase() === "PARAGRAPH";
        const question = newMotifQuestion(long ? "text_long" : "text_short", index);
        question.label = String(item.label ?? `Question ${index + 1}`).slice(0, 120);
        question.required = item.required !== false;
        return question;
    });
}
