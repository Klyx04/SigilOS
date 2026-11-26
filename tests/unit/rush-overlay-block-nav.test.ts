import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Overlay interne — navigation de bloc et reset explicite.
 *
 * Mesure du 26/11/2026 : la barre de bloc n'avait que le menu déroulant ; les boutons
 * Précédent / Suivant du footer étaient trop bas dans la PiP et disparaissaient sur une
 * fenêtre courte. Le reset n'était qu'une icône ↺ avec une confirmation invisible.
 * La barre porte donc désormais la navigation (toujours visible) et un libellé de reset.
 */

const BAR = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterBar.tsx";
const CLIENT = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const CSS = "src/app/da-wakfu.css";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("overlay interne — navigation de bloc et reset lisible", () => {
    it("la barre expose les boutons bloc précédent / suivant", () => {
        const bar = read(BAR);
        expect(bar).toContain("onPrevChapter");
        expect(bar).toContain("onNextChapter");
        expect(bar).toContain('aria-label="Bloc précédent"');
        expect(bar).toContain('aria-label="Bloc suivant"');
        expect(bar).toContain("da-dock-nav");
        expect(bar).toContain("chapterPos + 1}/{selectable.length}");
    });

    it("le reset porte un libellé et un état de confirmation", () => {
        const bar = read(BAR);
        expect(bar).toContain('{resetArmed ? "Confirmer" : "Réinitialiser"}');
        expect(bar).toContain('data-armed={resetArmed ? "true" : undefined}');
        expect(bar).toContain("Confirmer la réinitialisation du bloc");
    });

    it("la page overlay branche les deux actions sur la navigation existante", () => {
        const client = read(CLIENT);
        expect(client).toContain("onPrevChapter={goToPrevMs}");
        expect(client).toContain("onNextChapter={goToNextMs}");
        expect(client).toContain("canPrevChapter={currentMsIndex > 0}");
        expect(client).toContain("canNextChapter={currentMsIndex < milestones.length - 1}");
    });

    it("les boutons de la barre ne sont pas étirés par la règle .da-dock button", () => {
        const css = read(CSS);
        expect(css).toContain(".da-dock button.da-dock-nav");
        expect(css).toContain(".da-dock button.da-dock-reset[data-armed=\"true\"]");
        expect(css).toContain("flex: none;");
    });
});
