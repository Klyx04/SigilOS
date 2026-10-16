/**
 * 🎫 Tickets — **boutons du salon** (lot 2, demande user du 16/10/2026).
 *
 * Ce que ces tests protègent :
 *   · **deux boutons** seulement tant que le ticket vit (« Prendre en charge », « Fermer le
 *     ticket »), puis Rouvrir / Transcript / Supprimer après clôture ;
 *   · **nom + icône personnalisables** par bouton (bornes Discord respectées) ;
 *   · **RBAC par bouton** (`settingsJson.buttons`) et `disabled` = bouton réellement retiré ;
 *   · **fail-closed** : une configuration illisible retombe sur les défauts restrictifs ;
 *   · la **suppression différée** (4 s, droits revérifiés) et la mise à jour **en direct**
 *     du message d'accueil (garde de source : ces règles vivent dans une action `"use server"`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    TICKET_BUTTON_DEFAULT_ACCESS,
    TICKET_BUTTON_EMOJI_MAX,
    TICKET_BUTTON_LABEL_MAX,
    defaultTicketButtonLabel,
    readTicketButtonSettings,
    resolveTicketButton,
    ticketButtonAccess,
    ticketButtonLayout,
    writeTicketButtonSettings,
} from "@/lib/tickets/button-config";
import { buildActionRows, buildModerationRows } from "@/lib/tickets/embeds";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const customIds = (rows: ReturnType<typeof buildActionRows>) =>
    rows.flatMap((row) => row.components.map((component) => String(component.custom_id)));

describe("boutons du salon — disposition par état", () => {
    it("un ticket vivant n'affiche que « Prendre en charge » et « Fermer le ticket »", () => {
        for (const status of ["OPEN", "CLAIMED", "PENDING_USER"]) {
            expect(customIds(buildActionRows({ ticketId: "t1", status }))).toEqual([
                "tb:claim:t1",
                "tb:close:t1",
            ]);
        }
    });

    it("un ticket fermé révèle Rouvrir, Transcript et Supprimer", () => {
        const rows = buildActionRows({ ticketId: "t1", status: "CLOSED" });
        expect(customIds(rows)).toEqual(["tb:reopen:t1", "tb:transcript:t1", "tb:delete:t1"]);
        // Même barre que le message de modération : une seule fabrique, aucune divergence.
        expect(customIds(buildModerationRows("t1"))).toEqual(customIds(rows));
    });
});

describe("boutons du salon — nom, icône et droit", () => {
    it("applique les défauts vulgarisés (dont « Transcript »)", () => {
        expect(defaultTicketButtonLabel("claim", "fr")).toBe("Je m'en occupe");
        expect(defaultTicketButtonLabel("close", "fr")).toBe("Fermer");
        expect(defaultTicketButtonLabel("transcript", "fr")).toBe("Transcript");
        // Le droit par défaut est celui du produit, jamais plus permissif.
        expect(ticketButtonAccess("claim")).toBe("staff");
        expect(ticketButtonAccess("close")).toBe("staff_or_creator");
        expect(ticketButtonAccess("delete")).toBe("staff");
    });

    it("respecte un nom, une icône et un droit personnalisés", () => {
        const settings = { claim: { label: "Je gère", emoji: "🙋", access: "staff_or_creator" as const } };
        const [claim, close] = ticketButtonLayout("OPEN", settings);
        expect(claim).toEqual({ key: "claim", label: "Je gère", emoji: "🙋", access: "staff_or_creator" });
        // Un bouton non configuré garde ses défauts.
        expect(close.label).toBe(defaultTicketButtonLabel("close", "fr"));
        expect(close.access).toBe(TICKET_BUTTON_DEFAULT_ACCESS.close);
    });

    it("retire réellement un bouton désactivé (jamais un bouton inerte)", () => {
        expect(ticketButtonLayout("OPEN", { close: { access: "disabled" } }).map((b) => b.key)).toEqual(["claim"]);
        expect(
            ticketButtonLayout("CLOSED", {
                reopen: { access: "disabled" },
                transcript: { access: "disabled" },
                delete: { access: "disabled" },
            })
        ).toEqual([]);
    });

    it("borne le nom et l'icône (limites Discord)", () => {
        const long = "x".repeat(400);
        const resolved = resolveTicketButton("claim", { claim: { label: long, emoji: long } });
        expect(resolved.label.length).toBeLessThanOrEqual(TICKET_BUTTON_LABEL_MAX);
        expect(resolved.emoji.length).toBeLessThanOrEqual(TICKET_BUTTON_EMOJI_MAX);
    });
});

describe("boutons du salon — configuration persistée (`settingsJson.buttons`)", () => {
    it("relit ce qu'elle écrit (aller-retour stable)", () => {
        const written = writeTicketButtonSettings(
            { csatDestination: "DM" },
            { claim: { label: "Je m'en occupe", emoji: "🛡️", access: "staff" }, delete: { access: "disabled" } }
        );
        expect(written.csatDestination).toBe("DM"); // les autres réglages survivent
        expect(readTicketButtonSettings(written)).toEqual({
            claim: { label: "Je m'en occupe", emoji: "🛡️", access: "staff" },
            delete: { access: "disabled" },
        });
    });

    it("ignore une configuration illisible plutôt que d'ouvrir un accès", () => {
        expect(readTicketButtonSettings(null)).toEqual({});
        expect(readTicketButtonSettings({ buttons: "pas-un-objet" })).toEqual({});
        expect(readTicketButtonSettings({ buttons: { claim: { access: "everyone" } } })).toEqual({});
        expect(readTicketButtonSettings({ buttons: { inconnu: { access: "staff" } } })).toEqual({});
        // Un `access` invalide ne devient jamais un accès : le défaut du bouton s'applique.
        const settings = readTicketButtonSettings({ buttons: { delete: { access: "n'importe quoi" } } });
        expect(ticketButtonAccess("delete", settings)).toBe("staff");
    });
});

describe("suppression différée et mise à jour en direct (gardes de source)", () => {
    it("supprime après un décompte, en revérifiant les droits", () => {
        const code = codeOnly(read("src/server/actions/ticket-bot-actions.ts"));
        expect(code).toContain("after(async () => {");
        expect(code).toContain("TICKET_DELETE_COUNTDOWN_SECONDS = 4");
        expect(code).toContain("Suppression du salon dans");
        // Le ticket rouvert pendant le décompte n'est PAS supprimé.
        expect(code).toContain('fresh.status !== "CLOSED"');
        expect(code).toContain("Suppression annulée");
    });

    it("applique le RBAC du bouton au clic, jamais à l'affichage", () => {
        const code = codeOnly(read("src/server/actions/ticket-bot-actions.ts"));
        expect(code).toContain("ticketButtonAccess(input.buttonKey, buttonSettings)");
        expect(code).toContain("Ce bouton est désactivé pour ce serveur.");
        for (const key of ["claim", "close", "reopen", "transcript", "delete"]) {
            expect(code, `gate manquant pour ${key}`).toContain(`buttonKey: "${key}"`);
        }
    });

    it("met à jour le message d'accueil en direct (prise en charge et clôture)", () => {
        const code = codeOnly(read("src/server/actions/ticket-bot-actions.ts"));
        expect(code).toContain("patchTicketWelcomeMessage(");
        expect(code).toContain("metadataJson: { welcomeMessageId }");
        // Le décompte est édité via l'identité de l'interaction (jamais une valeur inventée).
        expect(code).toContain("editInteractionMessage(");
        const route = codeOnly(read("src/app/api/discord/interactions/route.ts"));
        expect(route).toContain("interactionToken: payload.token");
    });
});
