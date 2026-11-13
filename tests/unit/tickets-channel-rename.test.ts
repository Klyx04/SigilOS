/**
 * 🏷️ Renommage du salon d'un ticket quand le demandeur change de pseudo Discord
 * (demande user du 25/10/2026).
 *
 * Ce que la garde protège : on ne renomme **que** les salons dont le motif contient
 * `{user}` — un `ticket-{num}` posé par le staff ne bouge jamais — et le nom recalculé
 * est exactement celui de l'ouverture (même règle, même slug).
 */

import { describe, expect, it } from "vitest";

import {
    formatTicketChannelName,
    ticketNameUsesCreator,
} from "@/lib/tickets/channel-name-format";

describe("motif de nom : le pseudo du demandeur est-il utilisé ?", () => {
    it("reconnaît `{user}` (casse indifférente)", () => {
        expect(ticketNameUsesCreator("ticket-{num}-{user}")).toBe(true);
        expect(ticketNameUsesCreator("{user}-{num}")).toBe(true);
        expect(ticketNameUsesCreator("ticket-{num}-{USER}")).toBe(true);
    });

    it("ne renomme jamais un motif sans pseudo", () => {
        expect(ticketNameUsesCreator("ticket-{num}")).toBe(false);
        expect(ticketNameUsesCreator("ticket-clos")).toBe(false);
        expect(ticketNameUsesCreator("support-{journey}")).toBe(false);
        expect(ticketNameUsesCreator(null)).toBe(false);
        expect(ticketNameUsesCreator(undefined)).toBe(false);
    });
});

describe("nom recalculé après un renommage Discord", () => {
    const vars = (user: string) => ({ number: 44, user, journey: "Support" });

    it("suit le pseudo du demandeur (cas mesuré : ticket-0044-retro-slide)", () => {
        const pattern = "ticket-{num}-{user}";
        expect(formatTicketChannelName(pattern, vars("Retro slide"))).toBe("ticket-0044-retro-slide");
        expect(formatTicketChannelName(pattern, vars("Baboba"))).toBe("ticket-0044-baboba");
    });

    it("assainit accents, espaces et majuscules comme à l'ouverture", () => {
        expect(formatTicketChannelName("ticket-{num}-{user}", vars("Élìotrope  Du  Nord"))).toBe(
            "ticket-0044-eliotrope-du-nord"
        );
    });

    it("ne bouge pas un motif fixe, même avec un nouveau pseudo", () => {
        expect(formatTicketChannelName("ticket-{num}", vars("Baboba"))).toBe("ticket-0044");
    });
});
