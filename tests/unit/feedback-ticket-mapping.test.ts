/**
 * Fusion « signalements » → `SupportTicket` — correspondances (PR 1).
 *
 * Ces règles sont la seule source de vérité du backfill et de la bascule :
 * une erreur ici écrirait un signalement dans la mauvaise catégorie ou
 * fermerait un ticket encore ouvert.
 */

import { describe, it, expect } from "vitest";
import {
    appendMemberReplyToTranscript,
    buildFeedbackSubject,
    buildLegacyPublicRef,
    buildLegacySubject,
    buildMemberReplyEntry,
    buildTicketPublicRef,
    feedbackTypeToCategory,
    legacyIssueOrigin,
    legacyTypeToCategory,
    publicRepliesFromTranscript,
    trackerStatusToTicketStatus,
} from "@/lib/feedback-ticket-mapping";

describe("Correspondances signalement → ticket", () => {
    it("range les bugs techniques et erreurs de données dans BUG_REPORT", () => {
        expect(feedbackTypeToCategory("BUG_TECHNIQUE")).toBe("BUG_REPORT");
        expect(feedbackTypeToCategory("ERREUR_DONNEES")).toBe("BUG_REPORT");
    });

    it("range les améliorations et les autres retours dans FEATURE_REQUEST", () => {
        expect(feedbackTypeToCategory("AMELIORATION")).toBe("FEATURE_REQUEST");
        expect(feedbackTypeToCategory("NOUVELLE_FONCTIONNALITE")).toBe("FEATURE_REQUEST");
        expect(feedbackTypeToCategory("COQUILLE")).toBe("FEATURE_REQUEST");
        expect(feedbackTypeToCategory("AFFICHAGE")).toBe("FEATURE_REQUEST");
        expect(feedbackTypeToCategory("AUTRE")).toBe("FEATURE_REQUEST");
    });

    it("conserve la correspondance historique des anciens types", () => {
        expect(legacyTypeToCategory("BUG")).toBe("BUG_REPORT");
        expect(legacyTypeToCategory("AMELIORATION")).toBe("FEATURE_REQUEST");
    });

    it("traduit le statut de suivi en statut de ticket", () => {
        expect(trackerStatusToTicketStatus("A_FAIRE")).toBe("OPEN");
        expect(trackerStatusToTicketStatus("A_INVESTIGUER")).toBe("IN_PROGRESS");
        expect(trackerStatusToTicketStatus("EN_COURS")).toBe("IN_PROGRESS");
        expect(trackerStatusToTicketStatus("TERMINE")).toBe("CLOSED");
        expect(trackerStatusToTicketStatus("IGNORE")).toBe("CLOSED");
    });

    it("distingue un signalement membre d'une note interne God", () => {
        expect(legacyIssueOrigin({ feedbackType: "BUG_TECHNIQUE" })).toBe("FEEDBACK");
        expect(legacyIssueOrigin({ feedbackType: "  " })).toBe("INTERNAL");
        expect(legacyIssueOrigin({ feedbackType: null })).toBe("INTERNAL");
    });

    it("garde les liens historiques SIG-<id> et une référence publique pour les nouveaux tickets", () => {
        expect(buildLegacyPublicRef(42)).toBe("SIG-42");
        expect(buildTicketPublicRef(7)).toBe("SIG-7");
        expect(() => buildLegacyPublicRef(0)).toThrow();
        expect(() => buildTicketPublicRef(-1)).toThrow();
    });

    it("borne et nettoie le sujet sans perdre la description complète", () => {
        const subject = buildFeedbackSubject("BUG_TECHNIQUE", "  Ligne 1\n\nLigne 2   avec   espaces  ");
        expect(subject).toBe("[BUG_TECHNIQUE] Ligne 1 Ligne 2 avec espaces");
        expect(subject.length).toBeLessThanOrEqual(120);
        expect(buildLegacySubject({ type: "AMELIORATION", feedbackType: null, description: "Idée" }))
            .toBe("[AMELIORATION] Idée");
    });
});

describe("Réponses publiques du tracker", () => {
    it("ne projette que les réponses destinées au membre", () => {
        const replies = publicRepliesFromTranscript([
            { kind: "internal_note", message: "note privée", at: "2026-01-01T00:00:00.000Z" },
            { kind: "member_reply", message: "  Merci pour ton retour  ", emoji: "🎉", at: "2026-01-02T00:00:00.000Z", byUserId: "god-1" },
        ]);

        expect(replies).toEqual([
            { message: "Merci pour ton retour", emoji: "🎉", at: "2026-01-02T00:00:00.000Z" },
        ]);
        expect(JSON.stringify(replies)).not.toContain("god-1");
    });

    it("accepte un transcript objet et borne à 20 réponses", () => {
        const replies = publicRepliesFromTranscript({
            replies: Array.from({ length: 25 }, (_, index) => ({
                kind: "member_reply",
                message: `réponse ${index}`,
                at: "2026-01-01T00:00:00.000Z",
            })),
        });
        expect(replies).toHaveLength(20);
        expect(replies[0]?.message).toBe("réponse 5");
    });

    it("journalise une réponse sans écraser un transcript support", () => {
        const entry = buildMemberReplyEntry("Bien reçu", "🎉", "god-1", new Date("2026-01-01T00:00:00.000Z"));

        expect(appendMemberReplyToTranscript(null, entry)).toEqual([entry]);
        expect(appendMemberReplyToTranscript([{ kind: "old" }], entry)).toEqual([{ kind: "old" }, entry]);
        expect(appendMemberReplyToTranscript({ channel: "discord", replies: [{ kind: "old" }] }, entry)).toEqual({
            channel: "discord",
            replies: [{ kind: "old" }, entry],
        });
    });
});
