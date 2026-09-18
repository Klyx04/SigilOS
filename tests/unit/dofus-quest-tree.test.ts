import { describe, it, expect } from "vitest";
import {
    ACHIEVEMENT_KIND,
    buildQuestTree,
    collectSubtreeIds,
    collectSubtreeQuestIds,
    defaultEntryWeight,
    filterTreeEntries,
    isAchievement,
    nodeProgress,
    questProgress,
    sumQuestProgress,
    wouldCreateCycle,
    type QuestTreeEntry,
} from "@/lib/dofus-quest-tree";

/** Entrée de test : quête jouable, ou succès conteneur via `a()`. */
function q(id: string, stepOrder = 0, parentEntryId: string | null = null): QuestTreeEntry {
    return { id, name: id, entryKind: "QUEST", parentEntryId, stepOrder };
}
function a(id: string, stepOrder = 0, parentEntryId: string | null = null): QuestTreeEntry {
    return { id, name: id, entryKind: ACHIEVEMENT_KIND, parentEntryId, stepOrder };
}

describe("dofus-quest-tree — type d'entrée", () => {
    it("considère l'absence d'entryKind comme une quête (compat données historiques)", () => {
        expect(isAchievement({})).toBe(false);
        expect(isAchievement({ entryKind: null })).toBe(false);
        expect(isAchievement({ entryKind: "QUEST" })).toBe(false);
        expect(isAchievement({ entryKind: ACHIEVEMENT_KIND })).toBe(true);
    });

    it("donne un poids 0 à un succès conteneur (il ne compte pas comme étape)", () => {
        expect(defaultEntryWeight(ACHIEVEMENT_KIND)).toBe(0);
        expect(defaultEntryWeight("QUEST")).toBe(1);
        expect(defaultEntryWeight(undefined)).toBe(1);
    });
});

describe("buildQuestTree — arbre des succès imbriqués", () => {
    it("rend une section plate (format historique) telle quelle", () => {
        const tree = buildQuestTree([q("b", 1), q("a", 0)]);
        expect(tree.roots.map((e) => e.id)).toEqual(["a", "b"]);
        expect(tree.quests.map((e) => e.id)).toEqual(["a", "b"]);
        expect(tree.depthById.get("a")).toBe(0);
    });

    it("imbrique les objectifs sous un succès conteneur (3 niveaux)", () => {
        // Le pays des Vermeils → Même pas malle → ses quêtes
        const tree = buildQuestTree([
            a("vermeils", 0),
            a("meme-pas-malle", 0, "vermeils"),
            q("coffrer", 0, "meme-pas-malle"),
            q("pompe-a-fric", 1, "meme-pas-malle"),
            q("parler-enutrof", 1, "vermeils"),
        ]);

        expect(tree.roots.map((e) => e.id)).toEqual(["vermeils"]);
        expect(tree.childrenByParent.get("vermeils")!.map((e) => e.id)).toEqual(["meme-pas-malle", "parler-enutrof"]);
        expect(tree.depthById.get("coffrer")).toBe(2);
        // DFS : le succès conteneur lui-même n'est pas une quête.
        expect(tree.quests.map((e) => e.id)).toEqual(["coffrer", "pompe-a-fric", "parler-enutrof"]);
    });

    it("remonte à la racine un objectif dont le parent n'existe pas (jamais perdu)", () => {
        const tree = buildQuestTree([q("orpheline", 0, "succes-supprime")]);
        expect(tree.roots.map((e) => e.id)).toEqual(["orpheline"]);
        expect(tree.quests.map((e) => e.id)).toEqual(["orpheline"]);
    });

    it("coupe un lien cyclique (A → B → A) au lieu de boucler", () => {
        const tree = buildQuestTree([a("A", 0, "B"), a("B", 0, "A"), q("C", 0, "A")]);
        expect(tree.roots.map((e) => e.id).sort()).toEqual(["A", "B"]);
        expect(tree.childrenByParent.get("A")!.map((e) => e.id)).toEqual(["C"]);
        expect(tree.quests.map((e) => e.id)).toEqual(["C"]);
    });

    it("refuse un parent qui n'est pas un succès (quête → quête)", () => {
        const tree = buildQuestTree([q("parent-quete", 0), q("enfant", 0, "parent-quete")]);
        // Tri déterministe (stepOrder puis id) : les deux repassent à la racine.
        expect(tree.roots.map((e) => e.id)).toEqual(["enfant", "parent-quete"]);
        expect(tree.childrenByParent.size).toBe(0);
    });
});

describe("progression avec succès imbriqués", () => {
    const entries = [
        a("vermeils"),
        a("meme-pas-malle", 0, "vermeils"),
        q("coffrer", 0, "meme-pas-malle"),
        q("pompe-a-fric", 1, "meme-pas-malle"),
        q("parler-enutrof", 1, "vermeils"),
    ];
    const tree = buildQuestTree(entries);

    it("compte les quêtes du sous-arbre d'un succès", () => {
        const completed = new Set(["coffrer", "pompe-a-fric"]);
        const inner = nodeProgress(tree, entries[1], completed);
        expect(inner).toEqual({ completed: 2, total: 2, percent: 100 });

        const outer = nodeProgress(tree, entries[0], completed);
        expect(outer).toEqual({ completed: 2, total: 3, percent: 67 });
    });

    it("ignore les succès conteneurs dans les compteurs globaux", () => {
        const progress = questProgress(tree, new Set(["coffrer"]));
        expect(progress).toEqual({ completed: 1, total: 3, percent: 33 });
    });

    it("liste les quêtes d'un sous-arbre dans l'ordre d'affichage", () => {
        expect(collectSubtreeQuestIds(tree, "vermeils")).toEqual(["coffrer", "pompe-a-fric", "parler-enutrof"]);
        expect(collectSubtreeIds(tree, "meme-pas-malle")).toEqual(["meme-pas-malle", "coffrer", "pompe-a-fric"]);
    });

    it("fusionne les compteurs de plusieurs sections", () => {
        expect(sumQuestProgress([{ completed: 2, total: 3 }, { completed: 1, total: 1 }]))
            .toEqual({ completed: 3, total: 4, percent: 75 });
        expect(sumQuestProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
    });
});

describe("garde-fous et filtres", () => {
    const entries = [a("vermeils"), a("meme-pas-malle", 0, "vermeils"), q("coffrer", 0, "meme-pas-malle")];

    it("détecte un cycle avant enregistrement (parent = soi-même ou descendant)", () => {
        expect(wouldCreateCycle(entries, "vermeils", "vermeils")).toBe(true);
        expect(wouldCreateCycle(entries, "vermeils", "meme-pas-malle")).toBe(true);
        expect(wouldCreateCycle(entries, "meme-pas-malle", "vermeils")).toBe(false);
        expect(wouldCreateCycle(entries, "coffrer", null)).toBe(false);
        expect(wouldCreateCycle(entries, "nouvelle-quete", "meme-pas-malle")).toBe(false);
    });

    it("conserve les succès parents d'un objectif trouvé par la recherche", () => {
        const filtered = filterTreeEntries(entries, (e) => e.id === "coffrer");
        expect(filtered.map((e) => e.id)).toEqual(["vermeils", "meme-pas-malle", "coffrer"]);
    });
});
