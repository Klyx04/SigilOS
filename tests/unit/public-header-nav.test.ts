/**
 * Coque publique — **verrou de la barre de navigation** (retour du 06/11/2026).
 *
 * Le retour mesuré : « on peut pas laisser guide guilde en haut, c'est imbuvable ». Deux labels
 * quasi identiques côte à côte, et aucun repère visuel. La correction tient en trois règles :
 *
 * 1. **Guides, Guildes et Visiteurs** vivent dans un seul menu `Explorer` (`localizedNav.slice(2)`),
 *    plus deux liens de même allure à côté ;
 * 2. chaque entrée porte un **asset Dofus réel** — et cet asset **existe sur disque** (même piège
 *    que `visitor-shell` : un chemin mort part en 404 `/_next/image`) ;
 * 3. le menu est un `<details>` **natif** : les liens restent dans le HTML servi, donc indexables.
 *    Un menu en JavaScript aurait caché ces liens aux robots — c'est le seul vrai risque SEO.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const HEADER = "src/components/layout/public-header.tsx";
const read = (path: string) => readFileSync(path, "utf8");

/** Un chemin absolu pointe `public/`, sinon `assets/dofus/game-icons/` (convention maison). */
const assetPath = (icon: string) => (icon.startsWith("/") ? `public${icon}` : `public/assets/dofus/game-icons/${icon}`);

describe("Barre publique — les entrées sont regroupées et illustrées", () => {
    it("Guides, Guildes et Visiteurs sont derrière un seul menu, pas trois liens voisins", () => {
        const code = read(HEADER);
        expect(code).toContain("localizedNav.slice(2)");
        expect(code).toContain("explorerItems.map");
        expect(code).toContain("{t.nav.explore}");
        // Le seul lien direct restant est « Modules ».
        expect(code).toContain("localizedNav.slice(1, 2)");
    });

    it("le menu est natif : aucun état JavaScript pour l'ouvrir", () => {
        const code = read(HEADER);
        expect(code).toContain("<summary");
        expect(code).toContain("[&::-webkit-details-marker]:hidden");
    });

    it("« Visiteurs » n'apparaît que pour un compte connecté", () => {
        const code = read(HEADER);
        expect(code).toMatch(/\.\.\.\(user\s*\?\s*\[/);
        expect(code).toContain('id: "visiteurs"');
    });

    it("chaque entrée porte un asset Dofus qui existe sur disque", () => {
        const icons = [...read(HEADER).matchAll(/icon: "([^"]+)"/g)].map((match) => match[1]);
        expect(icons.length).toBeGreaterThanOrEqual(8);
        for (const icon of icons) {
            expect(existsSync(assetPath(icon)), assetPath(icon)).toBe(true);
        }
    });

    it("les icônes littérales de la barre existent aussi (aucun 404 `/_next/image`)", () => {
        const literals = [...read(HEADER).matchAll(/src="(\/[^"]+)"/g)].map((match) => match[1]);
        expect(literals).toContain("/assets/nav/world.png");
        expect(literals).toContain("/assets/nav/cog.png");
        for (const src of literals) {
            expect(existsSync(assetPath(src)), assetPath(src)).toBe(true);
        }
    });

    it("les deux menus de la barre se ferment de la même façon", () => {
        const code = read(HEADER);
        expect(code).toContain("useDismissOnOutside(toolsOpen");
        expect(code).toContain("useDismissOnOutside(explorerOpen");
    });

    it("les entrées restent des liens `<Link>` (donc des `<a href>` dans le HTML servi)", () => {
        const code = read(HEADER);
        expect(code).toContain("href={item.href}");
        expect(code).toContain("<Link");
    });

    /**
     * F12 (08/11/2026) — « Menu : assets Dofus pour “Mes guildes”, “Tableau de bord”, “Mon espace
     * visiteur” ».
     *
     * Mesure : le menu du compte affichait **deux fois la même** icône générique
     * (`LayoutDashboard` pour « Mes guildes » *et* « Tableau de bord ») et un glyphe `UserRound`
     * pour l'espace visiteur — alors que les trois assets existent déjà dans la même barre
     * (`modules/guild.png`, `game-icons/house.png`, `modules/character.png`). Une destination
     * doit se reconnaître à son icône, pas à la lecture du libellé.
     */
    it("F12 — le menu du compte illustre chaque destination avec l'asset de la barre", () => {
        const code = read(HEADER);

        expect(code).toContain('import { GameIcon } from "@/components/shared/game-icon"');
        expect(code).toMatch(/src="\/assets\/dofus\/modules\/guild\.png"[\s\S]{0,220}\{t\.nav\.myGuilds\}/);
        expect(code).toMatch(/src="\/assets\/dofus\/game-icons\/house\.png"[\s\S]{0,220}\{t\.nav\.dashboard\}/);
        expect(code).toMatch(/src="\/assets\/dofus\/modules\/character\.png"[\s\S]{0,220}\{t\.nav\.visitorSpace\}/);
        // Plus aucun glyphe générique dans ce menu.
        expect(code).not.toContain("<UserRound");
    });
});
