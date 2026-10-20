/**
 * Gardes — **tranches & changement de cité**.
 *
 * 🎯 Demandes user (20/10/2026, verbatim) : « on a en dur le choix des tranches partout
 * … il faut se débarrasser des tranches, les ordres font foi » · « dans le rush en cochant
 * une quête d'alignement notre alignement doit changer en live » · « en jeu si tu changes
 * d'alignement tu reset toutes les quetes en repartant de la 1ere quete de l'alignement
 * choisi » · « plus de déclaratif en dur des tranches possibles, ca se populera tout seul ».
 *
 * 🛡️ Ce que ce test verrouille :
 *  • plus AUCUN sélecteur de tranche (rush, overlay, profil, mules) ;
 *  • l'Ordre n'est plus effacé par une coche de quête d'alignement ;
 *  • changer de cité réinitialise les quêtes d'alignement (les autres gardent leur avancement) ;
 *  • la coche continue de mettre l'alignement à jour en direct.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const FORM = "src/components/dofus-quests/rush/AlignmentChoiceForm.tsx";
const RESET = "src/server/rush-alignment.ts";
const ACTIONS = "src/server/actions/optimized-guide-actions.ts";
const PROFILE = "src/server/actions/profile-actions.ts";

describe("plus de tranche déclarative", () => {
  it("le sélecteur du rush ne propose que cité + Ordre", () => {
    const code = read(FORM);
    expect(code).not.toContain("getAlignmentLevelSteps");
    expect(code).not.toContain("Tranche");
    expect(code).not.toContain("alignmentLevel");
    // Cité et Ordre sont bien les deux seuls choix.
    expect(code).toContain("ALIGNMENTS.map");
    expect(code).toContain("orders.map");
  });

  it("le profil et les mules n'ont plus de sélecteur de tranche", () => {
    expect(read("src/components/profile/alignment-section.tsx")).not.toContain("getAlignmentLevelSteps");
    expect(read("src/components/profile/alt-pseudos.tsx")).not.toContain("getAlignmentLevelSteps");
  });

  it("la tranche d'une mule n'est plus obligatoire dans la requête", () => {
    const code = read(PROFILE);
    const start = code.indexOf("const UpdateMuleAlignmentSchema");
    const block = code.slice(start, start + 500);
    expect(block).toMatch(/alignmentLevel:\s*z\.number\(\)\.min\(0\)\.max\(100\)\.optional\(\)/);
  });
});

describe("l'Ordre fait foi", () => {
  it("cocher/décocher une quête d'alignement n'efface plus l'Ordre", () => {
    const code = read(ACTIONS);
    const start = code.indexOf("export async function applyRushAlignmentFromSequence");
    const end = code.indexOf("export async function", start + 10);
    const body = code.slice(start, end > start ? end : start + 5000);
    expect(body).not.toContain("alignmentOrder = null");
    expect(body).not.toContain("alignmentOrder: null");
  });

  it("la coche met bien l'alignement à jour en direct (dashboard + overlay)", () => {
    expect(read("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx")).toContain(
      "applyRushAlignmentFromSequence"
    );
    expect(read("src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx")).toContain(
      "applyRushAlignmentFromSequence"
    );
  });
});

describe("changer de cité = reset des quêtes d'alignement", () => {
  it("le reset ne retire QUE les séquences d'alignement", () => {
    const code = read(RESET);
    expect(code).toContain('tags.some((tag) => tag?.type === "alignment_set")');
    // La quête qui vient d'être cochée est conservée.
    expect(code).toMatch(/id === keepSeqId/);
    expect(code).toMatch(/!ids\.has\(id\) \|\| id === keepSeqId/);
  });

  it("le formulaire déclenche le reset AVANT d'écrire la nouvelle cité", () => {
    const code = read(FORM);
    expect(code).toContain("resetAlignmentProgress(guildId, mulePseudo ?? undefined)");
    const resetAt = code.indexOf("resetAlignmentProgress(");
    const writeAt = code.indexOf("await updateUserProfile", resetAt);
    expect(resetAt).toBeGreaterThan(-1);
    expect(writeAt).toBeGreaterThan(resetAt);
  });

  it("le reset est une action authentifiée et limitée en débit", () => {
    const code = read(ACTIONS);
    const start = code.indexOf("export async function resetAlignmentProgress");
    const body = code.slice(start, start + 900);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("getUserContext(guildId)");
    expect(body).toContain("rateLimit(");
  });
});
