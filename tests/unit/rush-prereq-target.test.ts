/**
 * Gardes — **T-2b** du plan refonte Rush Sylvestre : le reste du lot 2.
 *
 *  • **G3** — le clic sur un prérequis cherchait la quête par nom *partiel* (`includes`) :
 *    « La grande bibliothèque » pouvait ouvrir « La grande bibliothèque **interdite** ».
 *    La règle pure `resolvePrereqTarget` cherche le nom **exact** d'abord.
 *  • **G4** — la surbrillance de la quête ciblée passe de 3,5 s à **1,2 s** (constante unique).
 *  • **G10** — la page du guide lançait ses deux lectures indépendantes l'une APRÈS l'autre.
 *
 * 🛡️ Lecture seule : cas purs + câblage lu dans le source (commentaires retirés).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolvePrereqTarget } from "@/lib/rush-guide-utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const seq = (id: string, name: string): RushSequence =>
  ({ id, subGuideName: name, subGuideRef: "", activityTags: [] }) as unknown as RushSequence;

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

/**
 * Le cas qui cassait : deux quêtes dont l'une **contient** le nom de l'autre, la plus
 * LONGUE **avant** la courte dans l'ordre du guide (l'ancien `includes` partait au premier
 * libellé qui contenait la recherche, donc sur la mauvaise).
 */
const GUIDE: RushMilestone[] = [
  ms("c1", "QUETE_SERIE", [
    seq("s-longue", "La grande bibliothèque interdite"),
    seq("s-exacte", "La grande bibliothèque"),
  ]),
  ms("sep", "SEPARATEUR", [seq("s-sep", "Réponses à tout.")]),
  ms("c2", "DONJON", [seq("s-ara", "Arakne des champs")]),
];

describe("resolvePrereqTarget — nom EXACT d'abord, nom partiel en dernier recours", () => {
  it("deux quêtes dont l'une contient l'autre : c'est l'EXACTE qui gagne", () => {
    expect(resolvePrereqTarget("La grande bibliothèque", GUIDE)).toEqual({
      seqId: "s-exacte",
      milestoneId: "c1",
    });
  });

  it("ignore la casse, les espaces et les espaces insécables", () => {
    expect(resolvePrereqTarget("  la GRANDE bibliothèque  ", GUIDE)?.seqId).toBe("s-exacte");
    expect(resolvePrereqTarget("La\u00a0grande bibliothèque", GUIDE)?.seqId).toBe("s-exacte");
  });

  it("replie sur le nom partiel quand aucun nom exact ne correspond", () => {
    expect(resolvePrereqTarget("bibliothèque interdite", GUIDE)?.seqId).toBe("s-longue");
  });

  it("ne devine rien : nom vide, inconnu ou absent d'un vrai chapitre ⇒ null", () => {
    expect(resolvePrereqTarget("Une quête qui n'existe pas", GUIDE)).toBeNull();
    expect(resolvePrereqTarget("", GUIDE)).toBeNull();
    expect(resolvePrereqTarget(null, GUIDE)).toBeNull();
    expect(resolvePrereqTarget(undefined, GUIDE)).toBeNull();
  });

  it("un bandeau (SÉPARATEUR / INFO) n'est jamais une cible", () => {
    // Ce libellé n'existe QUE dans un séparateur : il ne doit rien résoudre…
    expect(resolvePrereqTarget("Réponses à tout.", GUIDE)).toBeNull();
    // …alors qu'un libellé partiel qui existe dans un VRAI chapitre reste trouvable.
    expect(resolvePrereqTarget("Arakne", GUIDE)?.seqId).toBe("s-ara");
  });
});

describe("câblage de T-2b", () => {
  const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
  const PAGE = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/page.tsx";

  it("le guide membre résout le prérequis par la règle partagée (plus d'`includes` aveugle)", () => {
    const code = codeOf(DASHBOARD);
    expect(code).toMatch(/resolvePrereqTarget\(seqName, milestones as any\)\?\.seqId/);
    expect(code).not.toMatch(/matchName\.toLowerCase\(\)\.includes\(seqName\.toLowerCase\(\)\)/);
  });

  it("la surbrillance de la cible dure 1,2 s, depuis UNE constante", () => {
    const code = codeOf(DASHBOARD);
    expect(code).toMatch(/const TARGET_HIGHLIGHT_MS = 1200;/);
    expect(code.match(/, TARGET_HIGHLIGHT_MS\);/g)?.length).toBe(2);
    expect(code).not.toMatch(/\}, 3500\);/);
  });

  it("la page serveur lance ses deux lectures indépendantes AVANT le premier await", () => {
    const code = codeOf(PAGE);
    const start = code.indexOf("const resourceChecksPromise =");
    const end = code.indexOf("let resourceChecks");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const launched = code.slice(start, end);
    expect(launched).toMatch(/const resourceChecksPromise = getRushResourceChecks\(/);
    expect(launched).toMatch(/const profilePromise = user\.profileId/);
    // Le premier `await` de la zone porte donc sur une promesse DÉJÀ lancée.
    expect(code).toMatch(/const checks = await resourceChecksPromise;/);
    expect(code).toMatch(/const profileRes = await profilePromise;/);
    expect(code).not.toMatch(/await getRushResourceChecks\(slug, guildId, altPseudo\);/);
  });
});
