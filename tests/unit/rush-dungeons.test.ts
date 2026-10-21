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
  applyDungeonStates,
  buildDungeonIndex,
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

describe("buildDungeonIndex — tous les donjons du guide et leurs endroits", () => {
  /** Fabrique de jalon minimal. */
  const ms = (
    id: string,
    title: string,
    sequences: RushSequence[],
    over: Partial<RushMilestone> = {}
  ): RushMilestone => ({
    id,
    chapter: 1,
    chapterLabel: "Chapitre 1",
    title,
    isOptional: false,
    order: 0,
    sequences,
    ...over,
  });

  it("le même donjon dans deux quêtes = une entrée, deux endroits", () => {
    const index = buildDungeonIndex([
      ms("m1", "Bloc A", [seq({ id: "s1", dungeon: dj("dj-1") as never })]),
      ms("m2", "Bloc B", [seq({ id: "s2", dungeons: [dj("dj-1")] as never })]),
    ]);
    expect(index).toHaveLength(1);
    expect(index[0].key).toBe("dj-1");
    expect(index[0].places).toBe(2);
    expect(index[0].occurrences.map((o) => o.sequenceId)).toEqual(["s1", "s2"]);
    expect(index[0].occurrences.map((o) => o.milestoneTitle)).toEqual(["Bloc A", "Bloc B"]);
  });

  it("optionnel dans une quête, requis dans une autre : les deux endroits comptent", () => {
    const index = buildDungeonIndex([
      ms("m1", "A", [seq({ id: "s1", dungeons: [dj("dj-1", { isOptional: true })] as never })]),
      ms("m2", "B", [seq({ id: "s2", dungeons: [dj("dj-1")] as never })]),
    ]);
    expect(index[0].places).toBe(2);
    expect(index[0].requiredPlaces).toBe(1);
    expect(index[0].occurrences[0].isOptional).toBe(true);
  });

  it("un donjon répété dans la même quête ne crée pas deux endroits", () => {
    const index = buildDungeonIndex([
      ms("m1", "A", [
        seq({ id: "s1", dungeon: dj("dj-1") as never, dungeons: [dj("dj-1"), dj("dj-2")] as never }),
      ]),
    ]);
    const entry = index.find((e) => e.key === "dj-1");
    expect(entry?.places).toBe(1);
    expect(index.map((e) => e.key)).toEqual(["dj-1", "dj-2"]);
  });

  it("l'index suit l'ordre du guide", () => {
    const index = buildDungeonIndex([
      ms("m1", "A", [seq({ id: "s1", dungeons: [dj("zebre"), dj("arbre")] as never })]),
      ms("m2", "B", [seq({ id: "s2", dungeons: [dj("maison")] as never })]),
    ]);
    expect(index.map((e) => e.key)).toEqual(["zebre", "arbre", "maison"]);
  });

  it("un guide sans donjon donne un index vide", () => {
    expect(buildDungeonIndex([ms("m1", "A", [seq({ id: "s1" })])])).toEqual([]);
  });
});

describe("états par OCCURRENCE — le même donjon dans deux quêtes", () => {
  const milestone = (id: string, sequenceId: string): RushMilestone => ({
    id,
    chapter: 1,
    chapterLabel: "Chapitre 1",
    title: `Bloc ${id}`,
    isOptional: false,
    order: 0,
    sequences: [seq({ id: sequenceId, subGuideName: `Quête ${sequenceId}`, dungeons: [dj("dj-1")] as never })],
  });

  const index = buildDungeonIndex([milestone("m1", "s1"), milestone("m2", "s2")]);

  it("cocher le donjon dans une quête ne coche PAS l'autre", () => {
    const states = { [dungeonOccurrenceKey("s1", "dj-1")]: "done" as const };
    const out = applyDungeonStates(index, states);
    expect(out).toHaveLength(1);
    expect(out[0].occurrences[0].state).toBe("done");
    expect(out[0].occurrences[1].state).toBeNull();
    expect(out[0].donePlaces).toBe(1);
    expect(out[0].todoPlaces).toBe(0);
  });

  it("« à faire » est aussi propre à l'occurrence", () => {
    const states = { [dungeonOccurrenceKey("s2", "dj-1")]: "todo" as const };
    const out = applyDungeonStates(index, states);
    expect(out[0].occurrences[0].state).toBeNull();
    expect(out[0].occurrences[1].state).toBe("todo");
    expect(out[0].todoPlaces).toBe(1);
  });

  it("l'état d'une occurrence est lu par sa clé, jamais par le nom du donjon", () => {
    const states = { [dungeonOccurrenceKey("s1", "dj-1")]: "done" as const };
    expect(occurrenceState(states, "s1", "dj-1")).toBe("done");
    expect(occurrenceState(states, "s2", "dj-1")).toBeNull();
    expect(occurrenceState(null, "s1", "dj-1")).toBeNull();
  });

  it("le verrou d'une quête ne voit QUE ses propres donjons faits", () => {
    const states = {
      [dungeonOccurrenceKey("s1", "dj-1")]: "done" as const,
      [dungeonOccurrenceKey("s2", "dj-1")]: "todo" as const,
    };
    expect(doneDungeonKeysForSequence(states, "s1")).toEqual(["dj-1"]);
    expect(doneDungeonKeysForSequence(states, "s2")).toEqual([]);
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
