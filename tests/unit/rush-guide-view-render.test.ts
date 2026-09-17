import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushGuideView } from "@/components/dofus-quests/rush/RushGuideView";
import { buildRushGuideView } from "@/lib/rush-guide-view";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

/**
 * Preuve de rendu de LA vue partagée (Node + renderToStaticMarkup : aucune
 * dépendance ajoutée, pas de DOM).
 *
 * Depuis la coupe des trois sections (journal · préparation · repères), la vue ne
 * rend plus que DEUX sections : l'expédition (compteurs) et l'unique action qui
 * suit. Le retrait vaut pour les DEUX surfaces. On verrouille donc leur ABSENCE —
 * sans ce test, elles reviennent par inadvertance au prochain branchement.
 *
 * Ce qu'on verrouille ici :
 *   · l'unique action mise en avant, avec sa dépendance, sa coordonnée, son indice ;
 *   · les deux sections qui restent, et le fait qu'il n'y en a pas de troisième ;
 *   · la variante publique n'affiche AUCUNE présence communautaire ;
 *   · la vue n'expose AUCUNE entrée plein écran (retirée du lot public).
 */

const seq = (id: string, over: Partial<RushSequence> = {}): RushSequence => ({
  id,
  subGuideRef: id,
  subGuideName: id,
  isOptional: false,
  order: 0,
  ...over,
});

const block = (
  id: string,
  type: string,
  chapter: number,
  sequences: RushSequence[],
  over: Partial<RushMilestone> = {}
): RushMilestone => ({
  id,
  chapter,
  chapterLabel: `Chapitre ${chapter}`,
  title: id,
  type,
  order: 0,
  isOptional: false,
  sequences,
  ...over,
});

const S_DONE = seq("s-done", {
  subGuideName: "Le réceptacle des Dofus",
  activityTags: [{ type: "combat_tactique" }],
});
const S_PREREQ = seq("s-prereq", {
  subGuideName: "Protection divine",
  tips: "Parle d'abord à Pandala",
  activityTags: [{ type: "pos_tags", name: "12, -21" }],
});
const S_LOCKED = seq("s-locked", {
  subGuideName: "Le Dofus Pourpre",
  activityTags: [{ type: "prereq_text", name: "protection divine" }],
});
const S_TAIL = seq("s-tail", { subGuideName: "Vaincre 4 Pandikazes" });

const GUIDE = [
  block("m-done", "DONJON", 1, [S_DONE]),
  block("m-prereq", "QUETE_SERIE", 2, [S_PREREQ]),
  block("m-locked", "DOFUS", 2, [S_LOCKED]),
  block("m-tail", "DONJON", 3, [S_TAIL]),
];

const S_ALIGN = seq("s-align", {
  subGuideName: "Devenir Bontarien",
  activityTags: [{ type: "alignment_set", name: "bontarien", level: 12 }],
});

const GUIDE_ALIGN = [...GUIDE, block("m-align", "QUETE_SERIE", 4, [S_ALIGN])];

const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-done"] });

const html = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    React.createElement(RushGuideView, { view, ...props } as never)
  );

describe("RushGuideView — rendu partagé public ↔ guilde", () => {
  it("met en avant l'étape active, sa coordonnée et son indice replié", () => {
    const out = html({});
    expect(out).toContain("Protection divine");
    expect(out).toContain("/travel 12,-21");
    expect(out).toContain("Parle d&#x27;abord à Pandala");
    // L'indice est replié : <details> sans attribut open.
    expect(out).toContain("<details");
    expect(out).not.toMatch(/<details[^>]*\sopen/);
  });

  it("ne propose le bouton de validation que si la surface sait persister", () => {
    expect(html({})).not.toContain("Valider l&#x27;étape");
    const wired = html({ onValidateStep: () => {} });
    expect(wired).toContain("Valider l&#x27;étape");
  });

  it("nomme la dépendance qui bloque l'étape, plutôt qu'un cadenas muet", () => {
    const locked = buildRushGuideView({
      milestones: GUIDE,
      completedSeqIds: ["s-done", "s-prereq"],
    });
    const out = renderToStaticMarkup(
      React.createElement(RushGuideView, { view: locked } as never)
    );
    expect(out).toContain("Après <b>« Protection divine »</b>");
  });

  it("rend les deux sections qui restent, et elles seules", () => {
    const out = html({});
    expect(out).toContain('id="rgv-head-title"'); // 1 · l'expédition
    expect(out).toContain('id="rgv-now"'); // 2 · à faire maintenant
    expect(out).toContain("étapes franchies");
    // Une seule `.rgv-sec` en public = « À faire maintenant » : pas de 3e section.
    expect(out.match(/class="rgv-sec"/g)?.length).toBe(1);
  });

  it("ne rend plus le journal, la préparation ni les repères", () => {
    const out = html({});
    // Ni leurs intitulés…
    for (const titre of [
      "Journal de route",
      "Ce qui est derrière vous",
      "Ce qu&#x27;il reste à prévoir",
      "Où aller, dans l&#x27;ordre",
    ]) {
      expect(out).not.toContain(titre);
    }
    // …ni leurs classes CSS : la feuille a été purgée en même temps, donc une
    // classe qui réapparaîtrait dans le HTML ne serait même plus stylée.
    for (const classe of [
      "rgv-row",
      "rgv-list",
      "rgv-marker",
      "rgv-pill-done",
      "rgv-pill-locked",
      "rgv-res",
      "rgv-groupe",
      "rgv-switch",
      "rgv-options",
    ]) {
      expect(out).not.toContain(classe);
    }
    // Les étiquettes d'état (« En cours », « Optionnel ») sont retirées : l'eyebrow
    // « Étape active · n sur N » dit déjà l'état, sans boîte ni couleur.
    expect(out).not.toContain("rgv-pill");
    expect(out).toContain("Étape active");
  });

  it("annonce la fin du guide plutôt qu'une étape fantôme", () => {
    const done = buildRushGuideView({
      milestones: GUIDE,
      completedSeqIds: ["s-done", "s-prereq", "s-locked", "s-tail"],
    });
    const out = renderToStaticMarkup(
      React.createElement(RushGuideView, { view: done } as never)
    );
    expect(out).toContain("Guide terminé");
  });

  it("n'expose AUCUNE présence communautaire en variante publique", () => {
    const presence = React.createElement("p", null, "CAMPEMENT-TEMOIN");
    // Variante par défaut = public : la présence est ignorée, même fournie.
    expect(html({ presence })).not.toContain("CAMPEMENT-TEMOIN");
    // Variante guilde : elle apparaît, nommée pour ce qu'elle est.
    expect(html({ presence, variant: "guild" })).toContain("CAMPEMENT-TEMOIN");
  });

  it("n'expose aucune entrée plein écran (le lot public n'en veut pas)", () => {
    const out = html({ onValidateStep: () => {} });
    expect(out.toLowerCase()).not.toContain("plein écran");
    expect(out).not.toContain("?focus");
    expect(out).not.toContain("guide-fullscreen");
  });

  it("ne place jamais un bouton dans un bouton (copie de coordonnée à côté)", () => {
    const out = html({ onValidateStep: () => {} });
    const start = out.indexOf('class="rgv-btn rgv-btn-primary"');
    expect(start).toBeGreaterThan(-1);
    const segment = out.slice(start, out.indexOf("</button>", start));
    // La puce de coordonnée (elle-même un bouton) vit HORS du bouton d'action.
    expect(segment).not.toContain("<button");
  });

  it("affiche l'alignement acquis en temps réel — et le dit neutre sinon", () => {
    // Rien de validé : l'état est écrit, sans faux camp ni faux niveau.
    expect(html({})).toContain("aucune quête d&#x27;alignement validée");
    expect(html({})).toContain("/ordres/neutre.png");

    const aligned = buildRushGuideView({
      milestones: GUIDE_ALIGN,
      completedSeqIds: ["s-done", "s-align"],
    });
    const out = renderToStaticMarkup(
      React.createElement(RushGuideView, { view: aligned } as never)
    );
    expect(out).toContain("/ordres/bonta.png");
    expect(out).toContain("<b>Bontarien</b>");
    expect(out).toContain("tranche");
    // Le blason est un picto NU : aucune tuile, aucune teinte derrière lui.
    expect(out).toContain('class="rgv-icon"');
    expect(out).not.toContain("bg-info/10");
  });

  it("ne propose la remise à zéro que si la surface sait l'exécuter", () => {
    expect(html({})).not.toContain("Réinitialiser");
    const wired = html({ onResetProgress: () => {} });
    expect(wired).toContain("Réinitialiser la progression");
    // Action destructive : le premier rendu ne propose PAS l'effacement direct.
    expect(wired).not.toContain("Oui, tout effacer");
  });
});
