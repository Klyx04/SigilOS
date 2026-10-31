/**
 * Réparation des fiches sans butin — **bornée, injectable, jamais bloquante**.
 *
 * Contexte mesuré (30/10/2026) : 106 fiches boss beta sur 146 servaient `drops: []` alors que
 * DofusDB documente les butins. Une fiche fraîche mais vide est désormais un trou
 * (`incomplète` dans `@/lib/data-health`) ; cette passe le répare, une seule fois par nom,
 * sans jamais persister un repli Unity.
 *
 * Aucune I/O : `db`, `fetchStats` et `persist` sont injectés.
 */

import { describe, it, expect, vi } from "vitest";
import {
    discoverMonsterFiches,
    removeEmptyDuplicateRows,
    repairMonsterDrops,
    type RepairMonsterRow,
} from "@/lib/monster-drops-repair";

const DROPS = [{ objectId: 1, name: "Barre Rabmarac au Nougat", percent: 6 }];

function emptyRow(over: Partial<RepairMonsterRow> & { monsterName: string }): RepairMonsterRow {
    return { monsterId: 1, stats: { drops: [] }, ...over };
}

function options(rows: RepairMonsterRow[], over: Partial<Parameters<typeof repairMonsterDrops>[0]> = {}) {
    const persist = vi.fn().mockResolvedValue(undefined);
    const fetchStats = vi.fn().mockResolvedValue({ success: true, data: { id: 1, name: "Boss", drops: DROPS } });
    const db = { monsterStat: { findMany: vi.fn().mockResolvedValue(rows) } };
    return { db, fetchStats, persist, persistSpy: persist, fetchSpy: fetchStats, ...over };
}

describe("removeEmptyDuplicateRows — doublons vides (mesure du 31/10/2026)", () => {
    const rowsOf = (entries: [number, string, boolean][]): RepairMonsterRow[] =>
        entries.map(([monsterId, monsterName, complete]) => ({
            monsterId,
            monsterName,
            stats: complete ? { drops: DROPS } : { drops: [] },
        }));
    const dbOf = (rows: RepairMonsterRow[]) => {
        const deleteMany = vi.fn(async (args: any) => ({ count: args.where.monsterId.in.length }));
        return { db: { monsterStat: { findMany: vi.fn().mockResolvedValue(rows), deleteMany } }, deleteMany };
    };

    it("supprime la ligne VIDE quand le même nom a une fiche saine", async () => {
        // Cas réel : « Blop Indigo Royal » 1186 (saine) + 7972 (vide).
        const { db, deleteMany } = dbOf(rowsOf([[1186, "Blop Indigo Royal", true], [7972, "Blop Indigo Royal", false]]));
        const report = await removeEmptyDuplicateRows({ db });
        expect(report.names).toBe(1);
        expect(report.removed).toBe(1);
        expect(deleteMany).toHaveBeenCalledWith({ where: { monsterId: { in: [7972] } } });
    });

    it("ne supprime RIEN quand aucune ligne du nom n'est saine (jamais la dernière chance)", async () => {
        const { db, deleteMany } = dbOf(rowsOf([[7972, "Blop Indigo Royal", false], [7900, "Blop Indigo Royal", false]]));
        const report = await removeEmptyDuplicateRows({ db });
        expect(report.names).toBe(0);
        expect(report.removed).toBe(0);
        expect(deleteMany).not.toHaveBeenCalled();
    });

    it("ne supprime jamais une ligne complète, et `dryRun` compte sans écrire", async () => {
        const { db, deleteMany } = dbOf(rowsOf([[1186, "Blop", true], [7972, "Blop", false]]));
        const report = await removeEmptyDuplicateRows({ db, dryRun: true });
        expect(report.removed).toBe(1);
        expect(deleteMany).not.toHaveBeenCalled();
    });
});

describe("discoverMonsterFiches — bestiaire jamais siphonné", () => {
    // `Monster.id` est un cuid (String) : le curseur est un texte, jamais un nombre.
    const catalogue = (entries: [string, string][]) => entries.map(([id, name]) => ({ id, name }));

    it("crée la fiche d'un nom inconnu, saute un nom déjà servi, avance le curseur", async () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const fetchStats = vi.fn().mockResolvedValue({ success: true, data: { id: 11, name: "Nouveau", drops: DROPS } });
        const db = { monster: { findMany: vi.fn().mockResolvedValue(catalogue([["c10", "Connu"], ["c11", "Nouveau"], ["c12", "Autre"]])) } };
        const report = await discoverMonsterFiches({
            db,
            fetchStats,
            persist,
            knownNames: new Set(["connu"]),
            limit: 10,
        });
        expect(report.skippedKnown).toBe(1);
        expect(report.created).toBe(2);
        expect(report.lastCursor).toBe("c12");
        expect(fetchStats).toHaveBeenCalledTimes(2);
        expect(persist).toHaveBeenCalledTimes(2);
    });

    it("budget épuisé : `deferred` et curseur NON avancé sur le monstre fautif (reprise exacte)", async () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const fetchStats = vi.fn().mockResolvedValue({
            success: true,
            data: { id: 21, name: "Bloqué", drops: [], source: "unity", degraded: "quota" },
        });
        const db = { monster: { findMany: vi.fn().mockResolvedValue(catalogue([["c21", "Bloqué"], ["c22", "Suivant"]])) } };
        const report = await discoverMonsterFiches({
            db,
            fetchStats,
            persist,
            knownNames: new Set(),
            limit: 10,
            afterCursor: "c20",
        });
        expect(report.deferred).toBe(true);
        expect(report.lastCursor).toBe("c20");   // on reprendra sur c21, pas c22
        expect(report.created).toBe(0);
        expect(fetchStats).toHaveBeenCalledTimes(1);
        expect(persist).not.toHaveBeenCalled();
    });
});

describe("repairMonsterDrops — réparation bornée", () => {

    it("re-fetch une fiche vide et persiste le butin retrouvé", async () => {
        const o = options([emptyRow({ monsterName: "L'Éternel Conflit", dungeonName: "Gantar" })]);
        const report = await repairMonsterDrops({ db: o.db, fetchStats: o.fetchStats, persist: o.persist });
        expect(report.repaired).toBe(1);
        expect(report.failed).toBe(0);
        expect(o.fetchSpy).toHaveBeenCalledWith("L'Éternel Conflit", "Gantar");
        expect(o.persistSpy).toHaveBeenCalledWith(
            expect.objectContaining({ drops: DROPS, dungeonName: "Gantar" })
        );
    });

    it("ne persiste jamais un repli Unity (budget DofusDB fermé)", async () => {
        const o = options([emptyRow({ monsterName: "Boss inconnu" })]);
        o.fetchSpy.mockResolvedValue({ success: true, data: { id: 9, name: "Boss inconnu", drops: [], source: "unity" } });
        const report = await repairMonsterDrops({ db: o.db, fetchStats: o.fetchStats, persist: o.persist });
        expect(report.skippedUnity).toBe(1);
        expect(report.repaired).toBe(0);
        expect(o.persistSpy).not.toHaveBeenCalled();
    });

    it("ne scanne pas une fiche déjà complète", async () => {
        const o = options([emptyRow({ monsterName: "Kardorim", stats: { drops: DROPS } })]);
        const report = await repairMonsterDrops({ db: o.db, fetchStats: o.fetchStats, persist: o.persist });
        expect(report.scanned).toBe(0);
        expect(o.fetchSpy).not.toHaveBeenCalled();
    });

    it("un nom déjà servi par une fiche complète n'est ni lu ni compté (ligne morte à côté)", async () => {
        // Cas réel : « Blop Indigo Royal » 1186 (25 butins) + 7972 (repli vide). La fiche **servie**
        // est saine : la ligne morte ne doit plus faire radoter le rapport ni brûler le budget
        // DofusDB à chaque passe (`repairMonsterDrops` la re-fetchait indéfiniment).
        const o = options([
            emptyRow({ monsterName: "Blop Indigo Royal", monsterId: 7972, lastSyncedAt: new Date("2026-10-01T00:00:00Z") }),
            {
                monsterId: 1186,
                monsterName: "Blop Indigo Royal",
                stats: { drops: DROPS },
                lastSyncedAt: new Date("2026-10-30T00:00:00Z"),
            },
        ]);
        const report = await repairMonsterDrops({ db: o.db, fetchStats: o.fetchStats, persist: o.persist });
        expect(report.scanned).toBe(0);
        expect(report.repaired).toBe(0);
        expect(o.fetchSpy).not.toHaveBeenCalled();
        expect(o.persistSpy).not.toHaveBeenCalled();
    });

    it("respecte la borne : `limit: 1` traite un seul monstre", async () => {
        const o = options([
            emptyRow({ monsterName: "Premier", stats: { drops: [] } }),
            emptyRow({ monsterName: "Second", stats: { drops: [] } }),
        ]);
        const report = await repairMonsterDrops({ db: o.db, fetchStats: o.fetchStats, persist: o.persist, limit: 1 });
        expect(report.scanned).toBe(1);
        expect(o.fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("budget épuisé (`degraded: \"quota\"`) : la passe s'arrête, sans faux « sans source »", async () => {
        const o = options([
            emptyRow({ monsterName: "Premier" }),
            emptyRow({ monsterName: "Second" }),
            emptyRow({ monsterName: "Troisième" }),
        ]);
        o.fetchSpy.mockResolvedValue({
            success: true,
            data: { id: 9, name: "Premier", drops: [], source: "unity", degraded: "quota" },
        });
        const report = await repairMonsterDrops({ db: o.db, fetchStats: o.fetchStats, persist: o.persist });
        expect(report.deferred).toBe(true);
        expect(report.scanned).toBe(1);        // on s'arrête au premier refus du budget
        expect(o.fetchSpy).toHaveBeenCalledTimes(1);
        expect(report.skippedUnity).toBe(0);   // ce n'est PAS « DofusDB ne connaît pas » (mesure 66/83)
        expect(o.persistSpy).not.toHaveBeenCalled();
    });

    it("`onlyNames` ne répare que la fiche visée (budget DofusDB préservé)", async () => {
        const o = options([
            emptyRow({ monsterName: "Kanigroula" }),
            emptyRow({ monsterName: "Bouftou Royal" }),
        ]);
        const report = await repairMonsterDrops({
            db: o.db,
            fetchStats: o.fetchStats,
            persist: o.persist,
            onlyNames: ["  kanigroula "],
        });
        expect(report.scanned).toBe(1);
        expect(o.fetchSpy).toHaveBeenCalledTimes(1);
        expect(o.fetchSpy).toHaveBeenCalledWith("Kanigroula", undefined);
        expect(o.persistSpy).toHaveBeenCalledTimes(1);
    });

    it("un échec unitaire n'arrête pas la passe", async () => {
        const o = options([
            emptyRow({ monsterName: "En panne" }),
            emptyRow({ monsterName: "Réparable" }),
        ]);
        o.fetchSpy
            .mockResolvedValueOnce({ success: false, error: "DofusDB HTTP 500" })
            .mockResolvedValueOnce({ success: true, data: { id: 2, name: "Réparable", drops: DROPS } });
        const report = await repairMonsterDrops({ db: o.db, fetchStats: o.fetchStats, persist: o.persist });
        expect(report.failed).toBe(1);
        expect(report.repaired).toBe(1);
        expect(report.details[0]).toContain("En panne");
    });

    it("deux lignes vides du même nom ne coûtent qu'une requête (doublons 147/7835)", async () => {
        const o = options([
            emptyRow({ monsterName: "Bouftou Royal", monsterId: 7835 }),
            emptyRow({ monsterName: "bouftou royal", monsterId: 147 }),
        ]);
        const report = await repairMonsterDrops({ db: o.db, fetchStats: o.fetchStats, persist: o.persist });
        expect(o.fetchSpy).toHaveBeenCalledTimes(1);
        expect(report.scanned).toBe(1);
    });

    it("une lecture de base en échec rend un rapport vide, sans jeter", async () => {
        const db = { monsterStat: { findMany: vi.fn().mockRejectedValue(new Error("base morte")) } };
        const report = await repairMonsterDrops({ db, fetchStats: vi.fn(), persist: vi.fn() });
        expect(report).toMatchObject({ scanned: 0, repaired: 0, failed: 0, deferred: false });
        expect(report.details[0]).toContain("lecture des fiches impossible");
    });
});
