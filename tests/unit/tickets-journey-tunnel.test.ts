/**
 * 🎫 Tickets v2 — gardes du **tunnel d'ouverture** (`src/lib/tickets/journey-tunnel.ts`).
 *
 * Ce que ces tests protègent :
 *   · un questionnaire de **20 questions** se pose en entier (4 modales chaînées) et une
 *     page déjà répondue n'est **jamais reposée** — le membre reprend où il s'est arrêté ;
 *   · une réponse de choix est revalidée côté règles (option inventée, Oui/Non ambigu,
 *     dépassement de `maxChoices` ⇒ refus, jamais enregistré « au cas où ») ;
 *   · le `custom_id` émis par le tunnel est **accepté par le routeur** (aller-retour) :
 *     c'est ce qui évite un bouton mort dans Discord.
 *
 * Pur : aucune base, aucun mock, aucun import serveur.
 */

import { describe, it, expect } from "vitest";
import {
    TICKET_DRAFT_STEP_CHOICES,
    applyTicketChoice,
    buildTicketModalContinueRows,
    isTicketDraftExpired,
    nextTicketTunnelStep,
    parseTicketDraftStep,
    pruneTicketTunnelAnswers,
    serializeTicketDraftStep,
    ticketDraftExpiresAt,
    ticketTunnelState,
} from "@/lib/tickets/journey-tunnel";
import { TICKET_FORM_SCHEMA_VERSION, parseTicketForm, type TicketFormDefinition } from "@/lib/tickets/form-schema";
import { parseTicketCustomId } from "@/lib/tickets/interaction-routing";

const JOURNEY = "clx0journey01";

function buildForm(fields: unknown[]): TicketFormDefinition {
    const parsed = parseTicketForm({ schemaVersion: TICKET_FORM_SCHEMA_VERSION, fields });
    if (!parsed.ok) throw new Error(`formulaire de test invalide : ${parsed.errors.join(" | ")}`);
    return parsed.form;
}

const textField = (index: number) => ({
    id: `q${index}`,
    kind: "text_short" as const,
    label: `Question ${index}`,
});

const yesNoField = (id: string) => ({
    id,
    kind: "yes_no" as const,
    label: `Confirmes-tu ${id} ?`,
    onNo: "continue" as const,
});

const selectField = (id: string, values: string[]) => ({
    id,
    kind: "select" as const,
    label: `Choix ${id}`,
    options: values.map((value) => ({ value, label: value.toUpperCase() })),
});

const multiField = (id: string, values: string[], maxChoices = 2) => ({
    id,
    kind: "multi_select" as const,
    label: `Choix multiples ${id}`,
    maxChoices,
    options: values.map((value) => ({ value, label: value.toUpperCase() })),
});

describe("tunnel d'ouverture — étape de brouillon persistée", () => {
    it("écrit et relit l'étape sans ambiguïté", () => {
        expect(serializeTicketDraftStep({ stage: "CHOICES", page: 0 })).toBe(TICKET_DRAFT_STEP_CHOICES);
        expect(serializeTicketDraftStep({ stage: "TEXTS", page: 2 })).toBe("TEXTS:2");
        expect(parseTicketDraftStep("TEXTS:2")).toEqual({ stage: "TEXTS", page: 2 });
        expect(parseTicketDraftStep("texts:3")).toEqual({ stage: "TEXTS", page: 3 });
    });

    it("retombe sur l'étape des choix pour toute valeur inconnue (jamais d'exception)", () => {
        for (const raw of ["", null, undefined, "??", "TEXTS:x"]) {
            const parsed = parseTicketDraftStep(raw as string | null | undefined);
            expect(parsed.stage).toBe("CHOICES");
            expect(parsed.page).toBe(0);
        }
        // `TEXTS` sans page reste une reprise valide : page 1.
        expect(parseTicketDraftStep("TEXTS")).toEqual({ stage: "TEXTS", page: 0 });
    });
});

describe("tunnel d'ouverture — un choix est revalidé, jamais deviné", () => {
    const form = buildForm([
        yesNoField("reglement"),
        selectField("classe", ["iop", "eliotrope"]),
        multiField("objectifs", ["pvp", "pvm", "metiers"]),
        textField(9),
    ]);

    it("enregistre un Oui/Non et un choix unique", () => {
        const yes = applyTicketChoice({ form, fieldId: "reglement", values: ["YES"] });
        expect(yes.ok && yes.answers).toEqual({ reglement: ["yes"] });

        const select = applyTicketChoice({ form, fieldId: "classe", values: ["iop"] });
        expect(select.ok && select.answers).toEqual({ classe: ["iop"] });
    });

    it("refuse un champ inconnu, un champ qui n'est pas un choix, et une réponse vide", () => {
        expect(applyTicketChoice({ form, fieldId: "inconnu", values: ["x"] })).toEqual({
            ok: false,
            reason: "Cette question n'est pas un choix.",
        });
        expect(applyTicketChoice({ form, fieldId: "q9", values: ["texte"] }).ok).toBe(false);
        expect(applyTicketChoice({ form, fieldId: "reglement", values: [] }).ok).toBe(false);
    });

    it("refuse une option inventée, un Oui/Non ambigu et un trop-plein de choix", () => {
        expect(applyTicketChoice({ form, fieldId: "classe", values: ["mage"] })).toMatchObject({ ok: false });
        expect(applyTicketChoice({ form, fieldId: "classe", values: ["iop", "eliotrope"] }).ok).toBe(false);
        expect(applyTicketChoice({ form, fieldId: "reglement", values: ["peut-etre"] }).ok).toBe(false);
        expect(applyTicketChoice({ form, fieldId: "objectifs", values: ["pvp", "pvm", "metiers"] }).ok).toBe(
            false
        );
    });

    it("conserve les réponses déjà données", () => {
        const first = applyTicketChoice({ form, fieldId: "reglement", values: ["no"] });
        if (!first.ok) throw new Error("choix refusé à tort");
        const second = applyTicketChoice({ form, fieldId: "classe", answers: first.answers, values: ["iop"] });
        expect(second.ok && second.answers).toEqual({ reglement: ["no"], classe: ["iop"] });
    });
});

describe("tunnel d'ouverture — où en est le brouillon", () => {
    const form = buildForm([
        yesNoField("reglement"),
        ...Array.from({ length: 7 }, (_, index) => textField(index)),
    ]);

    it("dit ce qui manque et quelle page de texte reste à remplir", () => {
        const empty = ticketTunnelState(form);
        expect(empty.pendingChoiceIds).toEqual(["reglement"]);
        expect(empty.textPages).toBe(2);
        expect(empty.firstPendingTextPage).toBe(0);
        expect(empty.allAnswered).toBe(false);

        const firstPage = { reglement: ["yes"], q0: ["a"], q1: ["b"], q2: ["c"], q3: ["d"], q4: ["e"] };
        const half = ticketTunnelState(form, firstPage);
        expect(half.pendingChoiceIds).toEqual([]);
        expect(half.firstPendingTextPage).toBe(1);
        expect(half.allAnswered).toBe(false);

        const done = ticketTunnelState(form, { ...firstPage, q5: ["f"], q6: ["g"] });
        expect(done.allAnswered).toBe(true);
        expect(done.firstPendingTextPage).toBe(-1);
    });
});

describe("tunnel d'ouverture — la prochaine interaction à montrer", () => {
    it("commence par les choix, avec le parcours dans le `custom_id` (le routeur l'accepte)", () => {
        const form = buildForm([yesNoField("reglement"), selectField("classe", ["iop"])]);
        const step = nextTicketTunnelStep({ form, journeyId: JOURNEY });
        expect(step.kind).toBe("choices");
        if (step.kind !== "choices") return;

        expect(step.step).toBe(TICKET_DRAFT_STEP_CHOICES);
        const customIds = step.rows.flatMap((row) =>
            row.components.map((component) => String(component.custom_id))
        );
        expect(customIds).toContain(`tb_pick:${JOURNEY}:classe`);
        expect(parseTicketCustomId(`tb_pick:${JOURNEY}:reglement:yes`)).toMatchObject({
            kind: "pick",
            journeyId: JOURNEY,
            fieldId: "reglement",
            value: "yes",
        });
    });

    it("enchaîne sur la modale dès que les choix sont répondus", () => {
        const form = buildForm([yesNoField("reglement"), ...Array.from({ length: 3 }, (_, i) => textField(i))]);
        const step = nextTicketTunnelStep({ form, journeyId: JOURNEY, answers: { reglement: ["yes"] } });
        expect(step.kind).toBe("modal");
        if (step.kind !== "modal") return;
        expect(step.page).toBe(0);
        expect(step.step).toBe("TEXTS:0");
        expect(step.rows.length).toBeLessThanOrEqual(5);
    });

    it("ne repose jamais une page déjà remplie et va jusqu'à la 4ᵉ sur 20 questions", () => {
        const form = buildForm(Array.from({ length: 20 }, (_, index) => textField(index)));
        const answers: Record<string, string[]> = {};
        for (let index = 0; index < 15; index += 1) answers[`q${index}`] = [`r${index}`];

        const step = nextTicketTunnelStep({ form, journeyId: JOURNEY, answers });
        expect(step.kind).toBe("modal");
        if (step.kind !== "modal") return;
        expect(step.page).toBe(3);
        expect(step.pageCount).toBe(4);
        expect(step.isLast).toBe(true);
        expect(step.fieldIds).toEqual(["q15", "q16", "q17", "q18", "q19"]);
    });

    it("ouvre dès que plus rien ne manque (et pour un parcours sans question)", () => {
        const form = buildForm(Array.from({ length: 6 }, (_, index) => textField(index)));
        const answers = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`q${index}`, [`r${index}`]]));
        expect(nextTicketTunnelStep({ form, journeyId: JOURNEY, answers }).kind).toBe("open");
        expect(nextTicketTunnelStep({ form: buildForm([]), journeyId: JOURNEY }).kind).toBe("open");
    });

    it("respecte la page demandée par le bouton « Continuer »", () => {
        const form = buildForm(Array.from({ length: 11 }, (_, index) => textField(index)));
        const answers: Record<string, string[]> = {};
        for (let index = 0; index < 5; index += 1) answers[`q${index}`] = [`r${index}`];

        const step = nextTicketTunnelStep({ form, journeyId: JOURNEY, answers, page: 1 });
        expect(step.kind === "modal" && step.page).toBe(1);
    });
});

describe("tunnel d'ouverture — brouillon : durée de vie et hygiène des réponses", () => {
    it("expire au bout de 30 minutes et traite toute date douteuse comme périmée", () => {
        const now = new Date("2026-09-24T12:00:00.000Z");
        expect(ticketDraftExpiresAt(now).toISOString()).toBe("2026-09-24T12:30:00.000Z");
        expect(isTicketDraftExpired(ticketDraftExpiresAt(now), now)).toBe(false);
        expect(isTicketDraftExpired(new Date(now.getTime() - 1), now)).toBe(true);
        expect(isTicketDraftExpired(null, now)).toBe(true);
        expect(isTicketDraftExpired("pas une date", now)).toBe(true);
    });

    it("ne garde que les réponses des champs du formulaire, normalisées en tableaux", () => {
        const form = buildForm([textField(0), yesNoField("reglement")]);
        expect(
            pruneTicketTunnelAnswers(form, {
                q0: "  ma réponse  ",
                reglement: ["yes"],
                champ_supprime: ["valeur"],
                vide: "   ",
            })
        ).toEqual({ q0: ["ma réponse"], reglement: ["yes"] });
        expect(pruneTicketTunnelAnswers(form, null)).toEqual({});
    });
});

describe("tunnel d'ouverture — bouton « Continuer »", () => {
    it("produit un `custom_id` que le routeur comprend (aucun bouton mort)", () => {
        const rows = buildTicketModalContinueRows({ journeyId: JOURNEY, page: 1, pageCount: 4, fieldCount: 5 });
        expect(rows).toHaveLength(1);

        const component = rows[0].components[0] as { custom_id: string; label: string };
        expect(component.label).toContain("page 2/4");
        expect(parseTicketCustomId(component.custom_id)).toMatchObject({
            kind: "modal_page",
            journeyId: JOURNEY,
            page: 1,
            access: "public",
        });
    });

    it("refuse une page aberrante ou un parcours trop court (fail-closed)", () => {
        expect(parseTicketCustomId(`tb:modal_page:${JOURNEY}:9`)).toBeNull();
        expect(parseTicketCustomId("tb:modal_page:court:0")).toBeNull();
    });
});