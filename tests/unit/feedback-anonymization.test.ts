/**
 * Tracker membre global — anonymisation inter-guildes (PR 1).
 *
 * Décision produit : tous les membres voient tous les signalements, mais la
 * pseudo n'est visible que par la guilde d'origine. Aucun identifiant interne
 * (cuid, Discord, user id) ni user-agent ne doit sortir de la projection.
 */

import { describe, it, expect } from "vitest";
import {
    anonymousMemberLabel,
    projectMemberTrackerTicket,
    type TrackerTicketRecord,
} from "@/lib/feedback-ticket-mapping";

const baseTicket: TrackerTicketRecord = {
    publicRef: "SIG-42",
    category: "BUG_REPORT",
    trackerStatus: "A_FAIRE",
    feedbackType: "BUG_TECHNIQUE",
    description: "Le bouton ne répond pas",
    sourcePage: "hub-dofus",
    targetSlug: "ocre",
    forumLink: null,
    createdAt: new Date("2026-11-13T10:00:00.000Z"),
    creatorDiscordName: "PseudoVisible",
    memberGuildName: "Guilde Origine",
    guildId: "guild-internal-1",
    transcript: [
        { kind: "member_reply", message: "C'est corrigé", emoji: "🎉", at: "2026-11-14T10:00:00.000Z", byUserId: "god-1" },
    ],
};

describe("Anonymisation du tracker membre", () => {
    it("affiche la pseudo dans la guilde d'origine", () => {
        const projected = projectMemberTrackerTicket(baseTicket, "guild-internal-1");
        expect(projected.memberName).toBe("PseudoVisible");
        expect(projected.memberGuildName).toBe("Guilde Origine");
        expect(projected.replies).toHaveLength(1);
    });

    it("masque la pseudo hors de la guilde d'origine mais garde le nom de guilde", () => {
        const projected = projectMemberTrackerTicket(baseTicket, "guild-internal-2");
        expect(projected.memberName).toBeNull();
        expect(projected.memberGuildName).toBe("Guilde Origine");
    });

    it("masque la pseudo quand le signalement n'a pas de guilde", () => {
        const projected = projectMemberTrackerTicket({ ...baseTicket, guildId: null }, "guild-internal-1");
        expect(projected.memberName).toBeNull();
    });

    it("ne laisse sortir aucun identifiant interne ni user-agent", () => {
        const projected = projectMemberTrackerTicket(
            {
                ...baseTicket,
                creatorDiscordId: "123456789012345678",
                creatorUserId: "user-1",
                userAgent: "Mozilla/5.0",
                guildId: "guild-internal-1",
            } as TrackerTicketRecord,
            "guild-internal-1",
        );
        const serialized = JSON.stringify(projected);
        expect(serialized).not.toContain("123456789012345678");
        expect(serialized).not.toContain("user-1");
        expect(serialized).not.toContain("Mozilla/5.0");
        expect(serialized).not.toContain("guild-internal-1");
        expect(projected).not.toHaveProperty("creatorDiscordId");
        expect(projected).not.toHaveProperty("creatorUserId");
        expect(projected).not.toHaveProperty("userAgent");
        expect(projected).not.toHaveProperty("id");
    });

    it("nomme les autres guildes sans jamais révéler la pseudo", () => {
        expect(anonymousMemberLabel("Guilde Origine")).toBe("Membre de la guilde Guilde Origine");
        expect(anonymousMemberLabel(null)).toBe("Membre de la plateforme");
        expect(anonymousMemberLabel("  ")).toBe("Membre de la plateforme");
    });
});
