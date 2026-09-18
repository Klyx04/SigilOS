/**
 * Landing — garde-fou des captures statiques (`src/lib/landing-figures.ts`).
 *
 * Deux régressions mesurées sur la page publique, toutes deux causées par la
 * lecture des libellés God :
 *   1. le libellé technique d'une ligne (UUID de base, « test1 », nom de
 *      fichier) s'affichait sous la figure ;
 *   2. ce même libellé servait de `alt`, avec « Capture de l'interface » en repli.
 *
 * La source étant désormais statique, ces tests empêchent de les réintroduire.
 *
 * Troisième régression, mesurée celle-ci à l'affichage : les figures déclaraient
 * un ratio (1440×900, soit 1,600) qui n'était celui d'aucun fichier (1,885 et
 * 1,781) — la place réservée avant chargement était fausse jusqu'à 18 %, et le
 * cadre se rétractait au premier paint. Les dimensions viennent maintenant du
 * fichier réel, et ce fichier de test le vérifie en lisant l'en-tête PNG.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
    LANDING_HERO_FIGURE,
    LANDING_WORKFLOW_FIGURE,
    LANDING_GUIDE_FIGURE,
    LANDING_GUIDE_SECONDARY_FIGURES,
} from "@/lib/landing-figures";

const FIGURES = [
    LANDING_HERO_FIGURE,
    LANDING_WORKFLOW_FIGURE,
    LANDING_GUIDE_FIGURE,
    ...LANDING_GUIDE_SECONDARY_FIGURES,
];

/** Chemin absolu d'un visuel déclaré (`/assets/...` → `public/assets/...`). */
function publicFile(imageUrl: string): string {
    return join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
}

/**
 * Dimensions du PNG, lues dans l'en-tête : signature (8 octets) puis bloc IHDR
 * dont les deux entiers 32 bits big-endian sont la largeur et la hauteur. Huit
 * octets lus valent mieux qu'une dépendance d'image pour ce seul contrôle.
 */
function pngSize(file: string): { width: number; height: number } {
    const header = readFileSync(file).subarray(0, 24);
    expect(header.subarray(1, 4).toString("ascii"), `${file} n'est pas un PNG`).toBe("PNG");
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

/** Libellés techniques : UUID, nom de fichier, brouillon, légende de repli. */
const TECHNICAL = /[0-9a-f]{8}-[0-9a-f]{4}|\.(png|jpe?g|webp|avif)$|^(capture|screenshot|image|test|tmp|essai)\b/i;

describe("landing — captures statiques", () => {
    it("pointe des visuels réellement présents dans public/assets/screenshots/", () => {
        for (const figure of FIGURES) {
            expect(figure.imageUrl).toMatch(/^\/assets\/screenshots\/[\w-]+\.png$/);
            const file = publicFile(figure.imageUrl);
            expect(existsSync(file), `${file} introuvable`).toBe(true);
            expect(statSync(file).size, `${figure.imageUrl} suspect (fichier vide ?)`).toBeGreaterThan(1000);
        }
    });

    it("déclare les dimensions réelles du visuel (réservation de place exacte)", () => {
        for (const figure of FIGURES) {
            const real = pngSize(publicFile(figure.imageUrl));
            expect(figure.width, `${figure.imageUrl} : width déclaré`).toBeGreaterThan(0);
            expect(figure.height, `${figure.imageUrl} : height déclaré`).toBeGreaterThan(0);
            // Dimensions réduites de façon homothétique : le ratio doit coller au fichier.
            expect(
                figure.width / figure.height,
                `${figure.imageUrl} : ratio déclaré ${figure.width}×${figure.height}, ` +
                    `fichier réel ${real.width}×${real.height} — mettre à jour ` +
                    `width/height dans src/lib/landing-figures.ts`
            ).toBeCloseTo(real.width / real.height, 3);
        }
    });

    it("n'affiche jamais un libellé technique sous une figure", () => {
        for (const figure of FIGURES) {
            expect(figure.label.trim().length).toBeGreaterThan(2);
            expect(figure.label).not.toMatch(TECHNICAL);
        }
    });

    it("rédige un alt (jamais un libellé d'interface ni un nom de fichier)", () => {
        for (const figure of FIGURES) {
            expect(figure.alt.length).toBeGreaterThan(30);
            expect(figure.alt).not.toMatch(TECHNICAL);
        }
    });

    it("n'affiche pas deux fois le même visuel sur la page", () => {
        const urls = FIGURES.map((figure) => figure.imageUrl);
        expect(new Set(urls).size).toBe(urls.length);
    });

    it("donne un titre et un contexte rédigés aux figures secondaires", () => {
        for (const figure of LANDING_GUIDE_SECONDARY_FIGURES) {
            expect(figure.title.length).toBeGreaterThan(20);
            expect(figure.description.length).toBeGreaterThan(40);
        }
    });
});
