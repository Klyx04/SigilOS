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

// ─────────────────────────────────────────────────────────────────────────────
// Rail de droite — UNE seule zone de défilement, aucune brique écrasée.
// 🎯 Mesure Playwright du 08/10/2026 (guide public, 1440×900 puis 1280×720) : le rail
// borné (`xl:max-h-[calc(100vh-6rem)]`) ne défilait PAS (`scrollHeight === clientHeight`)
// parce que ses blocs gardaient `flex-shrink: 1` → « Chapitres » tombait à 201 px pour
// 242 px de contenu, « Objets requis » à 302 px (63 objets), et 2 barres de défilement
// s'imbriquaient. Correctif : blocs `shrink-0`, listes à hauteur NATURELLE, une seule
// zone de défilement (le rail) — après, 0 scroller imbriqué et 3311 px de contenu.
// ─────────────────────────────────────────────────────────────────────────────
const SIDE = codeOf(SIDEBAR);

describe("Rail de droite — une seule zone de défilement (jamais de brique écrasée)", () => {
  it("aucune liste à défilement interne (les `max-h` fantômes ont disparu)", () => {
    expect(SIDE).not.toMatch(/max-h-\[340px\]/);
    expect(SIDE).not.toMatch(/max-h-\[380px\]/);
    // Le rail ne porte AUCUN `overflow` propre : c'est la surface qui le borne.
    expect(SIDE).not.toMatch(/overflow-y-auto/);
  });

  it("chaque bloc est insécable (`shrink-0`) — aucun ne se comprime", () => {
    expect(SIDE).toMatch(/flex shrink-0 items-center justify-between border-b border-border pb-2\.5/);
    expect(SIDE).toMatch(/flex shrink-0 flex-col gap-1"/); // sommaire des chapitres
    expect(SIDE).toMatch(/flex shrink-0 items-center gap-4 bg-elevated/); // progression
    expect(SIDE).toMatch(/flex shrink-0 flex-col gap-2\.5 bg-elevated/); // donjons + métiers
    expect(SIDE).toMatch(/hidden shrink-0 flex-col gap-2 bg-elevated/); // objets requis (xl+)
  });

  it("le rail accepte de descendre sous son contenu (`min-h-0`) et les lignes restent tapables", () => {
    expect(SIDE).toMatch(/"flex min-h-0 flex-col gap-3\.5 bg-surface/);
    expect(SIDE).toMatch(/w-full min-h-9 flex items-center gap-2\.5/);
  });

  it("« Objets requis » est masqué sous `xl` (la modale « Ressources à prévoir » le porte)", () => {
    // Mesure 390 px : ce bloc faisait ~2 900 px en flux naturel sous le contenu.
    expect(SIDE).toMatch(
      /className="hidden shrink-0 flex-col gap-2 bg-elevated p-3 rounded-\[6px\] border border-border xl:flex"/
    );
    // Les autres blocs du rail restent visibles au doigt : ils n'ont pas d'équivalent.
    expect(SIDE).toMatch(/flex shrink-0 flex-col gap-1"/); // sommaire des chapitres
    expect(SIDE).toMatch(/flex shrink-0 flex-col gap-2\.5 bg-elevated/); // donjons + métiers
  });

  it("les DEUX surfaces le bornent au SCROLLPORT (fin atteignable, défilement interne)", () => {
    // ⚠️ Mesure Playwright du 08/10/2026 : dans le guide interne le défilement se fait
    // dans `<main overflow-y-auto>` (le TopNav `h-14` = 3,5 rem est HORS du scrollport,
    // le footer est dedans) ⇒ `100dvh − 6rem` faisait déborder le rail de 40 px sous la
    // ligne (bas coupé, fin « Objets requis » inatteignable). Corrigé : `top-4` (1 rem
    // sous le topnav) + `100dvh − 5,5 rem`.
    expect(DASH).toMatch(/sticky top-4 max-h-\[calc\(100dvh-5\.5rem\)\] overflow-y-auto custom-scrollbar/);
    // Le guide public défile par la FENÊTRE : `100dvh − 6rem` y est juste (mesuré).
    expect(PUB).toMatch(
      /xl:sticky xl:top-20 xl:max-h-\[calc\(100dvh-6rem\)\] xl:overflow-y-auto custom-scrollbar/
    );
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

// ─────────────────────────────────────────────────────────────────────────────
// Ressources — UN SEUL état : le toggle « Masquer les étapes faites » du guide
// les pilote sur les TROIS surfaces, au lieu de trois bascules indépendantes
// (rail « Restantes/Toutes », modale « Restantes/Toutes », filtre de la grille).
// 🎯 Demande user (08/10/2026) : « les ressources doivent aussi être masquées si
// on coche afficher tout / masquer côté overlay et dans les guides ».
// ─────────────────────────────────────────────────────────────────────────────
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const DETAIL_MODAL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx";

describe("Ressources — le toggle du guide les masque partout (un seul état)", () => {
  it("les trois surfaces passent LEUR toggle aux ressources", () => {
    expect(PUB).toMatch(/hideProvidedResources=\{hideDone\}/);
    expect(DASH).toMatch(/hideProvidedResources=\{hideDone\}/);
    expect(codeOf(OVERLAY)).toMatch(/hideProvidedResources=\{hideCompleted\}/);
  });

  it("rail, modale et grille escamotent leur filtre local quand le guide impose l'état", () => {
    // Rail « Objets requis » : un seul état dérivé (le guide prime) + bascule non rendue.
    expect(codeOf(SIDEBAR)).toMatch(/const hideProvided = hideProvidedResources \|\| hideCompletedItems;/);
    expect(codeOf(SIDEBAR)).toMatch(/if \(hideProvided\) return aggregatedItems\.filter/);
    expect(codeOf(SIDEBAR)).toMatch(/\{visibleItems\.length\}<\/span>/);
    expect(codeOf(SIDEBAR)).toMatch(/aggregatedItems\.length > 0 && !hideProvidedResources &&/);
    // Modale globale : mode forcé « restantes » + bascule non rendue.
    const modal = codeOf(RESOURCES_MODAL);
    expect(modal).toMatch(/const effectiveMode = hideProvidedResources \? "restantes" : mode;/);
    expect(modal).toMatch(/!hideProvidedResources &&\s*\(\[\["restantes", "Restantes"\], \["toutes", "Toutes"\]\]/);
    // Grille d'objets : les fournis sortent, et son filtre local disparaît.
    const grid = codeOf(QUEST_ITEM_GRID);
    expect(grid).toMatch(/if \(hideProvided\) return parsedItems\.filter\(\(it\) => !it\.isDone\)/);
    expect(grid).toMatch(/showHeaderMeta && !hideProvided &&/);
  });

  it("la fiche détail ne montre plus les ressources d'une quête validée", () => {
    const detail = codeOf(DETAIL_MODAL);
    expect(detail).toMatch(/resources\.length > 0 && !\(hideProvidedResources && isDone\)/);
  });

  it("les grilles par quête du public reçoivent la clé fournie et l'état", () => {
    // Grille de parcours ET panneau déroulant d'étape : même filtre.
    expect(PUB.match(/hideProvided=\{hideDone\}/g)?.length).toBe(2);
    expect(PUB.match(/completedIds=\{completedItemKeys\}/g)?.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Guide interne — l'interrupteur de densité est DANS la barre d'actions.
// 🎯 Demande user (08/10/2026) : « ce bouton doit être dispo en dehors du menu
// d'option dans le guide interne, c'est pas assez intuitif ».
// ─────────────────────────────────────────────────────────────────────────────
describe("Guide interne — le masquage des étapes faites n'est plus enterré dans « Options »", () => {
  it("le menu Options ne le porte plus", () => {
    expect(DASH).not.toMatch(/<DropdownMenuItem onClick=\{\(\) => setHideDone/);
    expect(DASH).not.toMatch(/"Masquer les terminées"/);
  });

  it("il est monté à côté de « Ressources à prévoir » / « Pense-bête », état lisible", () => {
    expect(DASH).toMatch(/Pense-bête[\s\S]{0,1200}aria-pressed=\{hideDone\}/);
    expect(DASH).toMatch(/aria-label=\{hideDone \? "Afficher les étapes terminées" : "Masquer les étapes terminées"\}/);
    expect(DASH).toMatch(/\{hideDone \? <Eye className="w-3\.5 h-3\.5" \/> : <EyeOff className="w-3\.5 h-3\.5" \/>\}/);
  });
});

