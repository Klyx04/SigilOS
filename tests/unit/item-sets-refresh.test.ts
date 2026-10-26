/**
 * 🔁 Maintien du référentiel des panoplies (`refreshItemSetsCore`) — tourne dans le cron
 * `data-watch`, une fois par semaine.
 *
 * Ce qui est verrouillé ici (ce sont les seules choses qui peuvent se périmer en silence) :
 *  · le filigrane n'avance **que** sur une passe **complète** (sinon des panoplies jamais lues
 *    seraient sautées pour toujours) ;
 *  · un référentiel **vide** n'est jamais déclaré à jour (`uninitialized` ⇒ siphon manuel) ;
 *  · une panne DofusDB/Redis ne casse pas le cron (`error`, jamais d'exception).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCount = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: { gameItemSet: { count: (...args: any[]) => mockCount(...args) } },
}));

const mockSiphon = vi.fn();
vi.mock("@/lib/item-sets-siphon", () => ({
    siphonItemSetsCore: (...args: any[]) => mockSiphon(...args),
}));

const mockGetWatermark = vi.fn();
const mockSetWatermark = vi.fn();
vi.mock("@/server/game-data-sync-state-store", () => ({
    getItemSetsWatermark: (...args: any[]) => mockGetWatermark(...args),
    setItemSetsWatermark: (...args: any[]) => mockSetWatermark(...args),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    ITEM_SETS_REFRESH_MAX_PAGES,
    refreshItemSetsCore,
} from "@/server/item-sets-refresh";

/** Heure fixe : aucune règle testée ne dépend de l'horloge réelle. */
const NOW = new Date("2026-10-26T04:00:00.000Z");
const WATERMARK = "2026-10-19T04:00:00.000Z";

function siphonReport(patch: Record<string, unknown> = {}) {
    return {
        fetched: 0,
        toWrite: 0,
        written: 0,
        unchanged: 0,
        skipped: [],
        nextSkip: null,
        since: WATERMARK,
        ...patch,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(938);
    mockGetWatermark.mockResolvedValue(WATERMARK);
    mockSetWatermark.mockResolvedValue(undefined);
    mockSiphon.mockResolvedValue(siphonReport({ fetched: 12, written: 3, unchanged: 9 }));
});

describe("refreshItemSetsCore — maintien hebdomadaire des panoplies", () => {
    it("liaison de la veille : applique (`apply: true`), ciblée sur le filigrane, bornée", async () => {
        const report = await refreshItemSetsCore(NOW);

        expect(mockSiphon).toHaveBeenCalledWith({
            apply: true,
            maxPages: ITEM_SETS_REFRESH_MAX_PAGES,
            since: WATERMARK,
        });
        expect(report).toMatchObject({ state: "refreshed", since: WATERMARK, fetched: 12, written: 3, unchanged: 9 });
    });

    it("passe complète → filigrane posé avec 5 min de marge (une modification pendant la passe reste à relire)", async () => {
        const report = await refreshItemSetsCore(NOW);

        expect(mockSetWatermark).toHaveBeenCalledWith("2026-10-26T03:55:00.000Z");
        expect(report.nextWatermark).toBe("2026-10-26T03:55:00.000Z");
    });

    it("passe tronquée → filigrane INCHANGÉ (sinon des panoplies jamais lues seraient sautées)", async () => {
        mockSiphon.mockResolvedValue(siphonReport({ fetched: 300, nextSkip: 300 }));

        const report = await refreshItemSetsCore(NOW);

        expect(report.state).toBe("truncated");
        expect(report.nextWatermark).toBeNull();
        expect(mockSetWatermark).not.toHaveBeenCalled();
    });

    it("aucun filigrane → amorçage à 60 jours (le référentiel vient du siphon manuel)", async () => {
        mockGetWatermark.mockResolvedValue(null);

        await refreshItemSetsCore(NOW);

        expect(mockSiphon).toHaveBeenCalledWith(
            expect.objectContaining({ since: "2026-08-27T04:00:00.000Z" }),
        );
    });

    it("référentiel vide → « uninitialized » et AUCUNE lecture réseau (jamais un faux « à jour »)", async () => {
        mockCount.mockResolvedValue(0);

        const report = await refreshItemSetsCore(NOW);

        expect(report.state).toBe("uninitialized");
        expect(mockSiphon).not.toHaveBeenCalled();
        expect(mockSetWatermark).not.toHaveBeenCalled();
    });

    it("panne du siphon → « error », sans exception et sans filigrane", async () => {
        mockSiphon.mockRejectedValue(new Error("DofusDB 503"));

        const report = await refreshItemSetsCore(NOW);

        expect(report.state).toBe("error");
        expect(report.written).toBe(0);
        expect(mockSetWatermark).not.toHaveBeenCalled();
    });
});
