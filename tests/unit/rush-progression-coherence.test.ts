import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Verrous de la **cohérence de progression** (décisions du 23/11/2026) :
 *  · valider un bloc coche ses prérequis manquants (cascade montante) ;
 *  · il coche aussi les donjons requis ;
 *  · un reset efface les donjons du personnage et retire les prérequis orphelins ;
 *  · la fiche Dofus projette un bloc `isCompleted` en toutes ses quêtes ;
 *  · l'overlay propose le reset du bloc courant.
 *
 * Les règles pures sont couvertes par `rush-prereq-cascade`, `rush-block-dungeons` et
 * `rush-dofus-progress-projection` ; ces tests verrouillent le **branchement**.
 */

const ACTIONS = readFileSync(
  path.join(process.cwd(), "src/server/actions/optimized-guide-actions.ts"),
  "utf8"
);

function bodyOf(name: string, limit = 9000): string {
  const start = ACTIONS.indexOf(`function ${name}`);
  if (start < 0) return "";
  const end = ACTIONS.indexOf("\n/**", start + 10);
  return ACTIONS.slice(start, end > start ? end : start + limit);
}

describe("cohérence de progression — serveur", () => {
  it("la validation de bloc applique la cascade et les donjons", () => {
    const body = bodyOf("toggleMilestoneProgress");
    expect(body).toContain("planPrerequisiteCascade");
    expect(body).toContain("planRequiredDungeonChecks");
    expect(body).toContain("applyDungeonChecks");
    expect(body).toContain("removeCascadeProgress");
    // Le bloc reste un confort : jamais les gardes fail-closed de la quête seule.
    expect(body).not.toContain("findSequenceBlockedByMissingDungeon");
    expect(body).not.toContain("findSequenceBlockedByPrereq");
  });

  it("le reset d'un bloc retire la cascade et efface ses donjons", () => {
    const body = bodyOf("resetMilestoneProgress");
    expect(body).toContain("removeCascadeProgress");
    expect(body).toContain("playerGuideDungeonState.deleteMany");
  });

  it("le reset du guide efface les donjons du personnage", () => {
    const body = bodyOf("resetGuideProgress");
    expect(body).toContain("playerGuideDungeonState.deleteMany");
  });

  it("« tout valider » coche les donjons requis", () => {
    const body = bodyOf("completeGuideProgress");
    expect(body).toContain("planRequiredDungeonChecks");
    expect(body).toContain("applyDungeonChecks");
  });
});

describe("cohérence de progression — UI", () => {
  it("la fiche Dofus projette un bloc isCompleted en toutes ses quêtes", () => {
    const panel = readFileSync(
      path.join(
        process.cwd(),
        "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/GuildStatusPanel.tsx"
      ),
      "utf8"
    );
    expect(panel).toContain("memberCompletedStepKeys");
    expect(panel).toContain("sequenceIdsByMilestone");
  });

  it("la modale Progression Donjons affiche le statut de chaque membre", () => {
    const modal = readFileSync(
      path.join(process.cwd(), "src/components/dofus-quests/rush/RushDungeonsOverviewModal.tsx"),
      "utf8"
    );
    expect(modal).toContain("MemberStatusStack");
    expect(modal).toContain("pas fait");
    expect(modal).toContain("repère");
  });

  it("la barre de chapitre de l'overlay propose le reset du bloc", () => {
    const bar = readFileSync(
      path.join(
        process.cwd(),
        "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterBar.tsx"
      ),
      "utf8"
    );
    expect(bar).toContain("onResetChapter");
    expect(bar).toContain("Réinitialiser ce bloc");
    expect(bar).toContain("Confirmer la réinitialisation");
  });
});
