import { describe, it, expect } from "vitest";
import {
    ENGAGEMENT_TOP_SIZE,
    buildFunnel,
    deriveGuildHealth,
    splitEngagement,
} from "@/lib/telemetry/aggregate";

/**
 * Chantier D-2 — règles d'agrégation de la télémétrie.
 * Ce fichier verrouille les trois régressions constatées dans l'écran God :
 * entonnoir à pourcentage négatif, « Guild Health Index » à seuils inventés,
 * « flop » déduit du bas d'un top 15 partiel.
 */

describe("buildFunnel — plus jamais de taux négatif", () => {
    it("renvoie un entonnoir vide pour une entrée vide", () => {
        expect(buildFunnel([])).toEqual([]);
    });

    it("calcule la perte et la part de la première marche", () => {
        const funnel = buildFunnel([
            { step: "Comptes créés", count: 1000 },
            { step: "Profils configurés", count: 500 },
            { step: "Membres actifs (7 j)", count: 250 },
        ]);

        expect(funnel.map((s) => s.count)).toEqual([1000, 500, 250]);
        expect(funnel.map((s) => s.dropoffRate)).toEqual([0, 50, 50]);
        expect(funnel.map((s) => s.conversionRate)).toEqual([100, 50, 25]);
        expect(funnel.every((s) => s.exceedsPrevious === false)).toBe(true);
    });

    it("signale une étape qui dépasse la précédente au lieu d'afficher une perte négative", () => {
        // Cas réel mesuré : 4 comptes (`User`) pour 5 profils (`UserProfile`) — populations distinctes.
        const funnel = buildFunnel([
            { step: "Comptes créés", count: 4 },
            { step: "Profils configurés", count: 5 },
        ]);

        expect(funnel[1]?.exceedsPrevious).toBe(true);
        expect(funnel[1]?.dropoffRate).toBe(0);
        expect(funnel[1]?.conversionRate).toBe(100);
        for (const step of funnel) {
            expect(step.dropoffRate).toBeGreaterThanOrEqual(0);
            expect(step.dropoffRate).toBeLessThanOrEqual(100);
            expect(step.conversionRate).toBeGreaterThanOrEqual(0);
            expect(step.conversionRate).toBeLessThanOrEqual(100);
        }
    });

    it("borne les effectifs aberrants (négatif, NaN, non entier)", () => {
        const funnel = buildFunnel([
            { step: "A", count: 10 },
            { step: "B", count: -3 },
            { step: "C", count: Number.NaN },
            { step: "D", count: 2.9 },
        ]);

        expect(funnel.map((s) => s.count)).toEqual([10, 0, 0, 2]);
        expect(funnel.every((s) => Number.isFinite(s.dropoffRate) && Number.isFinite(s.conversionRate))).toBe(true);
    });

    it("reste fini avec une base à zéro", () => {
        const funnel = buildFunnel([
            { step: "A", count: 0 },
            { step: "B", count: 0 },
        ]);

        expect(funnel.map((s) => s.conversionRate)).toEqual([0, 0]);
        expect(funnel.map((s) => s.dropoffRate)).toEqual([0, 0]);
    });
});

describe("deriveGuildHealth — statut dérivé de la distribution observée", () => {
    it("renvoie une liste vide sans guilde", () => {
        expect(deriveGuildHealth([])).toEqual([]);
    });

    it("étiquette une guilde sans activité DORMANT avec un rang 0", () => {
        const [guild] = deriveGuildHealth([{ id: "a", name: "Guilde A", actions7d: 0 }]);

        expect(guild).toMatchObject({
            id: "a",
            name: "Guilde A",
            actions7d: 0,
            healthStatus: "DORMANT",
            healthScore: 0,
            discordGuildId: null,
        });
    });

    it("classe par quartiles et rend un rang centile décroissant", () => {
        const health = deriveGuildHealth([
            { id: "a", name: "A", actions7d: 120 },
            { id: "b", name: "B", actions7d: 80 },
            { id: "c", name: "C", actions7d: 40 },
            { id: "d", name: "D", actions7d: 10 },
            { id: "e", name: "E", actions7d: 0 },
            { id: "f", name: "F", actions7d: 0 },
        ]);

        expect(health.map((g) => g.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
        expect(health.map((g) => g.healthStatus)).toEqual([
            "THRIVING",
            "HEALTHY",
            "AT_RISK",
            "AT_RISK",
            "DORMANT",
            "DORMANT",
        ]);
        expect(health.map((g) => g.healthScore)).toEqual([100, 83, 67, 50, 0, 0]);
    });

    it("garde au moins une guilde HEALTHY dès qu'il y a deux guildes actives", () => {
        const health = deriveGuildHealth([
            { id: "a", name: "A", actions7d: 50 },
            { id: "b", name: "B", actions7d: 10 },
        ]);

        expect(health.map((g) => g.healthStatus)).toEqual(["THRIVING", "HEALTHY"]);
    });

    it("ne dégrade jamais le statut d'une guilde plus active", () => {
        const health = deriveGuildHealth([
            { id: "a", name: "A", actions7d: 900 },
            { id: "b", name: "B", actions7d: 400 },
            { id: "c", name: "C", actions7d: 90 },
            { id: "d", name: "D", actions7d: 12 },
            { id: "e", name: "E", actions7d: 3 },
            { id: "f", name: "F", actions7d: 1 },
            { id: "g", name: "G", actions7d: 0 },
        ]);
        const rank = { THRIVING: 0, HEALTHY: 1, AT_RISK: 2, DORMANT: 3 } as const;

        for (const left of health) {
            for (const right of health) {
                if (left.actions7d > right.actions7d) {
                    expect(rank[left.healthStatus]).toBeLessThanOrEqual(rank[right.healthStatus]);
                }
            }
        }
    });

    it("normalise les compteurs aberrants avant classement", () => {
        const health = deriveGuildHealth([
            { id: "negatif", name: "Négatif", actions7d: -5 },
            { id: "actif", name: "Actif", actions7d: 42 },
            { id: "non-fini", name: "Non fini", actions7d: Number.NaN },
        ]);

        expect(health.map((g) => g.id)).toEqual(["actif", "negatif", "non-fini"]);
        expect(health[0]?.healthStatus).toBe("THRIVING");
        expect(health[1]?.actions7d).toBe(0);
        expect(health[2]?.actions7d).toBe(0);
    });

    it("conserve l'identifiant Discord de la guilde", () => {
        const [guild] = deriveGuildHealth([
            { id: "a", discordGuildId: "123456789012345678", name: "A", actions7d: 7 },
        ]);

        expect(guild.discordGuildId).toBe("123456789012345678");
    });
});

describe("splitEngagement — la queue ne recouvre jamais la tête", () => {
    it("renvoie une tête vide et une queue nulle sans donnée", () => {
        expect(splitEngagement([])).toEqual({
            top: [],
            tail: null,
            minDistinctForTail: ENGAGEMENT_TOP_SIZE * 2 + 1,
            distinctCount: 0,
        });
    });

    it("n'affiche pas de queue quand l'échantillon est trop pauvre", () => {
        const split = splitEngagement([1, 2, 3, 4, 5, 6, 7].map((count) => ({ elementId: `e${count}`, count })));

        expect(split.top).toHaveLength(7);
        expect(split.tail).toBeNull();
        expect(split.distinctCount).toBe(7);
        expect(split.minDistinctForTail).toBe(15);
    });

    it("sépare tête et queue sans doublon dès que l'échantillon le permet", () => {
        const items = Array.from({ length: 15 }, (_, index) => ({ elementId: `e${index + 1}`, count: index + 1 }));
        const split = splitEngagement(items);

        expect(split.top.map((item) => item.count)).toEqual([15, 14, 13, 12, 11, 10, 9]);
        expect(split.tail?.map((item) => item.count)).toEqual([1, 2, 3, 4, 5, 6, 7]);

        const topIds = new Set(split.top.map((item) => item.elementId));
        const overlap = (split.tail ?? []).filter((item) => topIds.has(item.elementId));
        expect(overlap).toEqual([]);
    });

    it("respecte une taille de tête personnalisée", () => {
        const items = [5, 4, 3, 2, 1].map((count) => ({ elementId: `e${count}`, count }));
        const split = splitEngagement(items, 2);

        expect(split.minDistinctForTail).toBe(5);
        expect(split.top.map((item) => item.count)).toEqual([5, 4]);
        expect(split.tail?.map((item) => item.count)).toEqual([1, 2]);
    });

    it("ne modifie pas le tableau d'entrée", () => {
        const items = [
            { elementId: "bas", count: 1 },
            { elementId: "haut", count: 9 },
        ];

        splitEngagement(items);

        expect(items.map((item) => item.elementId)).toEqual(["bas", "haut"]);
    });
});
