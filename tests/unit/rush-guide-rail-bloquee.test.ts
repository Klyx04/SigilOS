/**
 * Gardes — **rail de droite, ciblage du prérequis et carte bloquée** (guide interne/public).
 *
 * 🎯 Retours user (21/10/2026, verbatim) : « le panneau de droite avec les ressources les dj
 * ne suis pas le scroll vertical des étapes déroulé, le guide public le fait bien » · « quand
 * on clic sur une quête "a terminer avant" ca renvoie bien dans la bonne étape mais ca cible
 * pas la quete » · « le bloc d'une quete bloqué rouge … c'est très IA slop, ca manque de
 * l'icone de quete à côté d'elles et le bouton info devrais pas non plus etre dispo ».
 *
 * 🛡️ Faits verrouillés (lecture de source : ce sont des composants monolithiques) :
 *  · l'item de grille du rail est ÉTIRÉ et le sticky est sur un bloc interne (sinon aucune
 *    course de scroll : c'était le cas avec `align-items: start`) ;
 *  · la quête ciblée (prérequis, repère, reprise) porte un anneau VISIBLE (2 px + offset) ;
 *  · une carte bloquée garde l'icône de quête et n'affiche pas le bouton info côté public.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PAGE = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/page.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";

const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const DASH_CODE = codeOf(DASH);
const PUB_CODE = codeOf(PUBLIC);
const PAGE_CODE = codeOf(PAGE);

/**
 * ⚠️ Ce que la garde du 21/10 avait manqué : elle verrouillait la grille et le `sticky`
 * du rail, mais **pas les ancêtres**. La page du guide créait deux boîtes de défilement
 * (`overflow-hidden` sur une colonne de hauteur automatique, puis `overflow-y-auto`) :
 * `position: sticky` se cale sur le plus proche ancêtre « scrollable », donc sur une boîte
 * qui ne défile jamais ⇒ zéro course, le panneau partait avec la page (mesure du
 * 22/10/2026, capture user à l'appui). Seul `<main data-scroll-container>` doit défiler.
 */
describe("Rail de droite — aucun conteneur de défilement intermédiaire", () => {
  it("la page du guide ne pose pas d'`overflow` sur sa racine", () => {
    expect(PAGE_CODE).not.toMatch(/w-full h-full overflow-hidden/);
  });

  it("la branche timeline n'ouvre pas de scrolleur entre `<main>` et le rail", () => {
    expect(PAGE_CODE).not.toMatch(/className="flex-1 overflow-y-auto"/);
  });

  it("le wrapper de la timeline reste une simple colonne (flex-1)", () => {
    expect(PAGE_CODE).toMatch(/className="flex-1" style=\{\{ padding: "0 clamp\(20px, 3vw, 48px\)" \}\}/);
  });
});

describe("Rail de droite — le panneau suit le scroll des étapes", () => {
  // E3 (05/11/2026) : la grille locale `.rush-content-grid` (et son `<style>`) a
  // laissé la place à la grille PARTAGÉE de la DA, la même que le guide public.
  // L'intention du 21/10 est conservée : le sticky doit avoir une course, donc la
  // colonne ne doit pas être de hauteur automatique — ici c'est la feuille qui le
  // garantit (`position: sticky` sur `.da-guide-aside`, item de grille étiré).
  it("la timeline monte la grille de la DA, plus une grille locale", () => {
    expect(DASH_CODE).toMatch(/className="da-guide-grid"/);
    expect(DASH_CODE).toMatch(/className="da-guide-main"/);
    expect(DASH_CODE).not.toMatch(/rush-content-grid/);
    expect(DASH_CODE).not.toMatch(/rush-sidebar/);
  });

  it("le sticky est celui de la DA, partagé avec le guide public", () => {
    // Une seule règle : plus de `sticky` local dans le composant (deux sticky
    // imbriqués se contredisaient : 1 rem contre 5 rem).
    expect(DASH_CODE).toMatch(/className="da-guide-aside pr-1"/);
    expect(DASH_CODE).not.toMatch(/sticky top-4 max-h-\[calc\(100dvh-5\.5rem\)\]/);
    expect(codeOf("src/app/da-wakfu.css")).toMatch(/\.da-guide-aside\s*\{[^}]*position:\s*sticky/);
    expect(PUB_CODE).toMatch(/className="da-guide-aside"/);
  });
});

describe("Ciblage d'une quête (prérequis, repère, reprise)", () => {
  it("l'anneau de cible est visible (2 px + offset), sur les deux cartes", () => {
    // Carte normale ET carte bloquée : un simple `ring-1` se perdait dans le rouge.
    expect(DASH_CODE).toMatch(
      /focusedSeqId === seq\.id \? "ring-2 ring-success ring-offset-2 ring-offset-background"/
    );
    expect(DASH_CODE).toMatch(
      /focusedSeqId===seq\.id\?"ring-2 ring-success ring-offset-2 ring-offset-background":""/
    );
  });
});

describe("Carte bloquée — une quête reste une quête", () => {
  it("elle porte l'icône de quête (même asset que la carte normale)", () => {
    // E3 (05/11/2026) : l'état n'est plus une classe de fond posée à la main, c'est
    // l'attribut peint par la DA (`da-row[data-state="locked"]`). Même intention :
    // une quête verrouillée reste une quête et garde son icône.
    expect(DASH_CODE).toMatch(/data-state="locked"[\s\S]{0,700}icone-quete\.png/);
  });

  it("côté public, le bouton info n'est pas rendu quand la quête est verrouillée", () => {
    expect(PUB_CODE).toMatch(/\{!stepLocked && \(\s*<button[\s\S]{0,400}setDetailModalSeq/);
  });
});
