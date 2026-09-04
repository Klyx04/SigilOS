import { describe, it, expect } from "vitest";
import {
  parseCoordinates,
  getSequenceCoord,
  isInfoSequence,
  isSequenceBlockedByPrereqs,
  findNextActionableSequence,
  formatProgressLabel,
  getMetierIconPath,
  resolveItemImage,
  getItemImageFallback,
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

    it("extrait le format « pos_tags » saisi au GOD sans crochets (x, y)", () => {
      const res = parseCoordinates("-81, -37");
      expect(res).not.toBeNull();
      expect(res?.x).toBe(-81);
      expect(res?.y).toBe(-37);
      expect(res?.worldId).toBeUndefined();
      expect(res?.travelCommand).toBe("/travel -81,-37");
    });

    it("extrait la première coordonnée d'une liste pos_tags multi-points", () => {
      const res = parseCoordinates("-2, 0 ; 10, -22");
      expect(res).not.toBeNull();
      expect(res?.x).toBe(-2);
      expect(res?.y).toBe(0);
    });
  });

  describe("getSequenceCoord", () => {
    it("priorise le tag pos_tags sur le titre/tips", () => {
      const seq: RushSequence = {
        id: "s1",
        subGuideRef: "Quête sans coords dans le titre",
        subGuideName: "Quête sans coords dans le titre",
        isOptional: false,
        order: 0,
        tips: "Position de lancement : Incarnam [2, -3]",
        activityTags: [{ type: "pos_tags", name: "-81, -37" }],
      };
      const res = getSequenceCoord(seq);
      expect(res?.x).toBe(-81);
      expect(res?.y).toBe(-37);
    });

    it("retombe sur les tips en l'absence de pos_tags", () => {
      const seq: RushSequence = {
        id: "s2",
        subGuideRef: "Q",
        subGuideName: "Q",
        isOptional: false,
        order: 0,
        tips: "Allez en [-12, 34]",
      };
      const res = getSequenceCoord(seq);
      expect(res?.x).toBe(-12);
      expect(res?.y).toBe(34);
    });

    it("renvoie null sans aucune coordonnée", () => {
      const seq: RushSequence = {
        id: "s3",
        subGuideRef: "Sans coordonnée",
        subGuideName: "Sans coordonnée",
        isOptional: false,
        order: 0,
      };
      expect(getSequenceCoord(seq)).toBeNull();
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
      expect(getMetierIconPath()).toBe("/assets/rush-sylvestre/faconneur.png");
    });
  });

  describe("resolveItemImage (locale-first)", () => {
    it("sert directement un chemin local fourni (statique, sans proxy)", () => {
      expect(resolveItemImage(14635, "/uploads/assets-dofus/items/14635.webp")).toBe(
        "/uploads/assets-dofus/items/14635.webp"
      );
      expect(resolveItemImage(7018, "/assets-dofus/items/7018.webp")).toBe("/assets-dofus/items/7018.webp");
    });

    it("résout un id numérique vers le WebP local siphonné (autonomie)", () => {
      expect(resolveItemImage(15990, "https://api.dofusdb.fr/img/items/3086.png")).toBe(
        "/uploads/assets-dofus/items/15990.webp"
      );
      expect(resolveItemImage("14635")).toBe("/uploads/assets-dofus/items/14635.webp");
    });

    it("bascule sur le proxy pour un id non numérique (fallback ?url=)", () => {
      const out = resolveItemImage("cmrwd97k", "https://api.dofusdb.fr/img/items/1.png");
      expect(out).toBe("/api/assets-dofus/items/cmrwd97k?url=" + encodeURIComponent("https://api.dofusdb.fr/img/items/1.png"));
    });

    it("renvoie l'URL distante / vide en dernier recours", () => {
      expect(resolveItemImage(undefined, "https://cdn.example/img.png")).toBe("https://cdn.example/img.png");
      expect(resolveItemImage(undefined, undefined)).toBe("");
    });
  });

  describe("getItemImageFallback (proxy)", () => {
    it("passe l'URL distante comme source ?url=", () => {
      const out = getItemImageFallback(15990, "https://api.dofusdb.fr/img/items/3086.png");
      expect(out).toBe("/api/assets-dofus/items/15990?url=" + encodeURIComponent("https://api.dofusdb.fr/img/items/3086.png"));
    });

    it("ignore un chemin local (pas une source distante)", () => {
      expect(getItemImageFallback(14635, "/uploads/assets-dofus/items/14635.webp")).toBe(
        "/api/assets-dofus/items/14635"
      );
    });

    it("renvoie l'URL distante sans id", () => {
      expect(getItemImageFallback(undefined, "https://cdn.example/img.png")).toBe("https://cdn.example/img.png");
    });
  });
});
