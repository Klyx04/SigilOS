import { describe, it, expect } from "vitest";
import { matchesOcreQuest } from "@/lib/metamob-client";

describe("matchesOcreQuest", () => {
    it("matche par slug (cas historique)", () => {
        expect(matchesOcreQuest({ slug: "quete-ocre-wylan", quest_template: { id: 9, monster_count: 10 } })).toBe(true);
        expect(matchesOcreQuest({ slug: "Eternelle-Moisson-2", quest_template: { id: 9, monster_count: 10 } })).toBe(true);
    });

    it("matche par modèle quand le slug est un nom personnalisé (ex. Draconiros)", () => {
        // Cas réel sondé : slug hexadécimal, template 1, 337 monstres.
        expect(matchesOcreQuest({ slug: "7d1219e9", quest_template: { id: 1, monster_count: 337 } })).toBe(true);
        expect(matchesOcreQuest({ slug: "draconiros", quest_template: { id: 2, monster_count: 50 } })).toBe(true);
        expect(matchesOcreQuest({ slug: "mon-suivi-perso", quest_template: { id: 7, monster_count: 250 } })).toBe(true);
    });

    it("rejette les quêtes qui ne ressemblent pas à une Ocre", () => {
        expect(matchesOcreQuest({ slug: "dokille-tracker", quest_template: { id: 7, monster_count: 20 } })).toBe(false);
        expect(matchesOcreQuest({ slug: null, quest_template: null })).toBe(false);
        expect(matchesOcreQuest({})).toBe(false);
    });
});
