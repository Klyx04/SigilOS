/**
 * Garde — **porte de départ** du Rush (25/11/2026).
 *
 * Demande user : « le but n'est pas de reproposer un tour guide mais de par exemple
 * bloquer tant qu'un personnage n'est pas choisi ». Le tour reste optionnel ; c'est
 * l'**action de cocher** qui est gardée, et la carte « Commence ici » qui prend le
 * relais une fois l'accueil passé.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

describe("porte de départ — les coches attendent le personnage", () => {
  it("le guide public bloque les trois chemins d'écriture", () => {
    const code = read(PUBLIC);
    expect(code).toContain("resolveRushStartState(");
    expect(code).toContain("if (startState.needsCharacter)");
    expect(code).toContain("if (completeAll && startState.needsCharacter)");
    expect(code).toContain("Choisis d'abord ton personnage");
  });

  it("la carte de départ est persistante et propose les deux étapes", () => {
    const code = read(PUBLIC);
    expect(code).toContain("<RushStartHerePanel");
    expect(code).toContain("onPickCharacter");
    expect(code).toContain("onDismissAlignment");
    // Le tour n'est pas supprimé : il reste « Passer » dans la modale d'accueil.
    expect(read("src/app/guides/rush-sylvestre/_components/PublicOnboardingModal.tsx")).toContain(
      "Passer"
    );
  });

  it("l'overlay PiP reçoit l'état du personnage et gate ses coches", () => {
    const code = read(OVERLAY);
    expect(code).toContain("characterReady?: boolean");
    expect(code).toContain("const canValidate = !isGuest || characterReady");
    expect(code).toContain('toast.warning("Choisis ton personnage dans le guide');
    expect(read(PUBLIC)).toContain("characterReady={startState.hasCharacter}");
  });

  it("le dashboard montre la même carte pour un nouveau membre", () => {
    const code = read(DASHBOARD);
    expect(code).toContain("<RushStartHerePanel");
    expect(code).toContain("needsAlignment");
    expect(code).toContain("startAlignmentDismissed");
  });
});

describe("masquer les étapes faites — un seul contrôle visible", () => {
  it("les trois surfaces montent le composant partagé", () => {
    expect(read(PUBLIC)).toContain("<RushHideDoneToggle");
    expect(read(DASHBOARD)).toContain("<RushHideDoneToggle");
    const toggle = read("src/components/dofus-quests/rush/RushHideDoneToggle.tsx");
    expect(toggle).toContain('locale === "en"');
    expect(toggle).toContain("Masquer les étapes faites");
    expect(toggle).toContain("Afficher les étapes faites");
  });

  it("la PiP dit ce qui est masqué et permet de rouvrir sans le menu", () => {
    const code = read(OVERLAY);
    expect(code).toContain("étapes faites");
    expect(code).toContain("setHideCompleted(false)");
    expect(code).toContain('questFilter === "done"');
  });

  it("une recherche n'est jamais vidée par le masquage", () => {
    expect(read(PUBLIC)).toContain("hideDone && !searchQuery.trim()");
    expect(read(DASHBOARD)).toContain("hideDone&&!searchFilter");
  });
});
