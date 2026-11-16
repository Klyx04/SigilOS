/**
 * Journalisation des 404 — **règles pures**, testées sur le comportement.
 *
 * Ce qui compte : aucune donnée sensible ne part dans les logs (query, chemin brut du
 * Referer), et un lien interne cassé (Referer présent) est toujours visible même quand
 * un balayage de bots, lui, est échantillonné.
 */
import { describe, expect, it } from "vitest";
import {
    NOT_FOUND_PATH_MAX,
    NOT_FOUND_UA_MAX,
    sanitizeNotFoundPath,
    sanitizeRefererHost,
    sanitizeUserAgent,
    shouldLogNotFound,
} from "@/lib/not-found-log";

describe("journalisation des 404 — règles pures", () => {
    describe("chemin", () => {
        it("retire la query et le fragment", () => {
            expect(sanitizeNotFoundPath("/guides/foo?token=secret#top")).toBe("/guides/foo");
        });

        it("borne la longueur", () => {
            const long = "/" + "a".repeat(NOT_FOUND_PATH_MAX * 2);
            expect(sanitizeNotFoundPath(long)).toHaveLength(NOT_FOUND_PATH_MAX);
        });

        it("refuse une valeur qui n'est pas un chemin absolu", () => {
            expect(sanitizeNotFoundPath("javascript:alert(1)")).toBe("/[invalid]");
        });

        it("refuse les caractères de contrôle au lieu de les journaliser", () => {
            expect(sanitizeNotFoundPath("/x\ninjected")).toBe("/[invalid]");
            expect(sanitizeNotFoundPath("/x<script>")).toBe("/[invalid]");
        });

        it("retombe sur la racine quand le chemin est absent", () => {
            expect(sanitizeNotFoundPath(null)).toBe("/");
            expect(sanitizeNotFoundPath(undefined)).toBe("/");
        });

        it("garde un chemin normal, y compris encodé", () => {
            expect(sanitizeNotFoundPath("/guides/raid-gigalodon-dofus")).toBe("/guides/raid-gigalodon-dofus");
            expect(sanitizeNotFoundPath("/visiteurs/caf%C3%A9")).toBe("/visiteurs/caf%C3%A9");
        });
    });

    describe("referer", () => {
        it("ne garde que l'hôte, jamais le chemin", () => {
            expect(sanitizeRefererHost("https://sigilos.fr/dashboard/123/missions?x=1")).toBe("sigilos.fr");
        });

        it("ignore une valeur illisible ou absente", () => {
            expect(sanitizeRefererHost("pas une url")).toBeNull();
            expect(sanitizeRefererHost(null)).toBeNull();
        });
    });

    describe("agent utilisateur", () => {
        it("tronque à la borne", () => {
            expect(sanitizeUserAgent("a".repeat(NOT_FOUND_UA_MAX * 2))).toHaveLength(NOT_FOUND_UA_MAX);
        });

        it("rend null pour une valeur vide", () => {
            expect(sanitizeUserAgent("   ")).toBeNull();
            expect(sanitizeUserAgent(null)).toBeNull();
        });
    });

    describe("échantillonnage", () => {
        it("journalise toujours un 404 porté par un Referer (lien interne cassé)", () => {
            expect(shouldLogNotFound("/n-importe-quoi", true, 1000)).toBe(true);
        });

        it("reste déterministe pour un même chemin sans Referer", () => {
            const first = shouldLogNotFound("/scan/abc", false);
            for (let i = 0; i < 20; i += 1) {
                expect(shouldLogNotFound("/scan/abc", false)).toBe(first);
            }
        });

        it("laisse passer environ un cas sur quatre sans Referer", () => {
            const paths = Array.from({ length: 400 }, (_, i) => `/scan/${i}`);
            const logged = paths.filter((p) => shouldLogNotFound(p, false)).length;
            expect(logged).toBeGreaterThan(50);
            expect(logged).toBeLessThan(150);
        });

        it("journalise tout quand le taux vaut 1", () => {
            expect(shouldLogNotFound("/scan/abc", false, 1)).toBe(true);
        });
    });
});
