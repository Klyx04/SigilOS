/**
 * Requêtes du tracker — filtres et pagination bornés (PR 1).
 *
 * Le `where` doit toujours porter une origine : sans elle, une requête membre
 * pourrait lire les notes internes God. La pagination ne doit jamais accepter
 * un `take` arbitraire venu du client.
 */

import { describe, it, expect } from "vitest";
import { buildMemberTrackerWhere, buildTrackerWhere, normalizePagination } from "@/lib/feedback-ticket-mapping";

describe("Pagination du tracker", () => {
    it("applique des valeurs par défaut sûres", () => {
        expect(normalizePagination()).toEqual({ page: 1, perPage: 20, skip: 0, take: 20 });
        expect(normalizePagination({})).toEqual({ page: 1, perPage: 20, skip: 0, take: 20 });
    });

    it("borne la page et la taille de page", () => {
        expect(normalizePagination({ page: 0, perPage: 0 })).toEqual({ page: 1, perPage: 1, skip: 0, take: 1 });
        expect(normalizePagination({ page: 99999, perPage: 9999 })).toEqual({
            page: 1000,
            perPage: 100,
            skip: 99_900,
            take: 100,
        });
    });

    it("ignore les valeurs non finies", () => {
        expect(normalizePagination({ page: Number.NaN, perPage: Number.POSITIVE_INFINITY })).toEqual({
            page: 1,
            perPage: 20,
            skip: 0,
            take: 20,
        });
    });
});

describe("Filtres du tracker", () => {
    it("impose toujours l'origine demandée", () => {
        expect(buildTrackerWhere(null, "FEEDBACK")).toEqual({ origin: "FEEDBACK" });
        expect(buildTrackerWhere({ search: "bug" }, "INTERNAL").origin).toBe("INTERNAL");
    });

    it("accepte une liste d'origines pour la console God", () => {
        expect(buildTrackerWhere({}, ["FEEDBACK", "INTERNAL"])).toEqual({
            origin: { in: ["FEEDBACK", "INTERNAL"] },
        });
    });

    it("ignore un statut inconnu plutôt que de l'écrire dans le where", () => {
        const where = buildTrackerWhere({ status: "STATUT_BIDON" }, "FEEDBACK");
        expect(where).not.toHaveProperty("trackerStatus");
    });

    it("conserve un statut valide et les filtres texte bornés", () => {
        const where = buildTrackerWhere(
            {
                status: "EN_COURS",
                feedbackType: "  BUG_TECHNIQUE  ",
                guild: "  Guilde  ",
                ref: "  SIG-42  ",
            },
            "FEEDBACK",
        );
        expect(where).toMatchObject({
            origin: "FEEDBACK",
            trackerStatus: "EN_COURS",
            feedbackType: "BUG_TECHNIQUE",
            memberGuildName: { contains: "Guilde", mode: "insensitive" },
            publicRef: "SIG-42",
        });
    });

    it("borne la recherche à 100 caractères", () => {
        const search = "x".repeat(500);
        const where = buildTrackerWhere({ search }, "FEEDBACK");
        const or = where.OR as { description?: { contains: string } }[];
        const descriptionEntry = or.find((entry) => entry.description !== undefined);
        expect(descriptionEntry?.description?.contains).toHaveLength(100);
    });

    it("une recherche vide ne crée pas de OR permissif", () => {
        expect(buildTrackerWhere({ search: "   " }, "FEEDBACK")).toEqual({ origin: "FEEDBACK" });
    });

    it("la recherche membre ne peut pas cibler une pseudo d'une autre guilde", () => {
        const where = buildMemberTrackerWhere({ search: "Pseudo" });
        const or = where.OR as Record<string, unknown>[];
        expect(or.some((entry) => "creatorDiscordName" in entry)).toBe(false);
        expect(where.publicRef).toEqual({ not: null });
    });

    it("une référence ciblée reste la seule clé publique demandée", () => {
        const where = buildMemberTrackerWhere({ ref: "SIG-42" });
        expect(where.publicRef).toBe("SIG-42");
    });
});
