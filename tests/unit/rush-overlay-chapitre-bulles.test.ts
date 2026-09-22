/**
 * Gardes — retours user du 21/09/2026 sur l'overlay du guide Rush :
 *
 *  1. « ok mais pour le chapitre faut pouvoir changer quand on veut quand même » : la vue
 *     de jeu compacte ne proposait que « Précédent / Suivant », et `goToNextMs` **saute**
 *     les chapitres déjà validés (`nextBlockIndex`) ⇒ aucun moyen de rejoindre un chapitre
 *     d'où on vient. Le sélecteur **partagé** est désormais monté **en ligne** dans la vue
 *     compacte, même quand un bandeau remplace l'objectif.
 *  2. « ca serait bien d'avoir les bulles profil avec mini modale scrollable aussi sur
 *     l'overlay dans chaque quête » : les bulles ne se calculaient que pour le chapitre
 *     COURANT (`row.milestoneId !== currentMs.id` filtré) et les résultats de recherche
 *     passaient `bookmarkers={[]}` ⇒ aucune bulle hors du chapitre courant ; et la liste de
 *     la mini-modale n'avait pas `min-h-0` ⇒ elle **débordait au lieu de défiler** dans une
 *     fenêtre PiP réduite.
 *
 * 🛡️ Lecture seule : on verrouille le **câblage des sources** (commentaires retirés) plus un
 * **rendu réel** du chip de bulles. Aucune base, aucun rendu de page.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushOverlayMemberBubbles } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayMemberBubbles";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const BASE = "src/app/overlay/guide/[guildId]/[slug]";
const OVERLAY = `${BASE}/GuideOverlayClient.tsx`;
const TREE = `${BASE}/components/RushOverlayChapterTree.tsx`;
const COMPACT = `${BASE}/components/RushOverlayCompact.tsx`;
const LIST_ITEM = `${BASE}/components/RushOverlayQuestListItem.tsx`;
const BUBBLES = `${BASE}/components/RushOverlayMemberBubbles.tsx`;
const MEMBERS_MODAL = `${BASE}/components/RushOverlayMembersModal.tsx`;

describe("overlay — changer de chapitre à tout moment (vue de jeu comprise)", () => {
  it("le sélecteur partagé sait se monter sans le chrome de barre (variant inline)", () => {
    const tree = codeOf(TREE);
    expect(tree).toMatch(/variant\?: "panel" \| "inline";/);
    expect(tree).toMatch(/if \(isInline\) \{/);
    // La barre complète (chrome + barre de progression) reste le rendu par DÉFAUT.
    expect(tree).toMatch(/"relative shrink-0 px-3 py-2.5 border-b z-30"/);
    expect(tree).toMatch(/\{activeMs && total > 0 && chapterPos >= 0 && \(/);
  });

  it("la vue compacte monte CE sélecteur, pas une liste maison", () => {
    const compact = codeOf(COMPACT);
    expect(compact).toMatch(/import \{ RushOverlayChapterTree \} from "\.\/RushOverlayChapterTree";/);
    expect(compact).toMatch(/<RushOverlayChapterTree[\s\S]{0,200}variant="inline"/);
    // Aucun `<select>` de chapitre local, aucun composant de navigation dupliqué.
    expect(compact).not.toMatch(/<select/);
  });

  it("le sélecteur reste accessible même quand un bandeau remplace l'objectif", () => {
    const compact = codeOf(COMPACT);
    // Le titre du bloc n'est plus conditionné à `!body` : seul le compteur « Étape n/m » l'est.
    expect(compact).not.toMatch(/\{!body && \([\s\S]{0,120}\{milestone\.title\}/);
    expect(compact).not.toMatch(/\{!body && \([\s\S]{0,120}<RushOverlayChapterTree/);
    expect(compact).toMatch(/\{!body && stepLabel && \(/);
  });

  it("l'overlay câble la navigation chapitres sur la vue compacte", () => {
    const overlay = codeOf(OVERLAY);
    expect(overlay).toMatch(/chapters=\{milestones\}/);
    expect(overlay).toMatch(/onSelectChapter=\{selectChapter\}/);
    expect(overlay).toMatch(/doneByMs=\{completedStepsByMs\}/);
  });
});

describe("overlay — bulles profil sur CHAQUE quête (pas seulement le chapitre courant)", () => {
  it("les repères de guilde sont indexés pour tous les chapitres", () => {
    const overlay = codeOf(OVERLAY);
    // Le bloc « qui est ici, PAR QUÊTE » (ids de séquence valides + index par séquence)
    // ne doit plus dépendre du chapitre courant. La présence « sur ce chapitre »
    // (`chapterMembers`) garde, elle, son filtre par chapitre : ce n'est pas la même question.
    const start = overlay.indexOf("const validSeqIds = useMemo");
    const end = overlay.indexOf("const openSeqMembers");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = overlay.slice(start, end);
    expect(block).not.toMatch(/currentMs/);
    expect(block).toMatch(/for \(const ms of milestones\) for \(const s of ms\.sequences\) ids\.add\(s\.id\);/);
  });

  it("les résultats de recherche ne perdent plus leurs bulles", () => {
    const overlay = codeOf(OVERLAY);
    expect(overlay).not.toMatch(/bookmarkers=\{\[\]\}/);
    // Deux listes : les résultats de recherche ET le chapitre courant.
    expect(overlay.match(/bookmarkers=\{bookmarkersBySeq\.get\(seq\.id\) \|\| \[\]\}/g)?.length).toBe(2);
    expect(overlay.match(/onOpenBookmarkers=\{\(\) => openSeqMembers\(seq\)\}/g)?.length).toBe(2);
  });

  it("un membre présent deux fois (principal + mule) ne produit qu'UNE bulle", () => {
    const overlay = codeOf(OVERLAY);
    expect(overlay).toMatch(/const memberKey = row\.profileId \|\| row\.userName;/);
    expect(overlay).toMatch(/if \(seenForSeq\.has\(memberKey\)\) continue;/);
  });

  it("les bulles viennent d'une brique unique, partagée par la liste et la vue de jeu", () => {
    expect(codeOf(LIST_ITEM)).toMatch(
      /import \{ RushOverlayMemberBubbles, type OverlayBubbleMember \} from "\.\/RushOverlayMemberBubbles";/
    );
    expect(codeOf(COMPACT)).toMatch(
      /import \{ RushOverlayMemberBubbles, type OverlayBubbleMember \} from "\.\/RushOverlayMemberBubbles";/
    );
    // Plus aucune pile d'avatars recopiée dans la ligne de quête.
    expect(codeOf(LIST_ITEM)).not.toMatch(/bookmarkers\.slice\(0, 3\)/);
    expect(codeOf(BUBBLES)).toMatch(/export function RushOverlayMemberBubbles\(/);
  });
});

describe("overlay — la mini-modale des membres défile vraiment", () => {
  it("la liste est bornée ET défilante (min-h-0 dans un flex en hauteur bornée)", () => {
    const modal = codeOf(MEMBERS_MODAL);
    expect(modal).toMatch(/max-h-\[min\(70vh,22rem\)\]/);
    expect(modal).toMatch(/min-h-0 flex-1 space-y-1 overflow-y-auto/);
  });

  it("elle reste fermable (Échap + bouton) et annonce le compte", () => {
    const modal = codeOf(MEMBERS_MODAL);
    expect(modal).toMatch(/if \(e\.key === "Escape"\) onClose\(\);/);
    expect(modal).toMatch(/aria-label="Fermer"/);
    expect(modal).toMatch(/\{members\.length\}/);
  });
});

describe("rendu réel du chip de bulles", () => {
  it("affiche la pile d'avatars, l'initiale de repli, le compte et la liste des pseudos", () => {
    const html = renderToStaticMarkup(
      React.createElement(RushOverlayMemberBubbles, {
        members: [
          { name: "Arakne", avatar: "/a.png" },
          { name: "Bworker" },
          { name: "cipatte", avatar: "/c.png" },
          { name: "Dofus" },
        ],
        onOpen: () => {},
      })
    );

    // 2 avatars (Arakne, cipatte) + l'initiale du pseudo sans avatar (Bworker).
    expect(html.match(/<img/g)?.length).toBe(2);
    expect(html).toContain(">B<");
    expect(html).toContain(">4<");
    // Les pseudos des membres NON dessinés restent lisibles (survol + lecteur d'écran).
    expect(html).toContain("aria-label=\"Voir les membres ici (4) : Arakne, Bworker, cipatte, Dofus\"");
  });

  it("ne dessine jamais une bulle vide", () => {
    const html = renderToStaticMarkup(
      React.createElement(RushOverlayMemberBubbles, { members: [], onOpen: () => {} })
    );
    expect(html).toBe("");
  });
});
