/**
 * Gardes — **coches de donjons du guide public** (persistance locale, sans compte).
 *
 * 🎯 Demande user (21/10/2026) : la coche d'un donjon vaut pour SA quête, jamais pour
 * les autres ; elle doit exister à l'identique dans le dashboard et dans le guide
 * public, alors que le public n'a ni base ni compte (stockage navigateur).
 *
 * 🛡️ Ce que ce test verrouille :
 *  · la clé de stockage dérive du préfixe de progression invité (par personnage) ;
 *  · la lecture est **fail-closed** (JSON invalide ⇒ état vide, jamais une exception) ;
 *  · une valeur inconnue ou une clé qui n'est pas une occurrence sont **écartées** ;
 *  · écrire une occurrence n'efface pas les autres, et `null` retire la ligne ;
 *  · au SSR (aucun `localStorage`), tout est neutre.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DUNGEON_STATES_SUFFIX,
  clearDungeonStates,
  dungeonStatesStorageKey,
  parseDungeonStates,
  readDungeonStates,
  serializeDungeonStates,
  writeDungeonState,
} from "@/lib/rush-dungeon-storage";
import { dungeonOccurrenceKey } from "@/lib/rush-dungeons";

const PREFIX = "sigil_guest_rush-sylvestre_c_iop-295_";

/** Faux `localStorage` minimal, remis à zéro avant chaque cas. */
function installStorage() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal("localStorage", mock);
  return mock;
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clé de stockage — une 4ᵉ clé par personnage", () => {
  it("suffixe le préfixe de progression invité et rien d'autre", () => {
    expect(DUNGEON_STATES_SUFFIX).toBe("dungeons");
    expect(dungeonStatesStorageKey(PREFIX)).toBe(`${PREFIX}dungeons`);
    expect(dungeonStatesStorageKey("sigil_guest_x_")).toBe("sigil_guest_x_dungeons");
  });
});

describe("parseDungeonStates — fail-closed", () => {
  it("lit une carte valide, clé par occurrence", () => {
    const map = parseDungeonStates(
      JSON.stringify({
        [dungeonOccurrenceKey("s1", "dj-1")]: "done",
        [dungeonOccurrenceKey("s2", "dj-1")]: "todo",
      })
    );
    expect(map).toEqual({ "s1::dj-1": "done", "s2::dj-1": "todo" });
  });

  it("un contenu illisible donne un état vide, jamais une exception", () => {
    expect(parseDungeonStates("{pas du json")).toEqual({});
    expect(parseDungeonStates(null)).toEqual({});
    expect(parseDungeonStates("")).toEqual({});
  });

  it("un tableau ou une valeur scalaire n'est pas une carte", () => {
    expect(parseDungeonStates("[1,2,3]")).toEqual({});
    expect(parseDungeonStates("42")).toEqual({});
  });

  it("écarte les valeurs inconnues et les clés qui ne sont pas une occurrence", () => {
    const map = parseDungeonStates(
      JSON.stringify({
        "s1::dj-1": "done",
        "s1::dj-2": "peut-etre", // valeur inconnue
        "dj-3": "done", // clé mutualisée : interdite
        "": "todo",
      })
    );
    expect(map).toEqual({ "s1::dj-1": "done" });
  });

  it("sérialise toujours un objet (jamais `undefined`)", () => {
    expect(serializeDungeonStates(null)).toBe("{}");
    expect(serializeDungeonStates({})).toBe("{}");
  });
});

describe("writeDungeonState — par occurrence, idempotent", () => {
  it("n'écrit QUE l'occurrence visée et garde les autres", () => {
    const first = writeDungeonState(PREFIX, dungeonOccurrenceKey("s1", "dj-1"), "done");
    expect(first).toEqual({ "s1::dj-1": "done" });

    const second = writeDungeonState(PREFIX, dungeonOccurrenceKey("s2", "dj-1"), "todo");
    expect(second).toEqual({ "s1::dj-1": "done", "s2::dj-1": "todo" });
    // Relecture depuis le stockage : même état (aucune perte).
    expect(readDungeonStates(PREFIX)).toEqual(second);
  });

  it("`null` retire la ligne et laisse les autres intactes", () => {
    writeDungeonState(PREFIX, dungeonOccurrenceKey("s1", "dj-1"), "done");
    writeDungeonState(PREFIX, dungeonOccurrenceKey("s2", "dj-1"), "done");

    const next = writeDungeonState(PREFIX, dungeonOccurrenceKey("s1", "dj-1"), null);
    expect(next).toEqual({ "s2::dj-1": "done" });
    expect(readDungeonStates(PREFIX)).toEqual({ "s2::dj-1": "done" });
  });

  it("une clé qui n'est pas une occurrence est ignorée (aucune écriture aveugle)", () => {
    expect(writeDungeonState(PREFIX, "dj-1", "done")).toEqual({});
    expect(readDungeonStates(PREFIX)).toEqual({});
  });

  it("les deux états coexistent : « fait » ici, « à faire » là", () => {
    writeDungeonState(PREFIX, dungeonOccurrenceKey("s1", "dj-1"), "done");
    writeDungeonState(PREFIX, dungeonOccurrenceKey("s1", "dj-1"), "todo");
    expect(readDungeonStates(PREFIX)).toEqual({ "s1::dj-1": "todo" });
  });
});

describe("clearDungeonStates — remise à zéro", () => {
  it("efface la clé sans toucher aux autres clés de progression", () => {
    localStorage.setItem(`${PREFIX}steps`, JSON.stringify({ m1: ["s1"] }));
    writeDungeonState(PREFIX, dungeonOccurrenceKey("s1", "dj-1"), "done");

    clearDungeonStates(PREFIX);

    expect(readDungeonStates(PREFIX)).toEqual({});
    expect(localStorage.getItem(`${PREFIX}steps`)).not.toBeNull();
  });
});

describe("aucun stockage (SSR / navigation privée)", () => {
  it("reste neutre sans `localStorage`", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readDungeonStates(PREFIX)).toEqual({});
    // L'état calculé reste en MÉMOIRE (la surface peut l'afficher), mais rien n'est
    // persisté : au rechargement, le guide repart de zéro plutôt que de planter.
    expect(writeDungeonState(PREFIX, dungeonOccurrenceKey("s1", "dj-1"), "done")).toEqual({
      "s1::dj-1": "done",
    });
    expect(() => clearDungeonStates(PREFIX)).not.toThrow();
  });
});
