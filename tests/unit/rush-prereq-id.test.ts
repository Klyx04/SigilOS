/**
 * Gardes — **T-2c** : les prérequis (`prereq_text`) portent un **id** de séquence.
 *
 * 🎯 Pourquoi : le tag ne portait qu'un **nom**, donc (1) renommer une quête dans le
 * studio God cassait tous ses prérequis, et (2) une quête absente du guide produisait un
 * prérequis **inerte** (mesuré : 60 tags sur 301 dans le guide réel).
 *
 * 🛡️ Ce que ce test verrouille :
 *  • la résolution **par id d'abord**, y compris quand le libellé a changé ;
 *  • le **fail-closed** : un id fourni mais introuvable ne retombe PAS sur un homonyme ;
 *  • la compatibilité des tags historiques (sans id) : nom exact, puis partiel ;
 *  • le blocage effectif par id (et le non-blocage quand la cible est cochée) ;
 *  • le câblage : l'action de recherche renvoie un vrai id, le studio God l'écrit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  getPrereqRefs,
  isSequenceBlockedByPrereqs,
  resolvePrereqTarget,
} from "@/lib/rush-guide-utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const seq = (id: string, name: string, activityTags: unknown[] = []): RushSequence =>
  ({ id, subGuideName: name, subGuideRef: name, order: 1, isOptional: false, activityTags }) as unknown as RushSequence;

const ms = (id: string, type: string, sequences: RushSequence[]): RushMilestone =>
  ({
    id,
    type,
    chapter: 1,
    chapterLabel: id,
    title: id,
    order: 0,
    isOptional: false,
    sequences,
  }) as unknown as RushMilestone;

const prereq = (id: string | undefined, name: string) => ({
  type: "prereq_text",
  ...(id ? { id } : {}),
  name,
});

const GUIDE: RushMilestone[] = [
  ms("c1", "QUETE_SERIE", [
    seq("s-a", "La grande bibliothèque"),
    seq("s-b", "La grande bibliothèque interdite"),
  ]),
  ms("c2", "DONJON", [seq("s-c", "Arakne des champs")]),
];

describe("resolvePrereqTarget — l'id passe avant le libellé", () => {
  it("un id valide cible la séquence, même si le libellé ne correspond à rien", () => {
    expect(resolvePrereqTarget("Libellé obsolète", GUIDE, "s-b")).toEqual({
      seqId: "s-b",
      milestoneId: "c1",
    });
  });

  it("renommer la quête dans God ne casse plus le prérequis", () => {
    // Le guide porte désormais « Le secret des bibliothèques » à l'id `s-b`.
    const renomme: RushMilestone[] = [
      ms("c1", "QUETE_SERIE", [seq("s-b", "Le secret des bibliothèques")]),
    ];
    expect(resolvePrereqTarget("La grande bibliothèque interdite", renomme, "s-b")?.seqId).toBe("s-b");
  });

  it("fail-closed : un id introuvable ne retombe PAS sur le nom", () => {
    // `s-disparu` n'existe plus ; le nom, lui, correspondrait à `s-a`.
    expect(resolvePrereqTarget("La grande bibliothèque", GUIDE, "s-disparu")).toBeNull();
  });

  it("sans id, on garde la règle historique (exact puis partiel)", () => {
    expect(resolvePrereqTarget("La grande bibliothèque", GUIDE)?.seqId).toBe("s-a");
    expect(resolvePrereqTarget("bibliothèque interdite", GUIDE)?.seqId).toBe("s-b");
    expect(resolvePrereqTarget("Une quête absente", GUIDE)).toBeNull();
  });
});

describe("getPrereqRefs — lecture des tags par id", () => {
  it("résout les cibles par id et ignore l'auto-référence", () => {
    const porteur = seq("s-c", "Arakne des champs", [
      prereq("s-a", "La grande bibliothèque"),
      prereq("s-c", "Arakne des champs"),
      prereq("s-b", "Ancien libellé"),
    ]);
    const refs = getPrereqRefs(porteur, GUIDE);
    expect(refs.map((r) => r.seqId)).toEqual(["s-a", "s-b"]);
    expect(refs[0]).toEqual({ seqId: "s-a", milestoneId: "c1", name: "La grande bibliothèque" });
  });

  it("déduplique deux tags pointant le même id", () => {
    const porteur = seq("s-c", "Arakne des champs", [prereq("s-a", "A"), prereq("s-a", "A bis")]);
    expect(getPrereqRefs(porteur, GUIDE)).toHaveLength(1);
  });

  it("un tag historique (sans id) reste résolu par son nom", () => {
    const porteur = seq("s-c", "Arakne des champs", [prereq(undefined, "La grande bibliothèque")]);
    expect(getPrereqRefs(porteur, GUIDE).map((r) => r.seqId)).toEqual(["s-a"]);
  });
});

describe("isSequenceBlockedByPrereqs — blocage par id", () => {
  const porteur = seq("s-c", "Arakne des champs", [prereq("s-b", "Libellé quelconque")]);

  it("bloque tant que la cible (id) n'est pas cochée, même si le libellé est faux", () => {
    expect(isSequenceBlockedByPrereqs(porteur, new Set(["s-a"]), GUIDE)).toBe(true);
  });

  it("ne bloque plus dès que la cible est cochée", () => {
    expect(isSequenceBlockedByPrereqs(porteur, new Set(["s-b"]), GUIDE)).toBe(false);
  });

  it("un prérequis introuvable ne verrouille pas la quête à vie", () => {
    const orphelin = seq("s-c", "Arakne des champs", [prereq("s-disparu", "Fantôme")]);
    expect(isSequenceBlockedByPrereqs(orphelin, new Set(), GUIDE)).toBe(false);
  });
});

describe("câblage T-2c", () => {
  it("l'action de recherche renvoie le VRAI id de séquence", () => {
    const file = codeOf("src/server/actions/dofus-search-actions.ts");
    const start = file.indexOf("export async function searchGuideQuests");
    const next = file.indexOf("export async function", start + 10);
    const code = file.slice(start, next > start ? next : file.length);
    expect(start).toBeGreaterThan(-1);
    expect(code).toMatch(/select:\s*\{\s*id:\s*true,\s*subGuideName:\s*true,\s*subGuideRef:\s*true\s*\}/);
    expect(code).toMatch(/id:\s*s\.id,\s*name:\s*s\.subGuideName\s*\|\|\s*s\.subGuideRef/);
    // Plus de faux id (`id: name`) ni de quête du catalogue hors guide.
    expect(code).not.toMatch(/id:\s*name\b/);
    expect(code).not.toMatch(/db\.gameQuest\.findMany/);
  });

  it("le studio God écrit l'id dans le tag `prereq_text`", () => {
    const code = codeOf("src/app/god/rush-sylvestre/RushSylvestreAdminClient.tsx");
    expect(code).toMatch(
      /type:\s*"prereq_text"\s*as any,\s*id:\s*p\.id,\s*name:\s*p\.name/
    );
  });
});
