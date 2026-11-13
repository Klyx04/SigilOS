/**
 * Gardes — **verrou de donjons par quête** (`src/lib/rush-dungeons.ts`).
 *
 * 🎯 Demande user (21/10/2026, verbatim) : « j'aimerai aussi pouvoir pour une quête qui
 * comporte au moins > 0 donjon pouvoir cocher tel dj est fait, tant que tel dj pas fait
 * (avec option obligatoire ou non) la quête ne peut pas être validé, même mécanique si
 * plusieurs donjons ».
 *
 * 🛡️ Ce que ce test verrouille : le blocage strict sur les donjons **requis**, l'innocuité
 * des **optionnels**, la déduplication par clé stable, et le fail-open documenté sur un
 * donjon sans identité (on signale, on ne fige pas une quête à vie).
 */

import { describe, it, expect } from "vitest";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import {
  boundOptionalDungeonIds,
  doneDungeonKeysForSequence,
  dungeonKeyOf,
  dungeonOccurrenceKey,
  isSequenceBlockedByDungeons,
  occurrenceState,
  resolveSequenceDungeons,
  sequenceDungeonProgress,
  toggleDungeonKey,
} from "@/lib/rush-dungeons";

/** Fabrique de séquence : un seul champ obligatoire (`id`). */
const seq = (over: Partial<RushSequence> = {}): RushSequence => ({
  id: "seq-1",
  subGuideRef: "Q1",
  subGuideName: "Quête de test",
  isOptional: false,
  order: 0,
  ...over,
});

/** Fabrique de donjon : `id` lisible, tout le reste facultatif. */
const dj = (
  id: string,
  over: { name?: string; slug?: string; isOptional?: boolean } = {}
) => ({
  id,
  name: over.name ?? `Donjon ${id}`,
  bossName: "Boss",
  imageUrl: null,
  ...(over.slug ? { slug: over.slug } : {}),
  ...(over.isOptional ? { isOptional: true } : {}),
});

describe("sequenceDungeonProgress — donjons requis et optionnels", () => {
  it("une quête sans donjon n'est jamais bloquée", () => {
    const p = sequenceDungeonProgress(seq());
    expect(p.total).toBe(0);
    expect(p.complete).toBe(true);
    expect(p.blocked).toBe(false);
    expect(isSequenceBlockedByDungeons(seq())).toBe(false);
  });

  it("un donjon requis non coché bloque la quête", () => {
    const s = seq({ dungeons: [dj("dj-1")] as never });
    expect(isSequenceBlockedByDungeons(s)).toBe(true);
    expect(sequenceDungeonProgress(s).missingRequired).toEqual(["dj-1"]);
  });

  it("tous les donjons requis cochés ⇒ la quête est débloquée", () => {
    const s = seq({ dungeons: [dj("dj-1"), dj("dj-2")] as never });
    const p = sequenceDungeonProgress(s, ["dj-1", "dj-2"]);
    expect(p.complete).toBe(true);
    expect(p.blocked).toBe(false);
    expect(p.done).toBe(2);
  });

  it("un donjon optionnel non coché ne bloque pas", () => {
    const s = seq({ dungeons: [dj("dj-1"), dj("dj-2", { isOptional: true })] as never });
    const p = sequenceDungeonProgress(s, ["dj-1"]);
    expect(p.required).toBe(1);
    expect(p.complete).toBe(true);
    expect(p.blocked).toBe(false);
    expect(p.missingOptional).toEqual(["dj-2"]);
  });

  it("plusieurs donjons : il faut TOUS les requis, les optionnels ne rattrapent rien", () => {
    const s = seq({
      dungeons: [dj("dj-1"), dj("dj-2"), dj("dj-3", { isOptional: true })] as never,
    });
    // Seul l'optionnel est coché : ça ne débloque pas.
    expect(sequenceDungeonProgress(s, ["dj-3"]).blocked).toBe(true);
    // Un requis sur deux : encore bloqué.
    expect(sequenceDungeonProgress(s, ["dj-1", "dj-3"]).missingRequired).toEqual(["dj-2"]);
  });

  it("le donjon singulier (`seq.dungeon`) suit la même règle", () => {
    const s = seq({ dungeon: dj("dj-solo") as never });
    expect(isSequenceBlockedByDungeons(s)).toBe(true);
    expect(isSequenceBlockedByDungeons(s, ["dj-solo"])).toBe(false);
  });
});

describe("resolveSequenceDungeons — clés stables et doublons", () => {
  it("la clé est l'id, sinon le slug, sinon le nom normalisé", () => {
    expect(dungeonKeyOf({ id: "42", slug: "kankreblath", name: "Kankreblath" })).toBe("42");
    expect(dungeonKeyOf({ id: null, slug: "kankreblath", name: "Kankreblath" })).toBe("kankreblath");
    expect(dungeonKeyOf({ id: "", slug: "", name: "Donjon du Koulosse" })).toBe(
      "nom:donjon du koulosse"
    );
    expect(dungeonKeyOf({ id: null, slug: null, name: "" })).toBeNull();
  });

  it("un même donjon présent deux fois n'est compté qu'une fois", () => {
    const s = seq({
      dungeon: dj("dj-1") as never,
      dungeons: [dj("dj-1"), dj("dj-2")] as never,
    });
    const { requirements } = resolveSequenceDungeons(s);
    expect(requirements.map((r) => r.key)).toEqual(["dj-1", "dj-2"]);
  });

  it("un donjon sans identité est signalé mais ne bloque pas (fail-open mesuré)", () => {
    const s = seq({
      activityTags: [{ type: "donjon" } as never],
    });
    const p = sequenceDungeonProgress(s);
    expect(p.unresolved).toBe(1);
    expect(p.total).toBe(0);
    expect(p.blocked).toBe(false);
  });

  it("l'état coché est lu depuis un tableau comme depuis un Set", () => {
    const s = seq({ dungeons: [dj("dj-1")] as never });
    expect(sequenceDungeonProgress(s, ["dj-1"]).done).toBe(1);
    expect(sequenceDungeonProgress(s, new Set(["dj-1"])).done).toBe(1);
  });
});

describe("états par OCCURRENCE — le même donjon dans deux quêtes", () => {
  const states = {
    [dungeonOccurrenceKey("s1", "dj-1")]: "done" as const,
    [dungeonOccurrenceKey("s2", "dj-1")]: "todo" as const,
  };

  it("l'état est lu par sa clé d'occurrence, jamais par le nom du donjon", () => {
    expect(occurrenceState(states, "s1", "dj-1")).toBe("done");
    expect(occurrenceState(states, "s2", "dj-1")).toBe("todo");
    // Le même donjon dans une TROISIÈME quête n'a aucun état.
    expect(occurrenceState(states, "s3", "dj-1")).toBeNull();
    expect(occurrenceState(null, "s1", "dj-1")).toBeNull();
  });

  it("le verrou d'une quête ne voit QUE ses propres donjons faits", () => {
    expect(doneDungeonKeysForSequence(states, "s1")).toEqual(["dj-1"]);
    // « à faire » n'est PAS « fait » : la quête s2 reste bloquée.
    expect(doneDungeonKeysForSequence(states, "s2")).toEqual([]);
    const s2 = seq({ id: "s2", dungeons: [dj("dj-1")] as never });
    expect(isSequenceBlockedByDungeons(s2, doneDungeonKeysForSequence(states, "s2"))).toBe(true);
    expect(doneDungeonKeysForSequence(null, "s1")).toEqual([]);
  });
});

describe("toggleDungeonKey — coche idempotente", () => {
  it("ajoute, puis retire, et garde un tableau trié", () => {
    expect(toggleDungeonKey([], "b")).toEqual(["b"]);
    expect(toggleDungeonKey(["b"], "a")).toEqual(["a", "b"]);
    expect(toggleDungeonKey(["a", "b"], "a")).toEqual(["b"]);
  });

  it("décocher une clé absente ne change rien", () => {
    expect(toggleDungeonKey(["a"], "z")).toEqual(["a", "z"]);
    expect(toggleDungeonKey(null, "z")).toEqual(["z"]);
  });
});

/**
 * S0-6 ÔÇö le studio God ├®crit `dungeonOptionalIds`. L'action serveur ne doit jamais faire
 * confiance ├á cette liste : c'est l'intersection avec les donjons de la s├®quence qui part
 * en base, born├®e en nombre et en longueur.
 */
describe("boundOptionalDungeonIds ÔÇö S0-6, borne du drapeau ┬½ optionnel ┬╗", () => {
  it("garde les ids qui font partie des donjons li├®s", () => {
    expect(
      boundOptionalDungeonIds({ dungeonIds: ["a", "b", "c"], optionalIds: ["b"] })
    ).toEqual(["b"]);
  });

  it("├®carte un id ├®tranger ├á la s├®quence (donn├®e morte venue du client)", () => {
    expect(
      boundOptionalDungeonIds({ dungeonIds: ["a"], optionalIds: ["a", "inconnu"] })
    ).toEqual(["a"]);
  });

  it("accepte le donjon unique historique (`dungeonId`) comme li├®", () => {
    expect(
      boundOptionalDungeonIds({ dungeonIds: null, dungeonId: "seul", optionalIds: ["seul"] })
    ).toEqual(["seul"]);
  });

  it("d├®duplique sans r├®ordonner", () => {
    expect(
      boundOptionalDungeonIds({ dungeonIds: ["a", "b"], optionalIds: ["b", "a", "b"] })
    ).toEqual(["b", "a"]);
  });

  it("borne le nombre d'ids ├®crits", () => {
    const linked = Array.from({ length: 10 }, (_, i) => `d${i}`);
    expect(
      boundOptionalDungeonIds({ dungeonIds: linked, optionalIds: linked, maxIds: 3 })
    ).toEqual(["d0", "d1", "d2"]);
  });

  it("borne la longueur d'un id et ignore les entr├®es vides", () => {
    const long = "x".repeat(65);
    expect(
      boundOptionalDungeonIds({ dungeonIds: [long, "", "ok"], optionalIds: [long, "", "ok"] })
    ).toEqual(["ok"]);
  });

  it("renvoie une liste vide quand rien n'est li├® (aucun donjon)", () => {
    expect(boundOptionalDungeonIds({ dungeonIds: [], optionalIds: ["a"] })).toEqual([]);
  });

  it("n'├®crit jamais un donjon optionnel sans donjon li├®", () => {
    // Cas limite du studio : la liste ┬½ optionnel ┬╗ survit ├á la suppression du donjon.
    expect(
      boundOptionalDungeonIds({ dungeonIds: ["a"], optionalIds: ["a", "b"] })
    ).toEqual(["a"]);
  });
});
