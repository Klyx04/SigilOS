/**
 * Gardes — **L3 : la modale d'accueil du Rush en DA « Carnet »** (02/11/2026).
 *
 * 🎯 Défauts mesurés avant le lot :
 *  · `RushOnboardingWizardModal` vivait encore dans l'ancien langage visuel — `bg-zinc-950`,
 *    `rounded-3xl`, `font-black`, `emerald`, `indigo`, ombres diffuses — alors que la DA
 *    « Carnet de campagne » est livrée depuis le 02/11 sur l'overlay ;
 *  · `hasNoClassDeclared` était **déclarée** dans les props mais **jamais passée**
 *    (défaut 7 de `MODULE-RUSH-SYLVESTRE.md` § 1 bis.3) : un joueur sans classe voyait un
 *    guide amputé de ses 19 quêtes de classe **sans explication**.
 *
 * 🛡️ Ce que ces verrous interdisent :
 *  · le retour des jetons anti-slop (verre, `font-black`, dégradé, ombre diffuse, rayon > 12 px) ;
 *  · une modale qui perd ses 4 étapes ou son cadre carnet ;
 *  · une classe manquante redevenue silencieuse.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const MODAL = "src/components/dofus-quests/RushOnboardingWizardModal.tsx";
const TIMELINE = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

const codeOf = (path: string) => readFileSync(path, "utf8");

/** Le code seul : les commentaires citent les anciens jetons pour expliquer le lot. */
const codeOnly = (path: string) => codeOf(path).replace(/\/\*[\s\S]*?\*\//g, "");

/** Jetons proscrits par la DA (mêmes règles que `rush-da-grimoire`). */
const SLOP =
  /bg-gradient|backdrop-blur|\bshadow-2xl\b|drop-shadow|\bfont-black\b|animate-pulse|rounded-2xl|rounded-3xl/;

describe("modale d'accueil — DA « Carnet de campagne »", () => {
  it("le panneau porte les trois jetons du carnet (thème, filet, cadre à rivets)", () => {
    const src = codeOf(MODAL);
    expect(src).toContain("rush-carnet-theme");
    expect(src).toContain("rush-carnet rush-carnet-frame");
    expect(src).toContain("bg-surface text-foreground");
  });

  it("aucun slop : ni verre, ni ombre diffuse, ni `font-black`, ni dégradé, ni rayon > 12 px", () => {
    const src = codeOnly(MODAL);
    expect(src).not.toMatch(SLOP);
    // Les couleurs legacy ne doivent pas revenir non plus.
    expect(src).not.toMatch(/bg-zinc|text-zinc|border-zinc|emerald-|indigo-/);
  });

  it("les titres sont en serif et l'accent est l'ambre du carnet", () => {
    const src = codeOf(MODAL);
    expect(src).toMatch(/font-serif/);
    expect(src).toMatch(/text-accent/);
  });

  it("les quatre étapes sont conservées (personnage, préparation, membres, départ)", () => {
    const src = codeOf(MODAL);
    expect(src).toMatch(/useState<1 \| 2 \| 3 \| 4>/);
    expect(src).toContain("Votre personnage");
    expect(src).toContain("Préparation");
    expect(src).toContain("Les membres");
    expect(src).toContain("Prêt à partir");
    expect(src).toContain("Lancer mon Rush");
  });

  it("le dialogue est accessible : rôle, `aria-modal` et titre lié", () => {
    const src = codeOf(MODAL);
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain('aria-labelledby="rush-onboarding-title"');
    expect(src).toContain('id="rush-onboarding-title"');
  });
});

describe("parcours interrompu — la modale survit au changement de personnage", () => {
  it("le dashboard mémorise l'étape avant de naviguer (le guide est remonté par `key={character}`)", () => {
    const src = codeOf(TIMELINE);
    expect(src).toContain("rush-onboarding-resume-");
    // La clé est écrite AVANT la navigation, puis consommée au montage.
    const writeAt = src.indexOf('sessionStorage.setItem(wizardResumeKey,"2")');
    const pushAt = src.indexOf("router.push(`?character=", writeAt);
    expect(writeAt).toBeGreaterThan(-1);
    expect(pushAt).toBeGreaterThan(writeAt);
    expect(src).toContain("sessionStorage.removeItem(wizardResumeKey)");
  });

  it("la modale ouvre à l'étape transmise et remonte chaque changement", () => {
    const src = codeOf(MODAL);
    expect(src).toContain("initialStep = 1");
    expect(src).toContain("useState<1 | 2 | 3 | 4>(initialStep)");
    expect(src).toContain("onStepChange?.(next)");
    // Les deux boutons du pied passent par `go`, jamais par `setStep` en direct.
    expect(src).toContain("onClick={() => go((step + 1) as 1 | 2 | 3 | 4)}");
    expect(src).toContain("onClick={() => go((step - 1) as 1 | 2 | 3 | 4)}");
  });

  it("le dashboard transmet l'étape et le sélecteur de personnage dédié", () => {
    const src = codeOf(TIMELINE);
    expect(src).toContain("initialStep={wizardStep}");
    expect(src).toContain("onStepChange={handleWizardStep}");
    expect(src).toContain("onSelectCharacter={handleWizardSelectCharacter}");
  });
});

describe("classe manquante (défaut 7) — dite, et cliquable", () => {
  it("la modale affiche l'avertissement et renvoie au profil", () => {
    const src = codeOf(MODAL);
    expect(src).toContain("hasNoClassDeclared");
    expect(src).toContain("Aucune classe déclarée");
    expect(src).toMatch(/href=\{`\/dashboard\/\$\{guildId\}\/profile`\}/);
  });

  it("le dashboard calcule la classe du personnage SÉLECTIONNÉ (mule comprise) et la passe", () => {
    const src = codeOf(TIMELINE);
    expect(src).toContain("selectedClassDeclared");
    expect(src).toContain("altPseudos?.find((m:any)=>m.pseudo===effectiveAltPseudo)");
    expect(src).toContain("hasNoClassDeclared={!selectedClassDeclared}");
  });
});
