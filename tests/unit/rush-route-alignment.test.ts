import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Route d'alignement (décision du 24/11/2026) :
 *  · le choix cité / Ordre vit **une seule fois** dans le panneau de route ;
 *  · la page projette déjà la route (`resolveRushRoute`) : le bloc ne filtre plus ;
 *  · « Valider » est visible et valide le **périmètre visible**, pas les autres Ordres ;
 *  · la complétude d'un bloc se déduit de ses séquences de route, pas du drapeau global ;
 *  · l'overlay ne « décoche » plus un bloc entier par le nœud du chapitre : le reset
 *    est l'action dédiée.
 *
 * Les règles pures de périmètre sont couvertes par `rush-prereq-cascade`.
 */

const DASH = readFileSync(
  path.join(
    process.cwd(),
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx"
  ),
  "utf8"
);
const ACTIONS = readFileSync(
  path.join(process.cwd(), "src/server/actions/optimized-guide-actions.ts"),
  "utf8"
);
const OVERLAY = readFileSync(
  path.join(process.cwd(), "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx"),
  "utf8"
);
const CHAPTER_BAR = readFileSync(
  path.join(
    process.cwd(),
    "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterBar.tsx"
  ),
  "utf8"
);
const ORDER_SELECT = readFileSync(
  path.join(process.cwd(), "src/components/dofus-quests/rush/RushOrderSelect.tsx"),
  "utf8"
);

function actionBody(name: string, limit = 9000): string {
  const start = ACTIONS.indexOf(`function ${name}`);
  if (start < 0) return "";
  const end = ACTIONS.indexOf("\n/**", start + 10);
  return ACTIONS.slice(start, end > start ? end : start + limit);
}

describe("route d'alignement — un seul choix, un périmètre", () => {
  it("le choix d'Ordre vit dans un panneau unique, plus dans chaque bloc", () => {
    expect(DASH).toContain("function RushAlignmentPanel");
    expect(DASH).toContain("allowAll={false}");
    expect(DASH).toContain("Choisir ma cité");
    expect(DASH).toContain("quêtes de cité");
    // L'ancien filtre local a disparu du bloc.
    expect(DASH).not.toContain("orderFiltered");
  });

  it("« Valider » n'est plus conditionné par orderKey", () => {
    expect(DASH).toContain("(!hasOrderQuests||!!profileAlign.orderId)");
    expect(DASH).not.toContain("!allFiltered&&!orderKey");
  });

  it("le périmètre visible est transmis au serveur", () => {
    expect(DASH).toContain("toggleMilestoneProgress(guildId,ms.id,!was,effectiveAltPseudo,scope)");
    expect(OVERLAY).toContain(
      "toggleMilestoneProgress(guildId, ms.id, !was, effectiveAltPseudo, scope)"
    );
    const body = actionBody("toggleMilestoneProgress");
    expect(body).toContain("scopeSeqIds?: string[]");
    // Le périmètre de route est réduit à un représentant par étape à choix avant la
    // cascade (`checkIds`) ; `targetIds` reste le périmètre demandé pour la dévalidation.
    expect(body).toContain("choiceRepresentatives(targetContentSeqs, targetIds, previousSteps)");
    expect(body).toContain("targetSequenceIds: checkIds");
    expect(body).toContain("fullCompleted");
    expect(body).toContain("previousSteps.filter");
  });

  it("la complétude du bloc se déduit de la route, pas du drapeau global", () => {
    expect(DASH).toContain("isRouteBlockComplete");
    expect(DASH).toContain("routeContentIds");
    expect(OVERLAY).toContain("Même règle que le dashboard");
  });

  it("l'overlay réserve le reset au bouton dédié", () => {
    expect(CHAPTER_BAR).toContain("Bloc validé — utilise Réinitialiser pour décocher");
    expect(CHAPTER_BAR).not.toContain("Marquer le chapitre comme non terminé");
    expect(CHAPTER_BAR).toContain("onResetChapter");
  });

  it("le sélecteur d'Ordre peut masquer « Tous » pour un choix de route", () => {
    expect(ORDER_SELECT).toContain("allowAll");
    expect(ORDER_SELECT).toContain("Choisir un Ordre");
  });
});
