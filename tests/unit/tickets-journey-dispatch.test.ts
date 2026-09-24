/**
 * 🎫 Tickets v2 — gardes de la **traduction d'une étape en réponse Discord**
 * (`src/lib/tickets/journey-dispatch.ts`).
 *
 * Ce que ces tests protègent, et pourquoi ils comptent :
 *   · le `custom_id` d'une modale d'ouverture est **accepté par le routeur** : sans cela le
 *     membre remplit un questionnaire dont les réponses ne reviennent jamais (bouton mort) ;
 *   · après une **soumission de modale**, la réponse n'est **jamais** une autre modale
 *     (Discord l'interdit) : c'est le bouton « Continuer » qui rouvre la page suivante ;
 *   · les textes affichés dans le salon sont bornés et sans mention (le nom du parcours
 *     vient d'un écran d'administration).
 *
 * Pur : aucune base, aucun mock, aucun import serveur.
 */

import { describe, it, expect } from "vitest";
import {
    TICKET_MODAL_TITLE_MAX,
    TICKET_PANEL_ABSENT,
    buildTicketModalSubmittedReply,
    buildTicketOpenRefusal,
    buildTicketOpenedContent,
    buildTicketTunnelReply,
} from "@/lib/tickets/journey-dispatch";
import {
    nextTicketTunnelStep,
    serializeTicketDraftStep,
    type TicketTunnelStep,
} from "@/lib/tickets/journey-tunnel";
import { parseTicketCustomId } from "@/lib/tickets/interaction-routing";
import {
    TICKET_FORM_SCHEMA_VERSION,
    TICKET_MODAL_LIMITS,
    parseTicketForm,
    type TicketFormDefinition,
} from "@/lib/tickets/form-schema";

const JOURNEY = "clx0journey01";
const PANEL = "clx0panel0001";

function buildForm(fields: unknown[]): TicketFormDefinition {
    const parsed = parseTicketForm({ schemaVersion: TICKET_FORM_SCHEMA_VERSION, fields });
    if (!parsed.ok) throw new Error(`formulaire de test invalide : ${parsed.errors.join(" | ")}`);
    return parsed.form;
}

const yesNoField = (id: string) => ({
    id,
    kind: "yes_no" as const,
    label: `Confirmes-tu ${id} ?`,
    onNo: "continue" as const,
});

const textField = (index: number) => ({
    id: `q${index}`,
    kind: "text_short" as const,
    label: `Question ${index}`,
});

function stepFor(
    form: TicketFormDefinition,
    answers: Record<string, string[]> = {},
    page?: number
): TicketTunnelStep {
    return nextTicketTunnelStep({ form, journeyId: JOURNEY, answers, page });
}

describe("réponse Discord à une étape — clic de bouton", () => {
    it("un formulaire à choix produit un éphémère porteur des boutons envoyés par le tunnel", () => {
        const form = buildForm([yesNoField("reglement"), ...Array.from({ length: 2 }, (_, i) => textField(i))]);
        const step = stepFor(form);
        const reply = buildTicketTunnelReply({
            step,
            panelId: PANEL,
            journeyId: JOURNEY,
            journeyName: "Candidature",
        });

        expect(reply.kind).toBe("choices");
        if (reply.kind !== "choices") return;
        expect(reply.content).toContain("Candidature");
        expect(reply.content).toContain("1 question(s) à choix");
        // Les composants sont **exactement** ceux du tunnel (aucune reconstruction parallèle).
        expect(reply.components).toEqual(step.kind === "choices" ? step.rows : []);
    });

    it("une page de modale produit un `custom_id` que le routeur comprend (aucun bouton mort)", () => {
        const form = buildForm(Array.from({ length: 3 }, (_, i) => textField(i)));
        const step = stepFor(form);
        const reply = buildTicketTunnelReply({
            step,
            panelId: PANEL,
            journeyId: JOURNEY,
            journeyName: "Candidature",
        });

        expect(reply.kind).toBe("modal");
        if (reply.kind !== "modal") return;

        expect(parseTicketCustomId(reply.customId)).toMatchObject({
            kind: "modal_open",
            access: "public",
            panelId: PANEL,
            journeyId: JOURNEY,
        });
        expect(reply.title.length).toBeLessThanOrEqual(TICKET_MODAL_TITLE_MAX);
        expect(reply.title).toContain("page 1/1");
        expect(reply.components.length).toBeLessThanOrEqual(TICKET_MODAL_LIMITS.maxRows);
    });

    it("une page ouverte depuis l'étape des choix reste routable (panneau inconnu)", () => {
        const form = buildForm(Array.from({ length: 3 }, (_, i) => textField(i)));
        const step = stepFor(form);
        const reply = buildTicketTunnelReply({
            step,
            journeyId: JOURNEY,
            journeyName: "Candidature",
        });

        expect(reply.kind).toBe("modal");
        if (reply.kind !== "modal") return;
        expect(parseTicketCustomId(reply.customId)).toMatchObject({
            kind: "modal_open",
            panelId: TICKET_PANEL_ABSENT,
            journeyId: JOURNEY,
        });
    });

    it("un formulaire entièrement répondu dit qu'il n'y a plus rien à demander", () => {
        const form = buildForm(Array.from({ length: 2 }, (_, i) => textField(i)));
        const step = stepFor(form, { q0: ["a"], q1: ["b"] });
        const reply = buildTicketTunnelReply({
            step,
            panelId: PANEL,
            journeyId: JOURNEY,
            journeyName: "Support",
        });
        expect(step.kind).toBe("open");
        expect(reply.kind).toBe("open");
    });
});

describe("réponse Discord après une soumission de modale", () => {
    it("ne répond jamais par une modale et rouvre la page suivante par un bouton « Continuer »", () => {
        const form = buildForm(Array.from({ length: 11 }, (_, i) => textField(i)));
        const firstPage = { q0: ["a"], q1: ["b"], q2: ["c"], q3: ["d"], q4: ["e"] };
        const step = stepFor(form, firstPage, 1);

        const reply = buildTicketModalSubmittedReply({ step, journeyId: JOURNEY, journeyName: "Candidature" });
        expect(reply.kind).toBe("continue");
        if (reply.kind !== "continue") return;

        expect(reply.content).toContain("Page 2/3 enregistrée");
        const component = reply.components[0].components[0] as { custom_id: string; label: string };
        expect(component.label).toContain("page 2/3");
        expect(parseTicketCustomId(component.custom_id)).toMatchObject({
            kind: "modal_page",
            access: "public",
            journeyId: JOURNEY,
            page: 1,
        });
    });

    it("dit qu'il ne reste rien à remplir quand tout est répondu", () => {
        const form = buildForm(Array.from({ length: 3 }, (_, i) => textField(i)));
        const step = stepFor(form, { q0: ["a"], q1: ["b"], q2: ["c"] }, 1);
        expect(step.kind).toBe("open");

        const reply = buildTicketModalSubmittedReply({ step, journeyId: JOURNEY, journeyName: "Candidature" });
        expect(reply.kind).toBe("open");
    });

    it("le brouillon dit quelle page était posée (ce que la route relit pour enchaîner)", () => {
        const form = buildForm(Array.from({ length: 11 }, (_, i) => textField(i)));
        const step = stepFor(form, {}, 2);
        expect(step.kind).toBe("modal");
        if (step.kind !== "modal") return;
        expect(step.step).toBe(serializeTicketDraftStep({ stage: "TEXTS", page: 2 }));
    });
});

describe("réponse Discord — textes d'ouverture et de refus", () => {
    it("confirme l'ouverture par une mention de salon", () => {
        expect(buildTicketOpenedContent("123456789")).toBe("✅ Ton ticket est ouvert : <#123456789>");
    });

    it("refuse en le disant, sans laisser passer une mention dans le motif", () => {
        const refusal = buildTicketOpenRefusal("<@&12345678901234567> n'a pas accès");
        expect(refusal.startsWith("❌")).toBe(true);
        expect(refusal).not.toContain("<@&12345678901234567>");
    });
});

