/**
 * Garde — **numérotation des blocs** dans les deux guides navigateur (12/11/2026).
 *
 * 🎯 Mesure du 12/11/2026 : les deux guides numérotaient chacun à leur façon.
 *   · guide membre : `msIdx + 1`, c'est-à-dire le rang **dans le chapitre** (sa liste ne
 *     porte que les blocs d'un chapitre) — chaque page repartait donc à 1 ;
 *   · guide public : `milestones.indexOf(ms) + 1`, c'est-à-dire le rang **brut**, encarts
 *     et séparateurs compris — les numéros sautaient dès qu'un bandeau s'intercalait.
 * L'overlay, lui, suivait déjà la bonne règle (`rushChapterPosition`).
 *
 * 🛡️ Le correctif est une **table** (`rushChapterNumbers`) : le parent la calcule une
 * fois sur le guide COMPLET et la passe aux lignes. On verrouille ici les trois
 * surfaces sur la même règle, et l'absence des deux anciens calculs.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";

/** Code sans commentaires : un commentaire qui cite l'ancien calcul ne doit pas faire échouer. */
const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const DASH = codeOf(DASHBOARD);
const PUB = codeOf(PUBLIC);
const OVER = codeOf(OVERLAY);

describe("numérotation des blocs — une seule règle pour les trois surfaces", () => {
  it("les deux guides lisent la table partagée `rushChapterNumbers`", () => {
    for (const [name, code] of [["interne", DASH], ["public", PUB]] as const) {
      expect(code, `${name} n'importe pas la règle partagée`).toMatch(/rushChapterNumbers/);
      expect(code, `${name} ne construit pas la table sur le guide complet`).toMatch(
        /rushChapterNumbers\(milestones\)/
      );
    }
  });

  it("l'overlay garde la même règle (`rushChapterPosition`)", () => {
    expect(OVER).toMatch(/rushChapterPosition\(milestones, currentMs\?\.id\)/);
  });

  it("le guide interne ne numérote plus avec l'index de sa liste de chapitre", () => {
    expect(DASH).not.toMatch(/blockIndex/);
    expect(DASH).toMatch(/blockNumber=\{blockNumbers\?\.get\(ms\.id\) \?\? 0\}/);
    // La table vient du parent : le chapitre ne peut pas la recalculer sur sa propre liste.
    expect(DASH).toMatch(/blockNumbers=\{blockNumbers\}/);
  });

  it("le guide public ne numérote plus avec `milestones.indexOf`", () => {
    expect(PUB).not.toMatch(/milestones\.indexOf\(ms\)/);
    expect(PUB).toMatch(/const blockNumber = blockNumbers\.get\(ms\.id\) \?\? 0;/);
  });

  it("les deux surfaces affichent le rang, et rien pour un bloc non numéroté", () => {
    // `0` (bloc hors numérotation) ⇒ chaîne vide : jamais un « 0 » à l'écran.
    expect(DASH).toMatch(/\{blockNumber\|\|""\}/);
    expect(PUB).toMatch(/\{blockNumber \|\| ""\}/);
  });
});
