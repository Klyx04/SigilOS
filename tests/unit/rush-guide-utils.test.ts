import { describe, it, expect } from "vitest";
import {
  parseCoordinates,
  isInfoSequence,
  isSequenceBlockedByPrereqs,
  findNextActionableSequence,
  formatProgressLabel,
  getMetierIconPath,
} from "@/lib/rush-guide-utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

describe("rush-guide-utils", () => {
  describe("parseCoordinates", () => {
    it("extrait correctement les coordonnées standard [x, y]", () => {
      const res = parseCoordinates("Aller voir le PNJ en [-1, 2] rapidement");
      expect(res).not.toBeNull();
      expect(res?.x).toBe(-1);
      expect(res?.y).toBe(2);
      expect(res?.worldId).toBeUndefined();
      expect(res?.raw).toBe("[-1, 2]");
      expect(res?.travelCommand).toBe("/travel -1,2");
    });

    it("extrait les coordonnées avec worldId [x, y, worldId]", () => {
      const res = parseCoordinates("Grotte en [15, -28, 1]");
      expect(res).not.toBeNull();
      expect(res?.x).toBe(15);
      expect(res?.y).toBe(-28);
      expect(res?.worldId).toBe(1);
      expect(res?.travelCommand).toBe("/travel 15,-28,1");
    });

    it("renvoie null si aucune coordonnée n'est présente", () => {
      expect(parseCoordinates("Parler au Capitaine")).toBeNull();
      expect(parseCoordinates("")).toBeNull();
    });
  });

  describe("isInfoSequence", () => {
    it("détecte une séquence informative", () => {
      const seq: RushSequence = {
        id: "seq-1",
        subGuideRef: "info",
        subGuideName: "Bannière d'information",
        isOptional: false,
        order: 1,
        activityTags: [{ type: "info_sequence" }],
      };
      expect(isInfoSequence(seq)).toBe(true);
    });

    it("renvoie false pour une séquence normale", () => {
      const seq: RushSequence = {
        id: "seq-2",
        subGuideRef: "q1",
        subGuideName: "Quête 1",
        isOptional: false,
        order: 2,
        activityTags: [{ type: "combat_solo" }],
      };
      expect(isInfoSequence(seq)).toBe(false);
    });
  });

  describe("isSequenceBlockedByPrereqs", () => {
    const mockMilestones: RushMilestone[] = [
      {
        id: "ms-1",
        chapter: 1,
        chapterLabel: "Chapitre 1",
        title: "Incarnam",
        order: 1,
        isOptional: false,
        sequences: [
          {
            id: "seq-prereq-1",
            subGuideRef: "q_pre",
            subGuideName: "Premiers pas",
            isOptional: false,
            order: 1,
          },
          {
            id: "seq-target",
            subGuideRef: "q_next",
            subGuideName: "Suite logique",
            isOptional: false,
            order: 2,
            activityTags: [
              { type: "prereq_text", name: "Premiers pas" },
            ],
          },
        ],
      },
    ];

    it("est bloqué si le prérequis n'est pas terminé", () => {
      const completedSeqIds = new Set<string>();
      const targetSeq = mockMilestones[0].sequences[1];
      const blocked = isSequenceBlockedByPrereqs(targetSeq, completedSeqIds, mockMilestones);
      expect(blocked).toBe(true);
    });

    it("n'est PAS bloqué si le prérequis est terminé", () => {
      const completedSeqIds = new Set<string>(["seq-prereq-1"]);
      const targetSeq = mockMilestones[0].sequences[1];
      const blocked = isSequenceBlockedByPrereqs(targetSeq, completedSeqIds, mockMilestones);
      expect(blocked).toBe(false);
    });

    it("n'est pas bloqué si aucun tag prereq_text", () => {
      const completedSeqIds = new Set<string>();
      const firstSeq = mockMilestones[0].sequences[0];
      expect(isSequenceBlockedByPrereqs(firstSeq, completedSeqIds, mockMilestones)).toBe(false);
    });
  });

  describe("findNextActionableSequence", () => {
    const mockMilestones: RushMilestone[] = [
      {
        id: "ms-1",
        chapter: 1,
        chapterLabel: "Chapitre 1",
        title: "Incarnam",
        order: 1,
        isOptional: false,
        sequences: [
          {
            id: "seq-1",
            subGuideRef: "q1",
            subGuideName: "Quête 1",
            isOptional: false,
            order: 1,
          },
          {
            id: "seq-2",
            subGuideRef: "q2",
            subGuideName: "Quête 2",
            isOptional: false,
            order: 2,
          },
        ],
      },
    ];

    it("priorise le bookmark si présent et non terminé", () => {
      const completed = new Set<string>();
      const next = findNextActionableSequence(mockMilestones, completed, "seq-2");
      expect(next?.sequence.id).toBe("seq-2");
    });

    it("retourne la première séquence non complétée sinon", () => {
      const completed = new Set<string>(["seq-1"]);
      const next = findNextActionableSequence(mockMilestones, completed);
      expect(next?.sequence.id).toBe("seq-2");
    });

    it("ignore les séquences de type info_sequence", () => {
      const milestonesWithInfo: RushMilestone[] = [
        {
          id: "ms-info",
          chapter: 1,
          chapterLabel: "Intro",
          title: "Conseils",
          order: 1,
          isOptional: false,
          sequences: [
            {
              id: "info-1",
              subGuideRef: "info",
              subGuideName: "Info importante",
              isOptional: false,
              order: 1,
              activityTags: [{ type: "info_sequence" }],
            },
            {
              id: "seq-real",
              subGuideRef: "real",
              subGuideName: "Vraie quête",
              isOptional: false,
              order: 2,
            },
          ],
        },
      ];

      const next = findNextActionableSequence(milestonesWithInfo, new Set());
      expect(next?.sequence.id).toBe("seq-real");
    });
  });

  describe("formatProgressLabel & getMetierIconPath", () => {
    it("formate avec unité explicite", () => {
      expect(formatProgressLabel(42, 156, "étapes")).toBe("42 / 156 étapes");
      expect(formatProgressLabel(4, 8, "quêtes")).toBe("4 / 8 quêtes");
    });

    it("normalise le nom de métier pour le chemin d'icône", () => {
      expect(getMetierIconPath("Façonneur")).toBe("/assets/rush-sylvestre/faconneur.png");
      expect(getMetierIconPath("Bûcheron")).toBe("/assets/rush-sylvestre/bucheron.png");
      expect(getMetierIconPath()).toBe("/assets/rush-sylvestre/façonneur.png");
    });
  });
});
