/**
 * Verrou de navigation — clic sur un prérequis + retour (26/11/2026).
 *
 * Retours user :
 *  · « quand on clic sur une quête prérequis … ça nous envoie pas vers la quête dans
 *    le guide navigateur, alors que l'overlay fonctionne » ;
 *  · « si on enchaîne les retours, on empile plusieurs notifications de quête précédente ».
 *
 * Correctifs :
 *  · la ligne porte `data-seq-name` ; le saut cherche l'id puis le **nom** puis le **bloc**
 *    avant d'afficher un toast ;
 *  · un seul toast « Retour à la quête d'origine » à la fois (le nouveau remplace l'ancien).
 *
 * Lecture seule : aucune base, aucun rendu.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUB = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";

describe("clic sur un prérequis — atterrir sur la quête, pas sur un toast", () => {
  it("le guide interne cherche l'id, puis le nom, puis le bloc", () => {
    const src = read(DASH);
    expect(src).toContain('data-seq-name={seq.subGuideName || seq.subGuideRef || ""}');
    expect(src).toContain("function findFocusNode(");
    expect(src).toContain("focusedSeqNameRef.current");
    expect(src).toContain("focusedSeqNameRef.current = targetName");
    expect(src).toContain('querySelector<HTMLElement>(`[data-ms-id="${msId}"]`)');
  });

  it("le guide public applique le même fallback par nom", () => {
    const src = read(PUB);
    expect(src).toContain('data-seq-name={seq.subGuideName || seq.subGuideRef || ""}');
    expect(src).toContain('querySelectorAll<HTMLElement>("[data-seq-name]")');
  });

  it("un seul toast de retour à la fois (overlay et guide interne)", () => {
    const overlay = read(OVERLAY);
    expect(overlay).toContain("returnToastIdRef");
    expect(overlay).toContain("toast.dismiss(returnToastIdRef.current)");
    const dash = read(DASH);
    expect(dash).toContain("RETURN_TOAST_ID");
    expect(dash).toContain("toast.dismiss(RETURN_TOAST_ID.current)");
  });
});
