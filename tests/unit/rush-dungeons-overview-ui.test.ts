import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Gardes de câblage du Bloc J — « Progression Donjons ».
 *
 * Le lot est une **entrée dans trois bandeaux** + un panneau partagé. Ces gardes
 * figent ce que l'utilisateur a validé : position entre « Rush Live » et
 * « Ouvrir Overlay », nom exact, compteur en exigences, mode visiteur/invité,
 * badge d'overlay et coût de rendu (`data-quality` en PiP).
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const HEADER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx";
const MODAL = "src/components/dofus-quests/rush/RushDungeonsOverviewModal.tsx";
const TILE = "src/components/dofus-quests/rush/RushDungeonsProgressTile.tsx";

describe("bloc J — entrée dans les trois surfaces", () => {
  it("dashboard : la tuile est entre « Rush Live » et « Ouvrir Overlay », groupe poussé à droite", () => {
    const source = read(DASHBOARD);
    const rushLive = source.indexOf("Rush Live");
    const tile = source.indexOf("<RushDungeonsProgressTile");
    const overlay = source.lastIndexOf('aria-label="Ouvrir Overlay"');
    expect(rushLive).toBeGreaterThan(-1);
    expect(tile).toBeGreaterThan(rushLive);
    expect(overlay).toBeGreaterThan(tile);
    expect(source).toContain('min-w-0 md:ml-auto');
  });

  it("guide public : tuile dans les deux modes, agrégat seulement avec un profil visiteur", () => {
    const source = read(PUBLIC);
    expect(source).toContain("<RushDungeonsProgressTile");
    expect(source).toContain('mode={visitor ? "visitor" : "guest"}');
    expect(source).toContain("members={visitor ? dungeonsCommunity : null}");
    expect(source).toContain("getMyRushDungeonsCommunity");
    expect(source).toContain("scrollToStep(sequenceId)");
  });

  it("overlay : bouton entre le compte (Ocre/Metamob) et l'œil, badge d'exigences restantes", () => {
    const header = read(HEADER);
    const metamob = header.indexOf("onOpenMetamob");
    const button = header.indexOf("onOpenDungeons &&");
    const eye = header.indexOf("Masquer les quêtes terminées");
    expect(metamob).toBeGreaterThan(-1);
    expect(button).toBeGreaterThan(metamob);
    expect(eye).toBeGreaterThan(button);
    expect(header).toContain("dungeonsPending");

    const overlay = read(OVERLAY);
    expect(overlay).toContain("onOpenDungeons={openDungeonsOverview}");
    expect(overlay).toContain("dungeonsCounter.total - dungeonsCounter.done");
    expect(overlay).toContain('quality={overlayDensity === "tight" ? "low" : "high"}');
    expect(overlay).toContain("portalContainer={rootRef.current?.ownerDocument.body ?? null}");
  });

  it("la tuile porte le nom validé et l'asset réel du jeu", () => {
    const source = read(TILE);
    expect(source).toContain("Progression Donjons");
    expect(source).toContain("/assets/dofus-ui/pictos/donjon.png");
  });
});

describe("bloc J — panneau (option A, filtres et coût de rendu)", () => {
  const source = read(MODAL);

  it("ouvre le bloc du repère et propose « Tout déplier »", () => {
    expect(source).toContain("defaultOpenBlockId(overview, me)");
    expect(source).toContain("labels.expand");
    expect(source).toContain("aria-expanded={isExpanded(block.id)}");
  });

  it("filtre par état, étape, repère et recherche", () => {
    expect(source).toContain('(["all", "todo", "done"] as const)');
    expect(source).toContain("flagsOnly");
    expect(source).toContain("filter.step");
    expect(source).toContain("aria-pressed={filter.state === state}");
  });

  it("ne pose aucun filtre CSS sur la liste et respecte le coût de rendu", () => {
    expect(source).not.toMatch(/className="[^"]*\bfilter-/);
    expect(source).toContain("data-quality={quality}");
    expect(source).toContain("sm:w-[min(860px,calc(100vw-2rem))]");
    expect(source).toContain("sm:w-[min(520px,calc(100vw-2rem))]");
  });

  it("borne la hauteur et fait scroller la liste À L'INTÉRIEUR (jamais sous l'écran)", () => {
    // `flex` remplace le `grid` de base, `min-h-0` + `flex-1` bornent la liste,
    // `100dvh` remplace `100vh` (clavier mobile) — vérifié 390/768/1024/1440.
    expect(source).toContain("da-modal da-portal flex flex-col overflow-hidden");
    expect(source).toContain("h-[100dvh] max-h-[100dvh]");
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain");
    expect(source).toContain("da-modal-head shrink-0");
  });
});
