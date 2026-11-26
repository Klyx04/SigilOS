import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Panneau « Progression Guilde par Dofus » — vue granulaire par **personnage**.
 *
 * Mesure du 25/11/2026 (bêta) : le panneau agrégeait par profil (« 1 membre », Chaudsept)
 * et la vue personnelle ne montrait qu'un personnage. Le but est de voir **tous les
 * personnages** (Wylan, Cubi-Devomi, Chaudsept) sur chaque Dofus, avec une bascule
 * « Mon personnage » pour se recentrer.
 */

const PANEL = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/GuildStatusPanel.tsx";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("panneau Dofus — tous les personnages d'abord", () => {
    it("démarre sur tous les personnages, avec la bascule Mon personnage", () => {
        const panel = read(PANEL);
        expect(panel).toContain('useState<"all" | "me">("all")');
        expect(panel).toContain("groupGuildProgressByCharacter");
        expect(panel).toContain("excludeLegacyProfilesForViewer");
        expect(panel).toContain("panelCharacters");
        expect(panel).toContain("Tous les personnages");
        expect(panel).toContain("Mon personnage");
    });

    it("les cartes et la fiche lisent les personnages, pas les profils", () => {
        const panel = read(PANEL);
        expect(panel).toContain("panelCharacters.flatMap");
        expect(panel).toContain("panelProgress.some");
        expect(panel).toContain("character.characterSlot");
        expect(panel).toContain("character.name");
        expect(panel).toContain("personnage(s) engagé(s)");
    });
});
