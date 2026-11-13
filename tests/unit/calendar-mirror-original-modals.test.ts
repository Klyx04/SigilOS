/**
 * Tests unitaires — Miroir calendrier avec modales d'origine (DJ & Songes)
 *
 * Vérifie :
 * - Détection propre de la source miroir via agendaMirrorSource
 * - Structure et relations requises pour alimenter DjPostDetailModal et SongesRunDetailModal
 */

import { describe, it, expect } from "vitest";
import { agendaMirrorSource, isAgendaMirror } from "@/lib/agenda-mirror";

describe("calendar mirror — détection de source originale", () => {
    it("détecte une source DJ miroir valide", () => {
        const metadata = {
            source: {
                kind: "DJ" as const,
                djPostId: "post-12345",
            },
            mirror: {
                label: "Donjon Servitude",
            },
        };

        expect(isAgendaMirror(metadata)).toBe(true);
        const source = agendaMirrorSource(metadata);
        expect(source).toEqual({
            kind: "DJ",
            id: "post-12345",
        });
    });

    it("détecte une source SONGES miroir valide", () => {
        const metadata = {
            source: {
                kind: "SONGES" as const,
                dreamRunId: "run-67890",
            },
            mirror: {
                label: "Rêve I",
            },
        };

        expect(isAgendaMirror(metadata)).toBe(true);
        const source = agendaMirrorSource(metadata);
        expect(source).toEqual({
            kind: "SONGES",
            id: "run-67890",
        });
    });

    it("gère gracieusement les métadonnées non miroir ou invalides", () => {
        expect(agendaMirrorSource(null)).toBeNull();
        expect(agendaMirrorSource(undefined)).toBeNull();
        expect(agendaMirrorSource({})).toBeNull();
        expect(agendaMirrorSource({ source: { kind: "UNKNOWN" as any } })).toBeNull();
        expect(agendaMirrorSource({ source: { kind: "DJ" as const } })).toBeNull();
        expect(agendaMirrorSource({ source: { kind: "SONGES" as const } })).toBeNull();
        expect(isAgendaMirror({})).toBe(false);
    });
});
