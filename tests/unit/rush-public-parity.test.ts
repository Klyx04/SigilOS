/**
 * Garde — PARITÉ guide public ↔ guide interne.
 *
 * 🎯 Demande user (21/09/2026) : « les guides public et interne sont totalement les
 * mêmes ; ce qui diffère, c'est la non-présence de tout ce qui touche à des
 * interactions internes connectées au dashboard ».
 *
 * Défauts mesurés le même jour :
 *   · les prérequis entre quêtes ne bloquaient RIEN côté public (l'interne refuse) ;
 *   · le panneau de droite (chapitres, progression, donjons & métiers à prévoir,
 *     objets requis) n'existait pas côté public ;
 *   · le pense-bête manquait côté public ;
 *   · le bloc « À faire maintenant » restait affiché côté public.
 *
 * 🛡️ On verrouille le câblage des DEUX surfaces sur les MÊMES composants partagés.
 * Lecture seule : aucune base, aucun rendu navigateur.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const SIDEBAR = "src/components/dofus-quests/rush/RushChapterSidebar.tsx";
const RESOURCES_MODAL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayResourcesModal.tsx";
const QUEST_ITEM_GRID = "src/components/dofus-quests/rush/QuestItemResourceGrid.tsx";

const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const PUB = codeOf(PUBLIC);
const DASH = codeOf(DASHBOARD);

describe("Prérequis — le public refuse EXACTEMENT ce que l'interne refuse", () => {
  it("le public applique la règle partagée `isSequenceBlockedByPrereqs`", () => {
    expect(PUB).toMatch(/isSequenceBlockedByPrereqs/);
    expect(PUB).toMatch(/const isStepLocked = useCallback/);
  });

  it("la validation est gardée fail-closed dans les TROIS chemins d'écriture", () => {
    // étape · chapitre entier · lot de quêtes
    expect(PUB).toMatch(/if \(!was && isStepLocked\(seqId\)\)/);
    expect(PUB).toMatch(/if \(completeAll && !current\.has\(s\.id\) && isStepLocked\(s\.id\)\) return;/);
    expect(PUB).toMatch(/isSequenceBlockedByPrereqs\(s, completedSeqIds, milestones\)/);
  });

  it("la quête verrouillée se dit : carte danger, case inerte, prérequis nommés", () => {
    expect(PUB).toMatch(/border-danger\/30 bg-danger\/\[0\.05\]/);
    expect(PUB).toMatch(/disabled=\{stepLocked\}/);
    expect(PUB).toMatch(/getPrereqRefs\(seq, milestones\)/);
    expect(PUB).toMatch(/À terminer avant :/);
  });
});

describe("Panneau de droite — le MÊME composant dans les deux guides", () => {
  it("la sidebar est partagée (hors du dossier dashboard) et existe", () => {
    expect(existsSync(SIDEBAR)).toBe(true);
    expect(existsSync("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushChapterSidebar.tsx")).toBe(false);
  });

  it("les deux surfaces l'importent depuis le registre partagé", () => {
    for (const [name, code] of [["public", PUB], ["interne", DASH]] as const) {
      expect(code, `${name} n'importe pas la sidebar partagée`).toMatch(
        /import \{ RushChapterSidebar \} from "@\/components\/dofus-quests\/rush\/RushChapterSidebar"/
      );
      expect(code, `${name} ne la rend pas`).toMatch(/<RushChapterSidebar/);
    }
  });

  it("le public y branche la navigation de chapitre (mêmes gestes)", () => {
    expect(PUB).toMatch(/selectedChapter=\{currentPage\?\.ms\.chapter \?\? "ALL"\}/);
    expect(PUB).toMatch(/onSelectChapter=\{\(chapter\) => \{/);
    expect(PUB).toMatch(/goToChapterPage\(idx\)/);
  });
});

describe("Pense-bête — monté côté public, avec la config GOD", () => {
  it("le public rend la même modale que l'interne", () => {
    expect(PUB).toMatch(/import \{ RushPenseBeteModal \}/);
    expect(PUB).toMatch(/<RushPenseBeteModal/);
    expect(PUB).toMatch(/resolveRushUIConfig\(guide\.rushUIConfig\)\?\.penseBete/);
  });
});

describe("« À faire maintenant » — supprimé avec tout l'en-tête redondant de la vue", () => {
  it("le composant de vue partagée n'existe plus (et la feuille `rgv-*` non plus)", () => {
    expect(existsSync("src/components/dofus-quests/rush/RushGuideView.tsx")).toBe(false);
    expect(existsSync("src/components/dofus-quests/rush/rush-guide-view.css")).toBe(false);
    // …ni son import dans la feuille globale (sinon le build casse).
    expect(readFileSync("src/app/globals.css", "utf8")).not.toContain("rush-guide-view.css");
  });

  it("le guide public ne rend plus ni la vue, ni le bloc « À faire maintenant »", () => {
    expect(PUB).not.toMatch(/<RushGuideView/);
    expect(PUB).not.toMatch(/RushGuideView\b.*from "@\/components/);
    expect(PUB).not.toMatch(/À faire maintenant/);
    expect(PUB).not.toMatch(/Votre fil conducteur/);
  });

  it("ce que l'en-tête portait vit maintenant dans le panneau de progression", () => {
    // Alignement recalculé à chaque coche + remise à zéro en deux temps.
    expect(PUB).toMatch(/rushView\.alignment/);
    expect(PUB).toMatch(/function ResetProgressButton\(/);
    expect(PUB).toMatch(/onReset=\{handleResetProgress\}/);
    // Une barre de progression lisible dans le panneau (le seul endroit).
    expect(PUB).toMatch(/Progression locale[\s\S]{0,400}role="progressbar"/);
  });
});

describe("Ressources — plus aucun nom tronqué dans les listes", () => {
  it("la modale partagée affiche le nom complet", () => {
    const modal = codeOf(RESOURCES_MODAL);
    expect(modal).not.toMatch(/font-semibold truncate min-w-0 flex-1/);
    expect(modal).toMatch(/break-words/);
  });

  it("la sidebar et la grille d'objets aussi", () => {
    expect(codeOf(SIDEBAR)).not.toMatch(/font-medium truncate text-xs/);
    expect(codeOf(SIDEBAR)).toMatch(/break-words/);
    expect(codeOf(QUEST_ITEM_GRID)).not.toMatch(/font-semibold block truncate/);
    expect(codeOf(QUEST_ITEM_GRID)).toMatch(/break-words/);
  });

  it("les grilles gardent une largeur de colonne MINIMALE (jamais un mot cassé lettre par lettre)", () => {
    // Défaut vu par le user : colonnes écrasées → « E a u   P o t a b l e ».
    const minCol = /grid-cols-\[repeat\(auto-fill,minmax\(15rem,1fr\)\)\]/;
    expect(codeOf(QUEST_ITEM_GRID)).toMatch(minCol);
    expect(codeOf(RESOURCES_MODAL)).toMatch(minCol);
    // Le message « aucune ressource » occupe toute la largeur de la grille.
    expect(codeOf(RESOURCES_MODAL)).toContain("col-span-full");
  });
});

describe("Panneau public — les quatre actions sont alignées", () => {
  it("une seule grille responsive porte les quatre boutons", () => {
    expect(PUB).toMatch(/grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-4/);
  });

  it("chaque bouton prend toute sa cellule (largeurs régulières, aucun débordement)", () => {
    expect(PUB.match(/reg-btn reg-btn-secondary w-full/g)?.length).toBe(3);
    expect(PUB.match(/reg-btn reg-btn-primary w-full/g)?.length).toBe(1);
  });
});
