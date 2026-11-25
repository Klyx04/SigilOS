import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Revalidations du guide Rush (itération 4).
 *
 * La page publique est en **ISR 1 h** (`revalidate = 3600`) : sans
 * `revalidatePath`, une modification faite dans God reste invisible au public
 * pendant une heure. Ce verrou impose une **source unique** (`revalidateRushContent`)
 * pour les actions de contenu, et interdit de revalider la page publique depuis
 * une action de progression (qui ne change pas le contenu).
 */

const CODE = readFileSync(
  path.join(process.cwd(), "src/server/actions/optimized-guide-actions.ts"),
  "utf8"
);

/** Actions qui modifient le **contenu** du guide Rush (God). */
const CONTENT_ACTIONS = [
  "importRushGuide",
  "upsertRushSequence",
  "upsertRushMilestone",
  "deleteRushSequence",
  "deleteRushMilestone",
  "reorderRushSequences",
  "reorderRushMilestones",
  "seedRushSylvestreFromGuide",
  "updateRushBlockRoute",
  "updateRushUIConfig",
  "updateRushSylvestreSettings",
  "moveRushSequence",
  "bulkDeleteRushSequences",
  "bulkMoveRushSequences",
  "bulkUpdateRushSequencesRoute",
  "splitRushSequence",
  "syncRushPositions",
  "syncRushGuideContent",
  "duplicateRushSequenceAsTwin",
  "duplicateRushSequenceAsOrderTwins",
] as const;

/** Actions de **progression** membre : elles ne changent pas le contenu public. */
const PROGRESS_ACTIONS = [
  "setRushSequenceProgress",
  "toggleMilestoneProgress",
  "setRushResourceChecks",
  "setRushDungeonState",
  "applyRushAlignmentFromSequence",
  "resetRushAlignment",
  "resetGuideProgress",
  "resetMilestoneProgress",
  "setRushBookmark",
  "updateBookmarkedStep",
  "updateStepProgress",
  "completeGuideProgress",
] as const;

function bodyOf(name: string): string {
  // Matche `export async function X` comme le helper non exporté `function X`.
  const start = CODE.indexOf(`function ${name}`);
  if (start < 0) return "";
  const end = CODE.indexOf("\n/**", start + 10);
  return CODE.slice(start, end > start ? end : start + 9000);
}

describe("revalidateRushContent — source unique", () => {
  it("le helper revalide les trois surfaces et n'est pas exporté", () => {
    const helper = bodyOf("revalidateRushContent");
    expect(helper).toContain('revalidatePath("/guides/rush-sylvestre")');
    // Les fiches /q/[slug] sont ISR 3600 : sans revalidation, un backfill
    // positions/conditions reste invisible jusqu'à une heure (mesure 25/11).
    expect(helper).toContain('revalidatePath("/guides/rush-sylvestre/q/[slug]", "page")');
    expect(helper).toContain('revalidatePath("/dashboard")');
    expect(helper).toContain('revalidatePath("/god/rush-sylvestre")');
    // Un fichier `"use server"` ne peut exporter que des fonctions async.
    expect(CODE).not.toContain("export function revalidateRushContent");
    expect(CODE).not.toContain("export async function revalidateRushContent");
  });

  it("chaque action de contenu appelle le helper", () => {
    for (const name of CONTENT_ACTIONS) {
      const body = bodyOf(name);
      expect(body, `${name} introuvable`).not.toBe("");
      expect(body, `${name} doit revalider le contenu`).toContain("revalidateRushContent()");
    }
  });

  it("aucune action de progression ne revalide le contenu public", () => {
    for (const name of PROGRESS_ACTIONS) {
      const body = bodyOf(name);
      expect(body, `${name} introuvable`).not.toBe("");
      expect(body, `${name} ne doit pas revalider le contenu`).not.toContain("revalidateRushContent()");
    }
  });

  it("aucun ancien doublet god + dashboard ne subsiste", () => {
    expect(CODE).not.toMatch(
      /revalidatePath\("\/god\/rush-sylvestre"\);\s*revalidatePath\("\/dashboard"\);/
    );
  });

  it("la publication revalide toujours sa page /q", () => {
    const body = bodyOf("publishRushSequence");
    expect(body).toContain("/guides/rush-sylvestre/q/");
  });
});
