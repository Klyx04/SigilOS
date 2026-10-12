import { describe, expect, it } from "vitest";
import {
    QUEST_CONTENT_VERSION,
    buildQuestContentDigest,
    countQuestObjectives,
    questContentHash,
    readQuestContentDigest,
} from "@/lib/quest-content";

/** Réponse DofusDB réduite (`/quests/18`) — deux étapes, textes multilingues. */
const remoteQuest = {
    id: 18,
    name: { fr: "Wogew l'hewmite", en: "Wogew the Hermit" },
    updatedAt: "2026-06-23T11:49:43.210Z",
    steps: [
        {
            id: 55,
            name: { fr: "Le sang du wabbit GM", en: "The GM Wabbit's Blood" },
            rewards: [{ kamasRatio: 0, experienceRatio: 12, itemsRewardIds: [12076, 5] }],
            objectives: [
                { id: 115, className: "QuestObjectiveFightMonsterData", text: { fr: "Vaincre x1 {monster,182}" }, mapId: 0 },
                { id: 102, className: "QuestObjectiveDiscoverMapData", text: { fr: "Découvrir la carte : Laboratoire Wabbit" }, mapId: 0 },
            ],
        },
        {
            id: 57,
            name: { fr: "Rendre la seringue" },
            rewards: [],
            objectives: [{ id: 130, className: "QuestObjectiveGoToNpcData", text: { fr: "Parler à Wogew" }, mapId: 0 }],
        },
    ],
};

describe("contenu des quêtes — résumé canonique (FR borné)", () => {
    it("ne garde que le français et trie étapes/objectifs (déterministe)", () => {
        const digest = buildQuestContentDigest(remoteQuest);
        expect(digest.version).toBe(QUEST_CONTENT_VERSION);
        expect(digest.steps.map((s) => s.id)).toEqual([55, 57]);
        expect(digest.steps[0].objectives.map((o) => o.id)).toEqual([102, 115]);
        const json = JSON.stringify(digest);
        expect(json).not.toContain("The GM Wabbit");
        expect(json).toContain("Le sang du wabbit GM");
        expect(countQuestObjectives(digest)).toBe(3);
    });

    it("résume les récompenses (ratios + ids d'objets triés)", () => {
        const digest = buildQuestContentDigest(remoteQuest);
        expect(digest.steps[0].rewards).toEqual({
            kamasRatio: 0,
            experienceRatio: 12,
            itemIds: [5, 12076],
        });
    });

    it("accepte une quête sans étapes (jamais d'exception)", () => {
        const digest = buildQuestContentDigest({ id: 1, name: { fr: "Vide" } });
        expect(digest.steps).toEqual([]);
        expect(countQuestObjectives(digest)).toBe(0);
    });

    it("empreinte stable : un contenu identique donne le même hash", () => {
        const a = questContentHash(buildQuestContentDigest(remoteQuest));
        const b = questContentHash(buildQuestContentDigest(remoteQuest));
        expect(a).toBe(b);
        expect(a).toMatch(/^[0-9a-f]{32}$/);
    });

    it("empreinte sensible : un texte d'objectif modifié change le hash", () => {
        const before = questContentHash(buildQuestContentDigest(remoteQuest));
        const modified = JSON.parse(JSON.stringify(remoteQuest));
        modified.steps[1].objectives[0].text.fr = "Parler à Wogew (modifié)";
        const after = questContentHash(buildQuestContentDigest(modified));
        expect(after).not.toBe(before);
    });

    it("relit un résumé stocké et refuse une forme inconnue (version)", () => {
        const digest = buildQuestContentDigest(remoteQuest);
        expect(readQuestContentDigest(digest)?.steps).toHaveLength(2);
        expect(readQuestContentDigest({ version: 99, steps: [] })).toBeNull();
        expect(readQuestContentDigest(null)).toBeNull();
        expect(readQuestContentDigest({ steps: [] })).toBeNull();
    });
});
