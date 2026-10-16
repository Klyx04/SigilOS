/**
 * 🎫 Tickets — **lot 1 : bugs prouvés** (16/10/2026). Ce filet verrouille les correctifs
 * issus des questions de l'utilisateur, chacun avec sa **mesure** :
 *
 *   · ⑧ la mention `<@cmlozn4dj000g01mj6d1lz4iw>` — un `User.id` (cuid) pris pour un flocon ;
 *   · ⑨ le vote de satisfaction qui ne partait pas depuis le dashboard (aucun envoi) ;
 *   · ① le sélecteur de blacklist affiché « Liste blanche / rôles autorisés » ;
 *   · ③ les Oui/Non affichés sans leur question (4 boutons muets) ;
 *   · ⑦ les réponses coupées/tronquées en silence dans l'embed.
 *
 * Deux natures de tests, comme le veut la maison :
 *   · **pur** (embeds, form-schema) : exécuté, aucune base, aucun mock ;
 *   · **runtime guard** (lecture de source) : les correctifs qui vivent dans une action
 *     `"use server"` (impossible à importer sans base) sont vérifiés **là où ils vivent**.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    DISCORD_EMBED_FIELDS_MAX,
    DISCORD_FIELD_VALUE_MAX,
    buildTicketAnswersEmbed,
    buildTicketCsatEmbed,
} from "@/lib/tickets/embeds";
import {
    DISCORD_BUTTON_LABEL_MAX,
    TICKET_FORM_MAX_FIELDS,
    TICKET_FORM_SCHEMA_VERSION,
    buildChoiceStep,
    choiceButtonLabel,
    parseTicketForm,
    type TicketFormDefinition,
} from "@/lib/tickets/form-schema";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
/** Libellé d'un composant (le type Discord est volontairement permissif dans le moteur). */
const componentLabel = (component: unknown): string => (component as { label?: string }).label ?? "";

function formWith(count: number, kind: "text_short" | "yes_no" = "text_short"): TicketFormDefinition {
    const parsed = parseTicketForm({
        schemaVersion: TICKET_FORM_SCHEMA_VERSION,
        fields: Array.from({ length: count }, (_, index) => ({
            id: `q${index + 1}`,
            kind,
            label: `Question ${index + 1}`,
        })),
    });
    if (!parsed.ok) throw new Error("formulaire de test invalide");
    return parsed.form;
}

describe("⑦ réponses du questionnaire — aucune perte silencieuse", () => {
    it("affiche les 20 réponses du contrat de formulaire sans en perdre une", () => {
        const form = formWith(TICKET_FORM_MAX_FIELDS);
        const answers = Object.fromEntries(
            Array.from({ length: TICKET_FORM_MAX_FIELDS }, (_, index) => [`q${index + 1}`, `réponse ${index + 1}`])
        );

        const embed = buildTicketAnswersEmbed({ ticketNumber: 7, form, answers });
        const fields = (embed?.fields ?? []) as Array<{ name: string; value: string }>;

        expect(fields).toHaveLength(TICKET_FORM_MAX_FIELDS);
        expect(fields.at(-1)?.name).toContain(`Question ${TICKET_FORM_MAX_FIELDS}`);
        // 🔒 Le plafond de champs Discord reste au-dessus de la borne des questions : si
        // quelqu'un relève `TICKET_FORM_MAX_FIELDS` un jour, ce test casse AVANT que des
        // réponses ne disparaissent du message.
        expect(DISCORD_EMBED_FIELDS_MAX).toBeGreaterThanOrEqual(TICKET_FORM_MAX_FIELDS);
    });

    it("dit qu'un texte a été coupé au lieu de le tronquer en silence", () => {
        const form = formWith(1);
        const embed = buildTicketAnswersEmbed({ ticketNumber: 7, form, answers: { q1: "a".repeat(1500) } });
        const value = String((embed?.fields as Array<{ value: string }>)[0]?.value ?? "");

        expect(value.length).toBeLessThanOrEqual(DISCORD_FIELD_VALUE_MAX);
        expect(value).toContain("suite dans la copie des messages");
    });

    it("ne touche pas une réponse normale (ni marqueur, ni mention vivante)", () => {
        const form = formWith(1);
        const embed = buildTicketAnswersEmbed({
            ticketNumber: 7,
            form,
            answers: { q1: "@everyone <@123456789012345678>" },
        });
        const value = String((embed?.fields as Array<{ value: string }>)[0]?.value ?? "");

        expect(value).toContain("@\u200beveryone");
        expect(value).not.toContain("suite dans la copie");
    });
});

describe("③ les questions à choix portent leur libellé", () => {
    it("préfixe le libellé de la question quand plusieurs questions sont posées ensemble", () => {
        const form = formWith(2, "yes_no");
        const step = buildChoiceStep(form, { journeyId: "candidature" });

        expect(step.prompts).toEqual(["Question 1", "Question 2"]);
        const labels = step.rows.flatMap((row) => row.components.map(componentLabel));
        expect(labels[0]).toBe("Oui — Question 1");
        expect(labels[2]).toBe("Oui — Question 2");
        for (const label of labels) {
            expect(label.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_MAX);
        }
    });

    it("garde des libellés courts quand une seule question est posée", () => {
        const form = formWith(1, "yes_no");
        const step = buildChoiceStep(form, { journeyId: "candidature" });
        const labels = step.rows.flatMap((row) => row.components.map(componentLabel));

        expect(labels).toEqual(["Oui", "Non"]);
    });

    it("sacrifie la fin du libellé de question quand il n'y a plus de place", () => {
        const label = choiceButtonLabel("Oui", "Q".repeat(200));
        expect(label.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_MAX);
        expect(label.startsWith("Oui — Q")).toBe(true);
        expect(label.endsWith("…")).toBe(true);
    });
});

describe("⑨ l'enquête de satisfaction est posée par les deux chemins de clôture", () => {
    it("pose le même avis depuis Discord et depuis le dashboard (service partagé)", () => {
        const code = codeOnly(read("src/server/actions/ticket-bot-actions.ts"));
        // Deux appels : `closeTicketAction` (dashboard) et `internalHandleTicketClose` (bouton).
        expect((code.match(/sendTicketCsatSurvey\(/g) || []).length).toBeGreaterThanOrEqual(2);
        // Le chemin dashboard ne réimplémente plus l'enquête en local.
        expect(code).not.toContain("custom_id: `tb:csat:");
    });

    it("expose un repli quand les MP sont fermés (jamais d'avis perdu en silence)", () => {
        const code = codeOnly(read("src/server/tickets/csat.ts"));
        expect(code).toContain("channel_fallback");
        expect(code).toContain("enquête de satisfaction NON envoyée");
        // La destination « dans le ticket » mentionne le demandeur.
        expect(code).toContain("`<@${input.creatorDiscordId}>`");
    });

    it("rend le texte de l'avis en français par défaut et en anglais si demandé", () => {
        const fr = buildTicketCsatEmbed({ ticketNumber: 12, motifName: "Candidature", guildName: "STELLIUM" });
        const en = buildTicketCsatEmbed({
            ticketNumber: 12,
            motifName: "Candidature",
            guildName: "STELLIUM",
            lang: "en",
        });
        expect(fr.title).toContain("Ticket #12");
        expect(fr.description).toContain("Candidature");
        expect(en.title).toContain("Ticket #12");
        expect(en.description).toContain("just been closed");
    });
});

describe("⑧ un identifiant Discord n'est jamais un identifiant interne", () => {
    it("n'écrit plus `user.id` (cuid) dans une colonne `*DiscordId` ni dans un ping", () => {
        const code = codeOnly(read("src/server/actions/ticket-bot-actions.ts"));
        expect(code).not.toContain("user.id ||");
        expect(code).not.toContain("<@${user.id}");
        expect(code).toContain("resolveActorDiscordId(user");
    });

    it("expose le flocon Discord dans le contexte serveur (`getUserContext`)", () => {
        const code = codeOnly(read("src/server/actions/user-actions.ts"));
        expect(code).toContain("discordId: discordUserId ?? null");
        // Le type le déclare (sinon `tsc` ne le verrait pas côté appelant).
        expect(code).toContain("discordId?: string | null;");
    });
});

describe("① les libellés du sélecteur de rôles disent ce qu'il fait", () => {
    it("permet à l'écran de blacklist de ne plus dire « liste blanche »", () => {
        const picker = read("src/components/admin/ping-roles-selector.tsx");
        expect(picker).toContain("title = \"Liste Blanche\"");
        expect(picker).toContain("triggerPlaceholder");
        expect(picker).toContain("emptyTitle");

        const tab = read("src/app/dashboard/[guildId]/tickets/_components/tabs/ticket-settings-tab.tsx");
        expect(tab).toContain('title="Rôles bloqués"');
        expect(tab).toContain('emptyTitle="Aucun rôle bloqué"');
    });
});
