import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { useRushOverlayStore, type RushOverlayPayload } from "@/store/rush-overlay-store";
import type { RushMilestone } from "@/types/rush-guide-types";

/**
 * Garde — les trois retours UX du 18/11/2026.
 *
 * ① l'overlay PiP reçoit un instantané : il doit être **resynchronisé** quand la page
 *    serveur renvoie de nouvelles données (alignement enregistré, personnage changé) ;
 * ② le changement de personnage affiche un **message** (progression séparée par slot) ;
 * ③ la **ligne de quête** ouvre la fiche, pas seulement le picto « i ».
 */

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

const milestone: RushMilestone = {
  id: "m1",
  chapter: 1,
  chapterLabel: "Chapitre 1",
  title: "Bloc",
  isOptional: false,
  order: 1,
  sequences: [],
};

const payload = (overrides: Partial<RushOverlayPayload> = {}): RushOverlayPayload => ({
  guildId: "g1",
  guide: { id: "guide", name: "Rush", slug: "rush-sylvestre" },
  milestones: [milestone],
  allProgress: [],
  altPseudo: null,
  character: { pseudo: "Main", classe: "cra", isMain: true },
  pinned: true,
  ocre: null,
  ...overrides,
});

describe("overlay — l'instantané suit la page rafraîchie", () => {
  beforeEach(() => useRushOverlayStore.getState().onWindowGone());

  it("met à jour les jalons et le personnage sans changer la fenêtre", () => {
    const win = {} as Window;
    useRushOverlayStore.getState().open(win, payload());

    const next = [{ ...milestone, id: "m2", title: "Après alignement" }];
    useRushOverlayStore.getState().sync({
      milestones: next,
      altPseudo: "Mule",
      character: { pseudo: "Mule", classe: "iop", isMain: false },
      selfAlignment: "brakmarien",
      selfOrder: "coeur_saignant",
    });

    const state = useRushOverlayStore.getState();
    expect(state.win).toBe(win);
    expect(state.payload?.milestones.map((m) => m.id)).toEqual(["m2"]);
    expect(state.payload?.altPseudo).toBe("Mule");
    expect(state.payload?.character.isMain).toBe(false);
    // L'alignement du personnage suit aussi (pré-remplissage de la modale du PiP).
    expect(state.payload?.selfAlignment).toBe("brakmarien");
    expect(state.payload?.selfOrder).toBe("coeur_saignant");
    // Le reste du payload est conservé (aucune perte silencieuse).
    expect(state.payload?.guildId).toBe("g1");
    expect(state.payload?.pinned).toBe(true);
  });

  it("sans overlay ouvert, ne crée aucun payload", () => {
    useRushOverlayStore.getState().sync({ milestones: [milestone] });
    expect(useRushOverlayStore.getState().payload).toBeNull();
  });
});

describe("câblage des trois retours", () => {
  const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
  const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";

  it("le guide resynchronise l'overlay ouvert", () => {
    const code = read(DASHBOARD);
    expect(code).toContain("useRushOverlayStore.getState().sync(overlayData)");
    expect(code).toContain("openOverlay(win, { ...overlayData, pinned })");
    // Cité / Ordre du personnage actif transmis (pré-remplissage + après enregistrement).
    expect(code).toContain("selfAlignment: selectedCharacter");
    expect(
      read("src/app/dashboard/[guildId]/_components/rush-overlay-host.tsx")
    ).toContain("selfAlignment={payload.selfAlignment ?? null}");
  });

  it("le changement de personnage annonce la progression affichée", () => {
    expect(read(DASHBOARD)).toContain("Personnage actif : ${label}");
  });

  it("la ligne de quête ouvre la fiche (dashboard et guide public)", () => {
    expect(read(DASHBOARD)).toContain("Voir les détails de ${questName}");
    expect(read(PUBLIC)).toContain("Voir les détails de ${block.questName}");
    expect(read(PUBLIC)).toContain("setDetailModalSeq({ milestone: ms, sequence: blockSteps[0] })");
  });
});
