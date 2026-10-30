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
import { repairMonsterDrops, type RepairMonsterRow } from "@/lib/monster-drops-repair";

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

    it("respecte la borne : `limit: 1` traite un seul monstre", async () => {
        const o = options([
            emptyRow({ monsterName: "Premier", stats: { drops: [] } }),
            emptyRow({ monsterName: "Second", stats: { drops: [] } }),
        ]);
        const report = await repairMonsterDrops({ db: o.db, fetchStats: o.fetchStats, persist: o.persist, limit: 1 });
        expect(report.scanned).toBe(1);
        expect(o.fetchSpy).toHaveBeenCalledTimes(1);
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
