/**
 * Fluidité du défilement — **verrou de source** (galerie + longues grilles).
 *
 * Mesures du 04/11/2026 :
 * - la galerie monte **24 cartes × ~20 tooltips** d'items, toutes rendues ;
 * - une barre **sticky** en `backdrop-blur-xl` et un hero en verre + deux halos
 *   `blur(100px)` forçaient une re-composition à chaque frame ;
 * - aucun `content-visibility` : les cartes hors écran restaient mises en page et peintes.
 *
 * Ce verrou interdit le retour des effets coûteux sur les surfaces de défilement.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const GALLERY = read("src/app/dashboard/[guildId]/galerie-stuff/gallery-client.tsx");
const CSS = read("src/app/globals.css");

describe("galerie-stuff — défilement", () => {
    it("aucun backdrop-filter / blur de composition dans la galerie", () => {
        expect(GALLERY).not.toContain("backdrop-blur");
        expect(GALLERY).not.toContain("blur-[100px]");
        expect(GALLERY).not.toContain("mix-blend-luminosity");
    });

    it("la barre de filtres reste sticky mais opaque (pas de verre)", () => {
        expect(GALLERY).toContain("sticky top-0 z-30");
        expect(GALLERY).toMatch(/className="bg-surface border border-border\/80 rounded-2xl/);
    });

    it("les cartes des deux onglets sont en content-visibility", () => {
        const occurrences = GALLERY.match(/cv-auto/g) ?? [];
        expect(occurrences.length).toBeGreaterThanOrEqual(2);
    });
});

describe("longues grilles — utilitaire partagé", () => {
    it("`.cv-auto` borne la mise en page et la peinture hors écran", () => {
        expect(CSS).toContain(".cv-auto");
        expect(CSS).toContain("content-visibility: auto");
        expect(CSS).toContain("contain-intrinsic-size: auto 480px");
    });

    it("appliqué à l'annuaire, au marché et aux posts de donjon", () => {
        expect(read("src/components/directory/member-card.tsx")).toContain("cv-auto");
        expect(read("src/app/dashboard/[guildId]/marche/_components/market-catalog-client.tsx")).toContain("cv-auto");
        expect(read("src/components/dungeon-finder/DjPostCard.tsx")).toContain("cv-auto");
    });
});
