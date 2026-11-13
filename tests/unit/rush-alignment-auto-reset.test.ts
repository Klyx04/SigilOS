/**
 * Garde — **reset automatique au changement de cité/Ordre** (12/11/2026).
 *
 * 🎯 Décision user : « OUI — automatique, sur le personnage sélectionné (mule comprise),
 * avec annonce de ce qui a été décoché ».
 *
 * 📏 Mesure : `updateUserProfile` acceptait `alignment` / `alignmentOrder` et écrivait le
 * profil **sans aucun reset** — l'onboarding et les fiches profil pouvaient donc changer
 * de camp en laissant cochées les quêtes de l'ancien. Le sélecteur, lui, appelait un reset
 * manuel avant l'écriture, sans jamais dire ce qu'il avait décoché.
 *
 * 🛡️ Le reset vit désormais dans l'ACTION qui écrit l'alignement : tous les chemins en
 * bénéficient, et le nombre de coches retirées est renvoyé pour l'annonce à l'écran.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { alignmentChangeReset } from "@/lib/rush-guide-utils";

const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("alignmentChangeReset — quand faut-il décocher ?", () => {
  it("cité et Ordre identiques ⇒ rien n'est touché", () => {
    expect(
      alignmentChangeReset({
        current: { alignment: "bontarien", alignmentOrder: "coeur_vaillant" },
        next: { alignment: "bontarien", alignmentOrder: "coeur_vaillant" },
      })
    ).toBeNull();
  });

  it("cité différente ⇒ reset de cité, même si l'Ordre change aussi", () => {
    expect(
      alignmentChangeReset({ current: { alignment: "bontarien" }, next: { alignment: "brakmarien" } })
    ).toBe("camp");
  });

  it("cité inchangée + Ordre différent ⇒ reset d'Ordre", () => {
    expect(
      alignmentChangeReset({
        current: { alignment: "bontarien", alignmentOrder: "coeur_vaillant" },
        next: { alignmentOrder: "oeil_attentif" },
      })
    ).toBe("order");
  });

  it("Ordre retiré ⇒ reset d'Ordre (l'ancien est décoché)", () => {
    expect(
      alignmentChangeReset({
        current: { alignment: "bontarien", alignmentOrder: "coeur_vaillant" },
        next: { alignmentOrder: null },
      })
    ).toBe("order");
  });

  it("sans Ordre quitté, un Ordre ajouté ne décoche rien (fail-closed)", () => {
    expect(
      alignmentChangeReset({ current: { alignment: "bontarien" }, next: { alignmentOrder: "coeur_vaillant" } })
    ).toBeNull();
  });

  it("neutre, vide et casse ne déclenchent rien", () => {
    expect(alignmentChangeReset({ current: { alignment: null }, next: { alignment: "neutre" } })).toBeNull();
    expect(alignmentChangeReset({ current: { alignment: "Bontarien" }, next: { alignment: "bontarien" } })).toBeNull();
  });

  it("champ absent ⇒ on ne touche à rien", () => {
    expect(alignmentChangeReset({ current: { alignment: "bontarien" }, next: {} })).toBeNull();
  });
});

describe("câblage — le reset vit dans les actions d'écriture", () => {
  const PROFILE = codeOf("src/server/actions/profile-actions.ts");
  const SERVER = codeOf("src/server/rush-alignment.ts");
  const FORM = codeOf("src/components/dofus-quests/rush/AlignmentChoiceForm.tsx");
  const ACTIONS = codeOf("src/server/actions/optimized-guide-actions.ts");

  it("les deux actions qui écrivent l'alignement resettent AVANT l'écriture", () => {
    const mainFn = PROFILE.indexOf("export async function updateUserProfile");
    const mainReset = PROFILE.indexOf("await resetProgressOnAlignmentChange({", mainFn);
    const mainWrite = PROFILE.indexOf("await db.userProfile.upsert({", mainFn);
    expect(mainReset).toBeGreaterThan(mainFn);
    expect(mainWrite).toBeGreaterThan(mainReset);

    const muleFn = PROFILE.indexOf("export async function updateMuleAlignment");
    const muleReset = PROFILE.indexOf("await resetProgressOnAlignmentChange({", muleFn);
    const muleWrite = PROFILE.indexOf("await db.userProfile.update({", muleFn);
    expect(muleReset).toBeGreaterThan(muleFn);
    expect(muleWrite).toBeGreaterThan(muleReset);
  });

  it("la mule est resettée sur SA branche (`characterSlot = pseudo`)", () => {
    expect(PROFILE).toContain("characterSlot: pseudo");
  });

  it("le nombre de coches retirées est renvoyé à l'écran", () => {
    expect(PROFILE).toContain("return { success: true, data: { cleared } };");
    expect(FORM).toContain("res.data?.cleared");
  });

  it("les actions manuelles de reset ont disparu (une seule source)", () => {
    expect(ACTIONS).not.toContain("export async function resetAlignmentProgress");
    expect(ACTIONS).not.toContain("export async function resetRushOrderProgress");
    expect(FORM).not.toContain("resetAlignmentProgress");
    expect(FORM).not.toContain("resetRushOrderProgress");
  });

  it("la décision reste dans la règle pure, l'écriture dans le module serveur", () => {
    expect(SERVER).toContain("alignmentChangeReset(input)");
    expect(SERVER).toContain("resetAlignmentQuests(");
    expect(SERVER).toContain("resetOrderQuests(");
  });
});
