import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    DEFAULT_CLOSED_CHANNEL_PATTERN,
    formatClosedTicketChannelName,
    formatTicketChannelName,
} from "@/lib/tickets/embeds";
import {
    readTicketNamingSettings,
    writeTicketPermissionSettings,
} from "@/lib/tickets/category-permissions";
import { ticketClosedChannelName, ticketOpeningChannelName } from "@/lib/tickets/channel-naming";

const vars = { number: 42, user: "Wylan", journey: "Recrutement" };

describe("nom du salon d'un ticket fermé", () => {
    it("sans réglage : `ticket-clos`", () => {
        expect(DEFAULT_CLOSED_CHANNEL_PATTERN).toBe("ticket-clos");
        expect(formatClosedTicketChannelName("", vars)).toBe("ticket-clos");
        expect(formatClosedTicketChannelName(null, vars)).toBe("ticket-clos");
    });

    it("respecte le motif du staff, numéro sur 4 chiffres", () => {
        expect(formatClosedTicketChannelName("clos-{num}", vars)).toBe("clos-0042");
        expect(formatClosedTicketChannelName("ferme-{user}", vars)).toBe("ferme-wylan");
        expect(formatClosedTicketChannelName("{journey}-clos-{num}", vars)).toBe("recrutement-clos-0042");
    });

    it("assainit accents et caractères interdits (mêmes règles que l'ouverture)", () => {
        expect(formatClosedTicketChannelName("Fermé — {journey}", vars)).toBe("ferme-recrutement");
        expect(formatClosedTicketChannelName("!!!", vars)).toBe("ticket-0042");
        expect(formatClosedTicketChannelName("x".repeat(200), vars).length).toBeLessThanOrEqual(100);
    });

    it("même assainissement que l'ouverture (un motif accentué ne casse rien)", () => {
        const accented = { number: 7, user: "Éléonore", journey: "Réclamation" };
        expect(formatTicketChannelName("{journey}-{user}", accented)).toBe("reclamation-eleonore");
        expect(formatClosedTicketChannelName("{journey}-{user}", accented)).toBe("reclamation-eleonore");
    });
});

describe("réglage `closedChannelPattern` (settingsJson, sans migration)", () => {
    it("lecture fail-closed : tout ce qui n'est pas une chaîne devient vide (= défaut)", () => {
        expect(readTicketNamingSettings(null)).toEqual({ closedChannelPattern: "" });
        expect(readTicketNamingSettings("ticket-clos")).toEqual({ closedChannelPattern: "" });
        expect(readTicketNamingSettings({ closedChannelPattern: 42 })).toEqual({ closedChannelPattern: "" });
        expect(readTicketNamingSettings({ closedChannelPattern: "  clos-{num}  " })).toEqual({
            closedChannelPattern: "clos-{num}",
        });
    });

    it("lecture bornée à 80 caractères", () => {
        expect(readTicketNamingSettings({ closedChannelPattern: "a".repeat(200) }).closedChannelPattern).toHaveLength(80);
    });

    it("écriture : conserve les autres réglages et accepte l'effacement (retour au défaut)", () => {
        const written = writeTicketPermissionSettings(
            { allowUserClose: false, closedChannelPattern: "ancien" },
            { closedChannelPattern: "clos-{num}" }
        );
        expect(written.closedChannelPattern).toBe("clos-{num}");
        expect(written.allowUserClose).toBe(false);

        const cleared = writeTicketPermissionSettings({ closedChannelPattern: "ancien" }, { closedChannelPattern: "" });
        expect(cleared.closedChannelPattern).toBe("");
    });

    it("le nom calculé côté ticket lit bien ce réglage", () => {
        const naming = { ticketNumber: 42, creatorDiscordName: "Wylan", journey: { name: "Recrutement", namingPattern: "ticket-{num}-{user}" } };
        expect(ticketClosedChannelName(naming, {})).toBe("ticket-clos");
        expect(ticketClosedChannelName(naming, { closedChannelPattern: "clos-{num}" })).toBe("clos-0042");
        expect(ticketOpeningChannelName(naming)).toBe("ticket-0042-wylan");
    });
});

describe("message de clôture et renommage — contrats de source", () => {
    const source = readFileSync("src/server/actions/ticket-bot-actions.ts", "utf8");

    it("n'affiche plus le motif d'exécution au membre", () => {
        expect(source).not.toContain("Motif : ${reason");
        expect(source).not.toContain("Motif : ${params.reason");
        expect(source).not.toContain("Reason: ${reason");
        expect(source).toContain("Fermé par **${closeBy}**");
        expect(source).toContain("Fermé par **${params.discordUserName}**");
    });

    it("renomme le salon à la clôture et le rétablit à la réouverture", () => {
        expect(source).toContain("renameTicketChannelOnClose");
        expect(source).toContain("restoreTicketChannelNameOnReopen");
        expect(source).toContain("closedChannelPattern");
    });

    it("la clôture est increvable (archives, CSAT) et le message de modération est nettoyé à la réouverture", () => {
        // Un PATCH 404 (message d'accueil disparu), une enquête impossible ou une
        // capture d'archives en échec ne doivent **jamais** annuler une clôture.
        expect(source).toContain("archives indisponibles — clôture poursuivie");
        expect(source).toContain("enquête de satisfaction en échec — clôture poursuivie");
        // Le message de modération est mémorisé puis supprimé à la réouverture
        // (sinon sa barre de boutons « fermé » reste un vestige).
        expect(source).toContain("moderationMessageId");
        expect(source).toContain("deleteChannelMessage");
    });
});
