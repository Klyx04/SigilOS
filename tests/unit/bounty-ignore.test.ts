/**
 * Tests — `bounty-ignore.ts` : liste d'exclusion des avis **supprimés dans God**.
 *
 * Sans cette liste, la suppression d'un avis serait annulée par la synchronisation suivante
 * (le siphon recrée tout ce qu'il trouve dans les 5 races DofusDB). On vérifie ici les fonctions
 * **pures** (parse tolérant / normalisation / sérialisation) : aucun accès disque, aucun réseau.
 */
import { describe, expect, it } from "vitest";

import {
    IGNORED_BOUNTIES_PATH,
    normalizeIgnoredBounties,
    parseIgnoredBounties,
    serializeIgnoredBounties,
} from "@/lib/bounty-ignore";

describe("bounty-ignore — exclusions d'avis (God)", () => {
    it("chemin du fichier : dataset public versionnable (contrat de déploiement)", () => {
        expect(IGNORED_BOUNTIES_PATH.replace(/\\/g, "/")).toMatch(/\/public\/game-data\/ignored-bounties\.json$/);
    });

    it("parse : format courant `{ entries }`", () => {
        const json = JSON.stringify({
            entries: [
                { dofusdbId: 4834, name: "Predagob", deletedAt: "2026-09-16T12:00:00.000Z" },
                { dofusdbId: 3530, name: "Ronce", deletedAt: null },
            ],
            updatedAt: "2026-09-16T12:00:00.000Z",
        });
        expect(parseIgnoredBounties(json)).toEqual([
            { dofusdbId: 3530, name: "Ronce", deletedAt: null },
            { dofusdbId: 4834, name: "Predagob", deletedAt: "2026-09-16T12:00:00.000Z" },
        ]);
    });

    it("parse : tolérant (`{ dofusdbIds }`, tableau d'ids, fichier vide ou corrompu)", () => {
        expect(parseIgnoredBounties(JSON.stringify({ dofusdbIds: [4834, 3530] })).map((e) => e.dofusdbId))
            .toEqual([3530, 4834]);
        expect(parseIgnoredBounties(JSON.stringify([1, 2, 2])).map((e) => e.dofusdbId)).toEqual([1, 2]);
        expect(parseIgnoredBounties("")).toEqual([]);
        expect(parseIgnoredBounties(null)).toEqual([]);
        expect(parseIgnoredBounties("{ pas du json")).toEqual([]);
        expect(parseIgnoredBounties(JSON.stringify({ entries: "pas un tableau" }))).toEqual([]);
    });

    it("normalise : ids valides uniquement, dédoublonnés, triés, format d'objet ou d'id nu", () => {
        expect(normalizeIgnoredBounties([
            4834,
            { dofusdbId: "3530" },
            { id: 3555, name: "  Ronce  " },
            { dofusdbId: 0 },
            { dofusdbId: -3 },
            "abc",
            null,
        ])).toEqual([
            { dofusdbId: 3530, name: null, deletedAt: null },
            { dofusdbId: 3555, name: "Ronce", deletedAt: null },
            { dofusdbId: 4834, name: null, deletedAt: null },
        ]);
        expect(normalizeIgnoredBounties(undefined)).toEqual([]);
    });

    it("normalise : un doublon conserve le dernier nom connu (jamais perdu)", () => {
        expect(normalizeIgnoredBounties([
            { dofusdbId: 4834, name: "Predagob", deletedAt: "2026-09-16T00:00:00.000Z" },
            { dofusdbId: 4834, name: null },
        ])).toEqual([
            { dofusdbId: 4834, name: "Predagob", deletedAt: "2026-09-16T00:00:00.000Z" },
        ]);
    });

    it("sérialise : fichier lisible, date ISO, aller-retour stable (idempotent)", () => {
        const json = serializeIgnoredBounties([3530, { dofusdbId: 4834, name: "Predagob" }], new Date("2026-09-16T12:00:00.000Z"));
        expect(json.endsWith("\n")).toBe(true);
        expect(JSON.parse(json)).toEqual({
            entries: [
                { dofusdbId: 3530, name: null, deletedAt: null },
                { dofusdbId: 4834, name: "Predagob", deletedAt: null },
            ],
            updatedAt: "2026-09-16T12:00:00.000Z",
        });

        // Réécrire ce qu'on vient de lire ne change rien (pas de dérive du fichier).
        expect(serializeIgnoredBounties(parseIgnoredBounties(json), new Date("2026-09-16T12:00:00.000Z"))).toBe(json);
    });

    it("sérialise : date invalide ⇒ `updatedAt: null` (jamais « Invalid Date »)", () => {
        const json = serializeIgnoredBounties([], new Date("n/a"));
        expect(JSON.parse(json).updatedAt).toBeNull();
        expect(serializeIgnoredBounties([])).toMatch(/"updatedAt": "\d{4}-\d{2}-\d{2}T/);
    });
});
