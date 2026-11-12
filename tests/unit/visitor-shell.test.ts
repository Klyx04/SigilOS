/**
 * Espace visiteur (rang 57) — verrou de la **coque** (D-V14).
 *
 * La V1c avait retiré **tout** chrome au motif « aucun chrome de guilde » : le visiteur se
 * retrouvait sans lien vers les guides, le rush ou les outils, avec « Se déconnecter » pour
 * seule sortie. Ce test tient les deux moitiés de la correction :
 *  · l'en-tête et le pied de page **publics** sont rendus (aucun `guildId`, aucune sidebar) ;
 *  · chaque onglet porte un **asset du jeu qui existe sur disque** — un chemin mort servi par
 *    `/_next/image` est déjà arrivé (issue Sentry documentée sur `game-icons/ladder.png`).
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const LAYOUT = "src/app/espace-visiteur/layout.tsx";
const NAV = "src/app/espace-visiteur/_components/visitor-nav.tsx";
const GAME_ICONS = "public/assets/dofus/game-icons";

const read = (path: string) => readFileSync(path, "utf8");

/** Chemin disque d'une icône : un chemin absolu pointe `public/`, sinon `game-icons/`. */
const assetPath = (icon: string) => (icon.startsWith("/") ? `public${icon}` : `${GAME_ICONS}/${icon}`);

describe("Coque visiteur — le chrome public, pas celui de la guilde", () => {
    it("le layout rend l'en-tête public et le pied de page", () => {
        const code = read(LAYOUT);
        expect(code).toMatch(/<PublicHeader/);
        expect(code).toMatch(/<GalacticFooter/);
    });

    it("« Tableau de bord » reste dans l'espace (pas de retour par /dashboard, D-V13)", () => {
        expect(read(LAYOUT)).toContain('dashboardHref="/espace-visiteur/general"');
    });

    it("le bouton de déconnexion maison a disparu : il vit dans le menu avatar", () => {
        expect(read(LAYOUT)).not.toMatch(/SignOutButton/);
    });
});

describe("Onglets — un asset du jeu par segment, aucun 404", () => {
    const icons = [...read(NAV).matchAll(/icon: "([^"]+)"/g)].map((match) => match[1]);

    it("les sept segments portent une icône", () => {
        expect(icons).toHaveLength(7);
    });

    it("aucune icône n'est un glyphe générique (le rendu passe par `GameIcon`)", () => {
        expect(read(NAV)).toMatch(/<GameIcon src=\{segment\.icon\}/);
    });

    it("chaque asset existe sur disque", () => {
        for (const icon of icons) {
            expect(existsSync(assetPath(icon)), assetPath(icon)).toBe(true);
        }
    });
});
