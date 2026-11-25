import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Panneau « Progression Guilde par Dofus » — vue personnelle par défaut.
 *
 * Mesure du 25/11/2026 (bêta) : après 10 resets, le membre voyait les cartes à 100 %
 * parce que le panneau affichait la progression **d'un autre membre** (Chaudsept) sous
 * « 1 membre ». Le bandeau, lui, était bien à 0/34. La vue par défaut doit être celle du
 * **personnage qui fait le rush** ; la vue Guilde reste disponible en second.
 */

const PANEL = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/GuildStatusPanel.tsx";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("panneau Dofus — ma progression d'abord", () => {
    it("démarre sur le personnage actif, avec une bascule Guilde explicite", () => {
        const panel = read(PANEL);
        expect(panel).toContain('useState<"me" | "guild">("me")');
        expect(panel).toContain("personalProgress");
        expect(panel).toContain("panelProgress");
        expect(panel).toContain("Ma progression par Dofus");
        expect(panel).toContain("Mon personnage");
        expect(panel).toContain("Guilde");
    });

    it("le modal et les cartes lisent le même périmètre", () => {
        const panel = read(PANEL);
        // Les trois lectures du panneau passent par panelProgress.
        expect(panel).toContain("panelProgress.some");
        expect(panel).toContain("panelProgress.map");
        expect(panel).toContain("panelProgress.filter");
    });
});
