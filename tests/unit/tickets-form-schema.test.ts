/**
 * 🎫 Tickets v2 — gardes du **contrat de formulaire** (`src/lib/tickets/form-schema.ts`).
 *
 * Ce que ces tests protègent (constats de l'audit du 24/09/2026) :
 *   · les réponses sont **clés par `id` de champ** — renommer une question ne casse
 *     plus la relecture d'un ticket (l'ancien moteur clait par libellé) ;
 *   · un « Non » est une **vraie réponse** enregistrée (`no`), pas une case vide ;
 *   · la politique `onNo` (bloquer / revue manuelle / avertir) est décidée **serveur** ;
 *   · la compilation respecte les limites Discord (5 lignes de modale, 25 options).
 *
 * Pur : aucun import serveur, aucune base, aucun mock.
 */

import { describe, it, expect } from "vitest";
import {
    TICKET_FIELD_CUSTOM_ID_PREFIX,
    TICKET_FORM_SCHEMA_VERSION,
    answersFromModalSubmit,
    buildChoiceStep,
    buildTicketModalRows,
    createEmptyTicketForm,
    evaluateAnswers,
    formatAnswersForDisplay,
    parseTicketForm,
    readTicketForm,
    splitTicketForm,
} from "@/lib/tickets/form-schema";

/** Formulaire de référence : un texte, un Oui/Non, un choix unique, une info. */
const sampleForm = {
    schemaVersion: TICKET_FORM_SCHEMA_VERSION,
    fields: [
        { id: "pseudo", kind: "text_short", label: "Pseudo en jeu", required: true, maxLength: 80 },
        { id: "reglement", kind: "yes_no", label: "Règlement lu et accepté ?", required: true, onNo: "block" },
        {
            id: "classe",
            kind: "select",
            label: "Classe principale",
            required: true,
            options: [
                { value: "iop", label: "Iop" },
                { value: "eliotrope", label: "Éliotrope" },
            ],
        },
        { id: "consignes", kind: "info", label: "Consignes", body: "Décris ton objectif en une phrase." },
    ],
} as const;

describe("tickets v2 — lecture du contrat", () => {
    it("accepte un formulaire valide et applique les défauts du contrat", () => {
        const parsed = parseTicketForm(sampleForm);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;

        const pseudo = parsed.form.fields[0];
        if (pseudo.kind !== "text_short") throw new Error("type de champ inattendu");
        expect(pseudo.minLength).toBe(0);
        expect(pseudo.required).toBe(true);

        const reglement = parsed.form.fields[1];
        if (reglement.kind !== "yes_no") throw new Error("type de champ inattendu");
        expect(reglement.yesLabel).toBe("Oui");
        expect(reglement.noLabel).toBe("Non");
        expect(reglement.onNo).toBe("block");
    });

    it("refuse deux champs avec le même identifiant", () => {
        const parsed = parseTicketForm({
            schemaVersion: TICKET_FORM_SCHEMA_VERSION,
            fields: [
                { id: "doublon", kind: "text_short", label: "Premier" },
                { id: "doublon", kind: "text_long", label: "Second" },
            ],
        });
        expect(parsed.ok).toBe(false);
        if (parsed.ok) return;
        expect(parsed.errors.join(" ")).toContain("dupliqué");
    });

    it("refuse deux options de même valeur et un identifiant technique invalide", () => {
        const parsed = parseTicketForm({
            schemaVersion: TICKET_FORM_SCHEMA_VERSION,
            fields: [
                { id: "Identifiant Invalide", kind: "text_short", label: "X" },
                {
                    id: "cible",
                    kind: "select",
                    label: "Cible",
                    options: [
                        { value: "pvm", label: "PvM" },
                        { value: "pvm", label: "PvM bis" },
                    ],
                },
            ],
        });
        expect(parsed.ok).toBe(false);
        if (parsed.ok) return;
        const joined = parsed.errors.join(" ");
        expect(joined).toMatch(/Identifiant technique invalide/);
        expect(joined).toMatch(/dupliquée/);
    });

    it("refuse une longueur minimale supérieure à la maximale", () => {
        const parsed = parseTicketForm({
            schemaVersion: TICKET_FORM_SCHEMA_VERSION,
            fields: [{ id: "note", kind: "text_long", label: "Note", minLength: 500, maxLength: 100 }],
        });
        expect(parsed.ok).toBe(false);
    });

    it("lit un JSON inconnu sans jeter (jamais d'exception sur une donnée héritée)", () => {
        expect(readTicketForm(null).fields).toEqual([]);
        expect(readTicketForm({ legacy: "SHORT | PARAGRAPH" }).fields).toEqual([]);
        expect(readTicketForm(sampleForm).fields).toHaveLength(4);
        expect(createEmptyTicketForm().schemaVersion).toBe(TICKET_FORM_SCHEMA_VERSION);
    });
});

describe("tickets v2 — compilation Discord", () => {
    it("compile la modale : champs texte uniquement, 5 lignes au plus", () => {
        const parsed = parseTicketForm({
            schemaVersion: TICKET_FORM_SCHEMA_VERSION,
            fields: Array.from({ length: 7 }, (_, index) => ({
                id: `q${index}`,
                kind: "text_short" as const,
                label: `Question ${index}`,
            })),
        });
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;

        const rows = buildTicketModalRows(parsed.form);
        expect(rows).toHaveLength(5);
        expect(rows[0].components[0].custom_id).toBe(`${TICKET_FIELD_CUSTOM_ID_PREFIX}q0`);

        const parts = splitTicketForm(parsed.form);
        expect(parts.modalRows).toBe(5);
        expect(parts.modalOverflow).toBe(2);
    });

    it("compile l'étape choix : boutons Oui/Non puis menu déroulant", () => {
        const parsed = parseTicketForm(sampleForm);
        if (!parsed.ok) throw new Error("formulaire de référence invalide");

        const step = buildChoiceStep(parsed.form);
        expect(step.fieldIds).toEqual(["reglement", "classe"]);
        expect(step.remainingFieldIds).toEqual([]);

        const [yesNoRow, selectRow] = step.rows;
        expect(yesNoRow.components.map((component) => component.custom_id)).toEqual([
            "tb_pick:reglement:yes",
            "tb_pick:reglement:no",
        ]);
        expect(selectRow.components[0].type).toBe(3);
        const options = selectRow.components[0].options as Array<{ value: string }>;
        expect(options.map((option) => option.value)).toEqual(["iop", "eliotrope"]);
    });

    it("ne redemande pas un choix déjà répondu et signale les choix en attente", () => {
        const parsed = parseTicketForm({
            schemaVersion: TICKET_FORM_SCHEMA_VERSION,
            fields: Array.from({ length: 6 }, (_, index) => ({
                id: `choix${index}`,
                kind: "yes_no" as const,
                label: `Question ${index}`,
            })),
        });
        if (!parsed.ok) throw new Error("formulaire invalide");

        // 6 choix pour 5 lignes par message : le 6ᵉ est annoncé, jamais perdu en silence.
        const first = buildChoiceStep(parsed.form);
        expect(first.fieldIds).toHaveLength(5);
        expect(first.remainingFieldIds).toEqual(["choix5"]);

        // Les choix déjà répondus sortent de la file, le reste tient en un message.
        const second = buildChoiceStep(parsed.form, { choix0: ["yes"], choix5: ["no"] });
        expect(second.fieldIds).toEqual(["choix1", "choix2", "choix3", "choix4"]);
        expect(second.remainingFieldIds).toEqual([]);
    });

    it("lit une soumission de modale par `id` de champ et rejette les clés inconnues", () => {
        const parsed = parseTicketForm(sampleForm);
        if (!parsed.ok) throw new Error("formulaire de référence invalide");

        const { answers, rejected } = answersFromModalSubmit(parsed.form, [
            { customId: "tf_pseudo", value: "  Dimitrios " },
            { customId: "tf_inconnu", value: "pirate" },
            { customId: "tb_close", value: "x" },
        ]);

        expect(answers).toEqual({ pseudo: "Dimitrios" });
        expect(rejected).toEqual(["tf_inconnu", "tb_close"]);
    });

    it("garde la réponse quand le libellé change (clé = identifiant, pas libellé)", () => {
        const parsed = parseTicketForm(sampleForm);
        if (!parsed.ok) throw new Error("formulaire de référence invalide");

        const { answers } = answersFromModalSubmit(parsed.form, [{ customId: "tf_pseudo", value: "Klyx" }]);
        const renamed = {
            ...parsed.form,
            fields: parsed.form.fields.map((field) =>
                field.id === "pseudo" ? { ...field, label: "Pseudo Dofus (renommé)" } : field
            ),
        };

        expect(formatAnswersForDisplay(renamed, answers)).toEqual([
            { label: "Pseudo Dofus (renommé)", value: "Klyx" },
        ]);
    });
});

describe("tickets v2 — validation métier et politique « Non »", () => {
    it("signale les champs obligatoires manquants sans ouvrir", () => {
        const parsed = parseTicketForm(sampleForm);
        if (!parsed.ok) throw new Error("formulaire de référence invalide");

        const verdict = evaluateAnswers(parsed.form, {});
        expect(verdict.ok).toBe(false);
        expect(verdict.missing).toEqual(["pseudo", "reglement", "classe"]);
        expect(verdict.decision.kind).toBe("ok");
    });

    it("enregistre un « Non » et bloque quand la politique l'exige", () => {
        const parsed = parseTicketForm(sampleForm);
        if (!parsed.ok) throw new Error("formulaire de référence invalide");

        const verdict = evaluateAnswers(parsed.form, {
            pseudo: "Dimitrios",
            reglement: ["no"],
            classe: "iop",
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.decision.kind).toBe("blocked");
        expect(verdict.negativeFieldIds).toEqual(["reglement"]);
        expect(verdict.errors).toEqual([]);
    });

    it("accepte un « Non » quand la politique est une revue manuelle", () => {
        const parsed = parseTicketForm({
            schemaVersion: TICKET_FORM_SCHEMA_VERSION,
            fields: [{ id: "essai", kind: "yes_no", label: "Période d'essai acceptée ?", onNo: "manual_review" }],
        });
        if (!parsed.ok) throw new Error("formulaire invalide");

        const verdict = evaluateAnswers(parsed.form, { essai: ["no"] });
        expect(verdict.ok).toBe(true);
        expect(verdict.decision.kind).toBe("manual_review");
        expect(verdict.answers.essai).toEqual(["no"]);
    });

    it("refuse une option inconnue, un dépassement de choix et une réponse trop longue", () => {
        const parsed = parseTicketForm({
            schemaVersion: TICKET_FORM_SCHEMA_VERSION,
            fields: [
                { id: "classe", kind: "select", label: "Classe", options: [{ value: "iop", label: "Iop" }] },
                {
                    id: "besoins",
                    kind: "multi_select",
                    label: "Besoins",
                    maxChoices: 1,
                    options: [
                        { value: "a", label: "A" },
                        { value: "b", label: "B" },
                    ],
                },
                { id: "note", kind: "text_short", label: "Note", maxLength: 5 },
            ],
        });
        if (!parsed.ok) throw new Error("formulaire invalide");

        const verdict = evaluateAnswers(parsed.form, {
            classe: "ecaflip",
            besoins: ["a", "b"],
            note: "beaucoup trop long",
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.errors).toHaveLength(3);
        expect(verdict.answers.note).toBeUndefined();
    });

    it("ignore les champs `info` (jamais obligatoires) et affiche les libellés d'option", () => {
        const parsed = parseTicketForm(sampleForm);
        if (!parsed.ok) throw new Error("formulaire de référence invalide");

        const verdict = evaluateAnswers(parsed.form, {
            pseudo: "Dimitrios",
            reglement: ["yes"],
            classe: "eliotrope",
        });
        expect(verdict.ok).toBe(true);

        expect(formatAnswersForDisplay(parsed.form, verdict.answers)).toEqual([
            { label: "Pseudo en jeu", value: "Dimitrios" },
            { label: "Règlement lu et accepté ?", value: "Oui" },
            { label: "Classe principale", value: "Éliotrope" },
        ]);
    });

    it("compte les champs de chaque étape de collecte", () => {
        const parsed = parseTicketForm(sampleForm);
        if (!parsed.ok) throw new Error("formulaire de référence invalide");

        const parts = splitTicketForm(parsed.form);
        expect(parts.texts).toHaveLength(1);
        expect(parts.choices).toHaveLength(2);
        expect(parts.infos).toHaveLength(1);
        expect(parts.choiceRows).toBe(2);
    });
});


