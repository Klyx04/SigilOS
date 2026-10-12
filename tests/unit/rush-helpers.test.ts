import { describe, it, expect } from "vitest";
import {
  getRequiredMetiers,
  getRequiredDungeons,
  getRequiredAlignment,
  getAlignmentSet,
  collectCascadeUncheck,
  matchMetier,
  matchDungeon,
  matchAlignment,
  findSequenceHelpers,
} from "@/lib/rush-helpers";
import type { RushHelperProfile } from "@/lib/rush-helpers";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

function makeSeq(overrides: Partial<RushSequence> = {}): RushSequence {
  return {
    id: "seq-1",
    subGuideRef: "q1",
    subGuideName: "Quête 1",
    isOptional: false,
    order: 1,
    ...overrides,
  };
}

describe("rush-helpers", () => {
  describe("getRequiredMetiers", () => {
    it("renvoie [] sans tag métier", () => {
      expect(getRequiredMetiers(makeSeq())).toEqual([]);
    });

    it("extrait un métier avec son niveau", () => {
      const seq = makeSeq({
        activityTags: [{ type: "metier", name: "Façonneur", level: 200 }],
      });
      expect(getRequiredMetiers(seq)).toEqual([{ name: "Façonneur", level: 200 }]);
    });

    it("extrait plusieurs métiers", () => {
      const seq = makeSeq({
        activityTags: [
          { type: "metier", name: "Taillleur", level: 100 },
          { type: "metier", name: "Forgeron" },
        ],
      });
      const res = getRequiredMetiers(seq);
      expect(res).toHaveLength(2);
      expect(res[0]).toEqual({ name: "Taillleur", level: 100 });
      expect(res[1]).toEqual({ name: "Forgeron", level: undefined });
    });

    it("ignore les tags sans nom", () => {
      const seq = makeSeq({ activityTags: [{ type: "metier" }, { type: "donjon", name: "X" }] });
      expect(getRequiredMetiers(seq)).toEqual([]);
    });
  });

  describe("getRequiredDungeons", () => {
    it("extrait le donjon singulier", () => {
      const seq = makeSeq({ dungeon: { id: "d1", name: "Donjon A" } });
      expect(getRequiredDungeons(seq)).toEqual([{ id: "d1", name: "Donjon A" }]);
    });

    it("extrait le tableau de donjons (dédupliqué)", () => {
      const seq = makeSeq({
        dungeons: [
          { id: "d1", name: "Donjon A" },
          { id: "d1", name: "Donjon A" },
          { id: "d2", name: "Donjon B" },
        ],
      });
      expect(getRequiredDungeons(seq)).toEqual([
        { id: "d1", name: "Donjon A" },
        { id: "d2", name: "Donjon B" },
      ]);
    });

    it("fait un fallback sur les tags donjon/ocre_dungeon", () => {
      const seq = makeSeq({
        activityTags: [{ type: "ocre_dungeon", name: "Éternelle Moisson" }],
      });
      expect(getRequiredDungeons(seq)).toEqual([{ id: "Éternelle Moisson", name: "Éternelle Moisson" }]);
    });

    it("renvoie [] sans référence donjon", () => {
      expect(getRequiredDungeons(makeSeq())).toEqual([]);
    });
  });

  describe("getRequiredAlignment", () => {
    it("renvoie null sans alignReq", () => {
      expect(getRequiredAlignment(makeSeq())).toBeNull();
    });

    it("extrait le camp + la tranche", () => {
      const seq = makeSeq({ alignReq: "bontarien", alignOrderReq: 80 });
      expect(getRequiredAlignment(seq)).toEqual({ alignment: "bontarien", level: 80 });
    });

    it("extrait le camp sans tranche si alignOrderReq absent", () => {
      const seq = makeSeq({ alignReq: "brakmarien" });
      expect(getRequiredAlignment(seq)).toEqual({ alignment: "brakmarien", level: undefined });
    });
  });

  describe("getAlignmentSet", () => {
    it("renvoie null si aucun tag alignment_set", () => {
      expect(getAlignmentSet(makeSeq())).toBeNull();
    });

    it("lit le camp + niveau du tag", () => {
      const seq = makeSeq({
        activityTags: [{ type: "alignment_set", name: "bontarien", level: 38 }],
      });
      expect(getAlignmentSet(seq)).toEqual({ camp: "bontarien", level: 38 });
    });

    it("borne le niveau entre 0 et 100", () => {
      const seq = makeSeq({
        activityTags: [{ type: "alignment_set", name: "brakmarien", level: 120 }],
      });
      expect(getAlignmentSet(seq)).toEqual({ camp: "brakmarien", level: 100 });
    });

    it("retourne niveau 0 si le tag n'a pas de niveau", () => {
      const seq = makeSeq({ activityTags: [{ type: "alignment_set", name: "bontarien" }] });
      expect(getAlignmentSet(seq)).toEqual({ camp: "bontarien", level: 0 });
    });

    it("renvoie null si le tag est sans nom", () => {
      const seq = makeSeq({ activityTags: [{ type: "alignment_set" }] });
      expect(getAlignmentSet(seq)).toBeNull();
    });
  });

  describe("collectCascadeUncheck", () => {
    const milestones: RushMilestone[] = [
      {
        id: "ms-1",
        chapter: 1,
        chapterLabel: "Ch1",
        title: "Prérequis Incarnam",
        order: 1,
        isOptional: false,
        sequences: [
          {
            id: "q1",
            subGuideRef: "q1",
            subGuideName: "L'anneau de tous les dangers",
            isOptional: false,
            order: 1,
            activityTags: [{ type: "alignment_set", name: "bontarien", level: 1 }],
          },
          {
            id: "q2",
            subGuideRef: "q2",
            subGuideName: "Sous le regard des dieux",
            isOptional: false,
            order: 2,
            activityTags: [
              { type: "prereq_text", name: "L'anneau de tous les dangers" },
              { type: "alignment_set", name: "bontarien", level: 2 },
            ],
          },
        ],
      },
    ];

    it("décoche la cible et ses dépendantes (transitives)", () => {
      const completed = new Set<string>(["q1", "q2"]);
      // Décocher q1 (prérequis) → q2 devient bloquée → cascade sur q2.
      const cascade = collectCascadeUncheck("q1", milestones, completed);
      expect(cascade.has("q1")).toBe(true);
      expect(cascade.has("q2")).toBe(true);
    });

    it("ne cascade pas si aucune dépendante n'est cochée", () => {
      const completed = new Set<string>(["q1"]);
      const cascade = collectCascadeUncheck("q1", milestones, completed);
      expect(cascade).toEqual(new Set(["q1"]));
    });

    it("décocher une feuille n'entraîne rien de plus", () => {
      const completed = new Set<string>(["q1", "q2"]);
      // Décocher q2 (n'a pas de dépendante) → seule q2.
      const cascade = collectCascadeUncheck("q2", milestones, completed);
      expect(cascade).toEqual(new Set(["q2"]));
    });
  });

  describe("matchMetier", () => {
    const faconneur200: RushHelperProfile = {
      profileId: "p1",
      metiers: [{ name: "Façonneur", level: 200 }],
    };

    it("matche nom + niveau suffisant", () => {
      const r = matchMetier({ name: "Façonneur", level: 200 }, faconneur200);
      expect(r.can).toBe(true);
      expect(r.memberLevel).toBe(200);
      expect(r.levelUnknown).toBe(false);
    });

    it("refuse un niveau insuffisant", () => {
      const m: RushHelperProfile = { profileId: "p2", metiers: [{ name: "Façonneur", level: 150 }] };
      const r = matchMetier({ name: "Façonneur", level: 200 }, m);
      expect(r.can).toBe(false);
      expect(r.levelUnknown).toBe(false);
    });

    it("accepte un niveau supérieur au requis", () => {
      const m: RushHelperProfile = { profileId: "p3", metiers: [{ name: "Façonneur", level: 200 }] };
      expect(matchMetier({ name: "Façonneur", level: 150 }, m).can).toBe(true);
    });

    it("niveau membre inconnu (format legacy) → indéterminé", () => {
      const m: RushHelperProfile = { profileId: "p4", metiers: ["Façonneur"] };
      const r = matchMetier({ name: "Façonneur", level: 200 }, m);
      expect(r.can).toBe(false);
      expect(r.levelUnknown).toBe(true);
    });

    it("pas de niveau requis → le nom suffit", () => {
      const r = matchMetier({ name: "Façonneur" }, { profileId: "p5", metiers: ["Façonneur"] });
      expect(r.can).toBe(true);
      expect(r.levelUnknown).toBe(false);
    });

    it("le membre sans le métier ne matche pas", () => {
      const m: RushHelperProfile = { profileId: "p6", metiers: ["Forgeron"] };
      expect(matchMetier({ name: "Façonneur", level: 200 }, m).can).toBe(false);
    });
  });

  describe("matchDungeon", () => {
    it("matche par id", () => {
      const m: RushHelperProfile = { profileId: "p1", completedDungeonIds: ["d1"] };
      expect(matchDungeon({ id: "d1", name: "Donjon A" }, m).can).toBe(true);
    });

    it("matche par nom (insensible casse/accents) si pas d'id", () => {
      const m: RushHelperProfile = { profileId: "p2", completedDungeonNames: ["donjon A"] };
      expect(matchDungeon({ id: "d2", name: "Donjon A" }, m).can).toBe(true);
    });

    it("ne matche pas sans progression", () => {
      const m: RushHelperProfile = { profileId: "p3" };
      expect(matchDungeon({ id: "d1", name: "Donjon A" }, m).can).toBe(false);
    });
  });

  describe("matchAlignment", () => {
    it("matche le camp + tranche suffisante", () => {
      const m: RushHelperProfile = { profileId: "p1", alignment: "bontarien", alignmentLevel: 80 };
      const r = matchAlignment({ alignment: "bontarien", level: 80 }, m);
      expect(r.can).toBe(true);
      expect(r.memberLevel).toBe(80);
      expect(r.levelUnknown).toBe(false);
    });

    it("refuse une tranche insuffisante", () => {
      const m: RushHelperProfile = { profileId: "p2", alignment: "bontarien", alignmentLevel: 50 };
      expect(matchAlignment({ alignment: "bontarien", level: 80 }, m).can).toBe(false);
    });

    it("refuse un camp différent", () => {
      const m: RushHelperProfile = { profileId: "p3", alignment: "brakmarien", alignmentLevel: 80 };
      expect(matchAlignment({ alignment: "bontarien", level: 80 }, m).can).toBe(false);
    });

    it("tranche inconnue → indéterminé", () => {
      const m: RushHelperProfile = { profileId: "p4", alignment: "bontarien", alignmentLevel: null };
      const r = matchAlignment({ alignment: "bontarien", level: 80 }, m);
      expect(r.can).toBe(false);
      expect(r.levelUnknown).toBe(true);
    });
  });

  describe("findSequenceHelpers", () => {
    it("agrège métier + donjon et déduplique les motifs", () => {
      const seq = makeSeq({
        activityTags: [{ type: "metier", name: "Façonneur", level: 200 }],
        dungeons: [{ id: "d1", name: "Donjon A" }],
      });
      const members: RushHelperProfile[] = [
        { profileId: "m1", name: "Alex", metiers: [{ name: "Façonneur", level: 200 }] },
        { profileId: "m2", name: "Béa", completedDungeonIds: ["d1"] },
        { profileId: "m3", name: "Carl", metiers: ["Forgeron"] },
      ];

      const res = findSequenceHelpers(seq, members);
      expect(res.metierHelpers.map((h) => h.profile.profileId)).toContain("m1");
      expect(res.dungeonHelpers.map((h) => h.profile.profileId)).toContain("m2");
      // Union : m1 (métier) + m2 (donjon), pas m3.
      expect(res.helpers.map((h) => h.profile.profileId).sort()).toEqual(["m1", "m2"]);
      const m1 = res.helpers.find((h) => h.profile.profileId === "m1")!;
      expect(m1.reasons).toContain("Métier Façonneur 200");
      const m2 = res.helpers.find((h) => h.profile.profileId === "m2")!;
      expect(m2.reasons).toContain("Donjon Donjon A");
    });

    it("renvoie des listes vides si aucune contrainte ni membre aidant", () => {
      const res = findSequenceHelpers(makeSeq(), []);
      expect(res.metierHelpers).toEqual([]);
      expect(res.dungeonHelpers).toEqual([]);
      expect(res.alignmentHelpers).toEqual([]);
      expect(res.helpers).toEqual([]);
    });

    it("agrège l'alignement requis et ajoute le motif", () => {
      const seq = makeSeq({ alignReq: "bontarien", alignOrderReq: 80 });
      const members: RushHelperProfile[] = [
        { profileId: "a1", name: "Alex", alignment: "bontarien", alignmentLevel: 80 },
        { profileId: "a2", name: "Béa", alignment: "brakmarien", alignmentLevel: 100 },
      ];

      const res = findSequenceHelpers(seq, members);
      expect(res.alignmentHelpers.map((h) => h.profile.profileId)).toContain("a1");
      expect(res.helpers.map((h) => h.profile.profileId)).toEqual(["a1"]);
      const a1 = res.helpers.find((h) => h.profile.profileId === "a1")!;
      expect(a1.reasons).toContain("Alignement Bontarien 80");
    });

    it("signale le niveau inconnu en « à confirmer » (Option A) sans le cacher", () => {
      const seq = makeSeq({
        activityTags: [{ type: "metier", name: "Façonneur", level: 200 }],
      });
      const members: RushHelperProfile[] = [
        { profileId: "u1", name: "Alex", metiers: ["faconneur"] }, // slug métier, sans niveau
        { profileId: "u2", name: "Béa", metiers: [{ name: "Façonneur", level: 200 }] },
      ];
      const res = findSequenceHelpers(seq, members);
      // u1 possède le métier mais niveau inconnu → « à confirmer ».
      expect(res.uncertainHelpers.map((h) => h.profile.profileId)).toEqual(["u1"]);
      expect(res.uncertainHelpers[0].reasons).toContain("Métier Façonneur 200 (niveau à confirmer)");
      // u2 a le niveau exact → aide réellement, pas « à confirmer ».
      expect(res.helpers.map((h) => h.profile.profileId)).toEqual(["u2"]);
      expect(res.uncertainHelpers.some((h) => h.profile.profileId === "u2")).toBe(false);
    });
  });
});
