/**
 * 🏷️ Renommage **temps réel** du salon d'un ticket (bot gateway) — parité et règles.
 *
 * Le bot ne peut pas importer `src/` (image Docker sans `src/`), il porte donc un **miroir**
 * (`services/discord-bot/ticket-name.mjs`). Ce verrou garantit que le miroir **produit le
 * même slug** que la règle de l'application : s'il dérive, le test casse ici — pas en
 * production, sur un salon mal nommé.
 */

import { describe, expect, it } from "vitest";

import { formatTicketChannelName } from "@/lib/tickets/channel-name-format";
import {
    renameTicketChannelName,
    slugifyTicketName,
} from "../../services/discord-bot/ticket-name.mjs";

const CORPUS = [
    "Retro slide",
    "Baboba",
    "Élìotrope  Du  Nord",
    "Wylan",
    "Michmich#4777",
    "Le   Sage",
    "Épée-à-Deux-Mains",
    "Wylan le Sage",
    "A".repeat(140),
];

describe("parité du slug bot ⇄ application", () => {
    it("produit exactement le slug de `formatTicketChannelName` sur un corpus de pseudos", () => {
        for (const name of CORPUS) {
            const fromApp = formatTicketChannelName("{user}", { number: 0, user: name, journey: "" });
            // `{user}` seul ⇒ le slug du pseudo (repli `ticket-0000` impossible ici).
            expect(slugifyTicketName(name), `pseudo « ${name} »`).toBe(fromApp);
        }
    });
});

describe("renommage « sur place » du salon", () => {
    it("remplace le pseudo dans le nom existant (cas mesuré)", () => {
        expect(renameTicketChannelName("ticket-0044-retro-slide", "Retro slide", "Baboba")).toBe(
            "ticket-0044-baboba"
        );
    });

    it("suit un changement de nom d'utilisateur (accents et espaces)", () => {
        expect(renameTicketChannelName("ticket-0044-eliotrope-du-nord", "Élìotrope Du Nord", "Wylan")).toBe(
            "ticket-0044-wylan"
        );
    });

    it("ne touche pas un nom sans le pseudo (motif `ticket-{num}`)", () => {
        expect(renameTicketChannelName("ticket-0044", "Retro slide", "Baboba")).toBeNull();
    });

    it("ne touche pas un nom personnalisé par le staff", () => {
        expect(renameTicketChannelName("candidature-staff-0044", "Retro slide", "Baboba")).toBeNull();
    });

    it("ignore un pseudo inchangé", () => {
        expect(renameTicketChannelName("ticket-0044-retro-slide", "Retro slide", "Retro  Slide")).toBeNull();
    });

    it("borne le nom à 100 caractères (limite Discord)", () => {
        const next = renameTicketChannelName(
            "ticket-0044-retro-slide",
            "Retro slide",
            "Pseudo Extrêmement Long Pour Un Salon De Ticket Discord"
        );
        expect(next?.length).toBeLessThanOrEqual(100);
    });
});
