import { describe, it, expect } from "vitest";
import {
  MAX_RUSH_DUNGEONS_PER_SEQUENCE,
  RUSH_DUNGEON_ALIAS_LABELS,
  RUSH_DUNGEON_NAME_ALIASES,
  mergeRushDungeonIds,
  normalizeRushDungeonName,
  resolveRushDungeonByName,
  rushDungeonAliasSlug,
  splitRushDungeonTagNames,
  stripRushDungeonLevel,
} from "@/lib/rush-dungeon-names";

/**
 * Verrou de la **résolution des noms de donjons** du guide Rush.
 *
 * Mesure du 19/11/2026 (guide en base, 141 séquences porteuses d'un tag `donjon`) :
 * un tag peut lister **29 alternatives** (« Les totems de Maïmane »), le client ajoute
 * le niveau au libellé, et **3 noms** ne sont pas les nôtres. Sans cette règle, 18
 * donjons de Maïmane restaient des clés `nom:…` — sans fiche, sans succès, sans
 * agrégat possible pour le Bloc J.
 */

const catalogue = [
  { id: "d-corbac", name: "Salle de lecture du Maître Corbac", bossName: "Maître Corbac", slug: "maitre-corbac" },
  { id: "d-grolloum", name: "Mine abandonnée de Sakaï", bossName: "Grolloum", slug: "grolloum" },
  { id: "d-torkelonia", name: "Torkélonia", bossName: "Torkélonia", slug: "torkelonia" },
  { id: "d-korriandre", name: "Antre du Korriandre", bossName: "Korriandre", slug: "korriandre" },
];

const lookup = {
  byName: new Map(catalogue.map((d) => [normalizeRushDungeonName(d.name), d])),
  byBoss: new Map(catalogue.map((d) => [normalizeRushDungeonName(d.bossName), d])),
  bySlug: new Map(catalogue.map((d) => [normalizeRushDungeonName(d.slug), d])),
};

describe("rush-dungeon-names — libellés du client", () => {
  it("découpe un tag multi en alternatives et jette la précision", () => {
    expect(
      splitRushDungeonTagNames(
        "Salons privés de Klime / Aquadôme de Merkator / Palais du roi Nidas (niv. 200) — Donjon en fonction de votre niveau"
      )
    ).toEqual(["Salons privés de Klime", "Aquadôme de Merkator", "Palais du roi Nidas"]);
  });

  it("garde un tag simple intact, sans doublon", () => {
    expect(splitRushDungeonTagNames("Torkélonia")).toEqual(["Torkélonia"]);
    expect(splitRushDungeonTagNames("Torkélonia / Torkélonia")).toEqual(["Torkélonia"]);
    expect(splitRushDungeonTagNames("   ")).toEqual([]);
    expect(splitRushDungeonTagNames(null)).toEqual([]);
  });

  it("retire le niveau écrit par le client", () => {
    expect(stripRushDungeonLevel("Antre du Korriandre (niv. 180)")).toBe("Antre du Korriandre");
    expect(stripRushDungeonLevel("Antre du Korriandre (niv 180)")).toBe("Antre du Korriandre");
    expect(stripRushDungeonLevel("Antre du Korriandre (niveau 180)")).toBe("Antre du Korriandre");
    expect(stripRushDungeonLevel("Antre du Korriandre")).toBe("Antre du Korriandre");
  });

  it("les 3 alias mesurés pointent vers le slug du catalogue", () => {
    expect(rushDungeonAliasSlug("Bibliothèque du Maître Corbac")).toBe("maitre-corbac");
    expect(rushDungeonAliasSlug("Donjon de la mine de Sakaï")).toBe("grolloum");
    expect(rushDungeonAliasSlug("Sanctuaire de Torkélonia")).toBe("torkelonia");
    expect(rushDungeonAliasSlug("Antre du Korriandre")).toBeNull();
    expect(rushDungeonAliasSlug("")).toBeNull();
  });

  it("chaque libellé d'alias retombe sur sa clé normalisée (pas de dérive)", () => {
    for (const { label, slug } of RUSH_DUNGEON_ALIAS_LABELS) {
      expect(RUSH_DUNGEON_NAME_ALIASES[normalizeRushDungeonName(label)]).toBe(slug);
    }
  });
});

describe("rush-dungeon-names — résolution dans un catalogue", () => {
  it("résout par nom exact, par boss, puis par alias", () => {
    expect(resolveRushDungeonByName("Antre du Korriandre (niv. 180)", lookup)?.id).toBe("d-korriandre");
    expect(resolveRushDungeonByName("Grolloum", lookup)?.id).toBe("d-grolloum");
    expect(resolveRushDungeonByName("Sanctuaire de Torkélonia", lookup)?.id).toBe("d-torkelonia");
  });

  it("le nom exact gagne toujours sur un alias", () => {
    const exact = {
      ...lookup,
      byName: new Map([
        ...lookup.byName,
        [normalizeRushDungeonName("Sanctuaire de Torkélonia"), catalogue[3]],
      ]),
    };
    expect(resolveRushDungeonByName("Sanctuaire de Torkélonia", exact)?.id).toBe("d-korriandre");
  });

  it("ne devine jamais un donjon inconnu", () => {
    expect(resolveRushDungeonByName("Donjon imaginaire", lookup)).toBeNull();
    expect(resolveRushDungeonByName("", lookup)).toBeNull();
  });
});

describe("rush-dungeon-names — union des ids", () => {
  it("garde l'ordre existant, ajoute sans doublon et ignore les vides", () => {
    expect(mergeRushDungeonIds(["a", "b"], ["b", "c", "", " a "])).toEqual(["a", "b", "c"]);
  });

  it("ne retire jamais un id existant et reste idempotente", () => {
    const once = mergeRushDungeonIds(["a"], ["b", "c"]);
    expect(mergeRushDungeonIds(once, ["b", "c"])).toEqual(once);
    expect(mergeRushDungeonIds(once, [])).toEqual(once);
  });

  it("borne l'union au plafond partagé, qui couvre les 29 alternatives mesurées", () => {
    const ids = Array.from({ length: 50 }, (_, index) => `d-${index}`);
    expect(mergeRushDungeonIds([], ids)).toHaveLength(MAX_RUSH_DUNGEONS_PER_SEQUENCE);
    expect(MAX_RUSH_DUNGEONS_PER_SEQUENCE).toBeGreaterThanOrEqual(29);
  });
});
