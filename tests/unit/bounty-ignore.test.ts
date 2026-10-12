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
    isIgnoredBounty,
    isIgnoredBountyName,
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

    /**
     * 🔶 08/10/2026 (bêta : un avis supprimé SANS `dofusdbId` — ligne historique — était
     * recréé à la passe suivante car aucune exclusion n'était enregistrée). Une entrée
     * sans id mais avec un nom est conservée (`dofusdbId: 0`) et le siphon filtre aussi
     * sur le nom normalisé : aucune résurrection possible.
     */
    it("normalise : une entrée sans id mais avec un nom est CONSERVÉE (`dofusdbId: 0`)", () => {
        expect(normalizeIgnoredBounties([
            { dofusdbId: 0, name: "  Avigropol " },
            { dofusdbId: null, name: "Ronce" },
            { dofusdbId: 0 }, // sans nom : toujours jeté
            { dofusdbId: -5, name: "Fantôme" }, // id invalide + nom : conservé par le nom
        ])).toEqual([
            // Tri par `dofusdbId` (stable : les sentinelles 0 gardent l'ordre d'insertion).
            { dofusdbId: 0, name: "Avigropol", deletedAt: null },
            { dofusdbId: 0, name: "Ronce", deletedAt: null },
            { dofusdbId: 0, name: "Fantôme", deletedAt: null },
        ]);
    });

    it("exclusion par nom : normalisation casse/espaces, jamais de faux positif", () => {
        const names = ["avigropol", "ronce"];
        expect(isIgnoredBountyName("  AVIGROPOL ", names)).toBe(true);
        expect(isIgnoredBountyName("Ronce", names)).toBe(true);
        expect(isIgnoredBountyName("Roncette", names)).toBe(false); // pas de sous-chaîne
        expect(isIgnoredBountyName("", names)).toBe(false);
        expect(isIgnoredBountyName(null, names)).toBe(false);
        expect(isIgnoredBountyName("Avigropol", [])).toBe(false); // liste vide explicite (jamais le disque en test)
    });

    it("`getIgnoredBountyIds` ignore les entrées sans id (sentinelle 0 jamais filtrante)", () => {
        // `getIgnoredBountyIds` lit le disque : on prouve la règle au niveau pur via
        // `normalize` + filtre — la sentinelle 0 ne doit jamais devenir un filtre par id.
        const normalized = normalizeIgnoredBounties([{ dofusdbId: 0, name: "Avigropol" }, 4834]);
        const ids = normalized.map((e) => e.dofusdbId).filter((id) => id > 0);
        expect(ids).toEqual([4834]);
        expect(isIgnoredBounty(0, ids)).toBe(false);
        expect(isIgnoredBounty(4834, ids)).toBe(true);
    });
});

describe("bounty — orphelins visibles dans God (pur, sans disque)", () => {
    /**
     * 🔶 B2 (09/10/2026) : l'instantané du siphon moins ce qui vient d'être exclu —
     * le composant God n'a qu'à afficher. Importé depuis `@/lib/bounty` (pur,
     * client-safe), jamais depuis `bounty-ignore` (accès disque, cf. incident 22/09).
     */
    it("soustrait les exclusions par id ET par nom, sans jamais jeter le reste", async () => {
        const { filterVisibleBountyOrphans } = await import("@/lib/bounty");
        const snapshot = [
            { id: "a", dofusdbId: 99999, name: "Faux Avis", slug: "faux-avis" },
            { id: "b", dofusdbId: null, name: "Vieux Dopeul", slug: "vieux-dopeul" },
            { id: "c", dofusdbId: 123, name: "Vrai Gars", slug: "vrai-gars" },
            { id: "", dofusdbId: 7, name: "Sans id God", slug: "x" },
        ];
        expect(filterVisibleBountyOrphans(snapshot, [99999], ["vieux dopeul"]).map((o) => o.id))
            .toEqual(["c"]);
        expect(filterVisibleBountyOrphans(snapshot, [], []).map((o) => o.id))
            .toEqual(["a", "b", "c"]);
        expect(filterVisibleBountyOrphans(null, [1], ["x"])).toEqual([]);
    });

    it("libellés courts des 5 types (pastilles du filtre God)", async () => {
        const { BOUNTY_RACE_SHORT, bountyRaceShortLabel } = await import("@/lib/bounty");
        expect(BOUNTY_RACE_SHORT).toEqual({
            32: "Classiques",
            90: "Frigost",
            127: "Dimensions",
            147: "Alignés",
            156: "Sufokia",
        });
        expect(bountyRaceShortLabel(90)).toBe("Frigost");
        expect(bountyRaceShortLabel(999, "Repli")).toBe("Repli");
        expect(bountyRaceShortLabel(null)).toBe("Avis de recherche");
    });
});
