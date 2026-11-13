/**
 * Fil de sève — la règle de longueur, sans navigateur.
 *
 * 🎯 Mesure du 05/11/2026 : sur le guide public, la longueur du fil était lue par
 * `offsetTop`. Or chaque quête y est enveloppée dans son propre `div.relative` (le
 * panneau de la carte) : les 18 lignes rapportaient `offsetTop = 12` alors que leur
 * position réelle s'étalait de 32 à 2 666 px. Le fil restait donc figé à 18 px.
 *
 * 🛡️ On verrouille l'arithmétique : la position de la cible est une ENTRÉE (mesurée
 * par l'appelant), et le résultat doit en dépendre — c'est ce qui manquait.
 */

import { describe, it, expect } from "vitest";
import {
    daRailGrow,
    DA_RAIL_BOTTOM_GAP,
    DA_RAIL_NODE_CENTER,
    DA_RAIL_START,
} from "@/lib/da-rail-geometrie";

const RAIL_HEIGHT = 2796;

describe("Fil de sève — longueur jusqu'à la quête à faire", () => {
    it("le fil s'arrête au centre du nœud visé", () => {
        // Le nœud fait 28 px avec 12 px de marge haute : son centre est à 26 px
        // du haut de la ligne. Le tracé démarre à 20 px.
        expect(DA_RAIL_NODE_CENTER).toBe(26);
        expect(DA_RAIL_START).toBe(20);
        expect(daRailGrow({ targetOffset: 32, railHeight: RAIL_HEIGHT, rowCount: 18 })).toBe(38);
    });

    it("une cible plus bas allonge le fil d'autant", () => {
        const haut = daRailGrow({ targetOffset: 32, railHeight: RAIL_HEIGHT, rowCount: 18 });
        const bas = daRailGrow({ targetOffset: 858, railHeight: RAIL_HEIGHT, rowCount: 18 });
        expect(bas - haut).toBe(858 - 32);
        expect(bas).toBe(864);
    });

    it("c'est bien la POSITION qui décide, jamais le nombre de lignes", () => {
        // Le défaut d'E2 : 18 lignes, une seule valeur possible (18 px) quel que soit
        // l'endroit où le joueur en est. Deux positions différentes ⇒ deux longueurs.
        const tot = [32, 1000, 2666].map((offset) =>
            daRailGrow({ targetOffset: offset, railHeight: RAIL_HEIGHT, rowCount: 18 })
        );
        expect(new Set(tot).size).toBe(3);
        expect(tot).not.toContain(18);
    });
});

describe("Fil de sève — chapitre terminé et cas limites", () => {
    it("tout validé : le fil va jusqu'au bout, à 48 px du bas", () => {
        expect(DA_RAIL_BOTTOM_GAP).toBe(48);
        expect(daRailGrow({ targetOffset: null, railHeight: RAIL_HEIGHT, rowCount: 18 })).toBe(
            RAIL_HEIGHT - DA_RAIL_BOTTOM_GAP - DA_RAIL_START
        );
    });

    it("aucune ligne : aucun fil", () => {
        expect(daRailGrow({ targetOffset: null, railHeight: 0, rowCount: 0 })).toBe(0);
        expect(daRailGrow({ targetOffset: null, railHeight: 400, rowCount: 0 })).toBe(0);
    });

    it("jamais une longueur négative", () => {
        expect(daRailGrow({ targetOffset: -40, railHeight: RAIL_HEIGHT, rowCount: 3 })).toBe(0);
        expect(daRailGrow({ targetOffset: null, railHeight: 30, rowCount: 3 })).toBe(0);
    });
});
