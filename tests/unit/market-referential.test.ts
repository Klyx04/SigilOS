/**
 * Référentiel de libellés (`loadMarketReferential`, S8.5) — non-régression.
 *
 * Cause traitée : le siphon `/effects` ramène des **gabarits** DofusDB
 * (« Effet 63 », « }{ soins »). Le référentiel les publiait tels quels, y compris
 * en écrasant `labels[characteristic]` (ex. `labels[0] = "Effet 11"`), ce qui
 * obligeait chaque consommateur à re-tester `isPlaceholderStatLabel`.
 *
 * Mesuré en base (12/09/2026) : **231** gabarits sur **871** effets, dont **47**
 * réellement référencés par des items.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockCharacteristicFindMany = vi.fn();
const mockEffectFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        gameCharacteristic: { findMany: (...args: unknown[]) => mockCharacteristicFindMany(...args) },
        gameEffect: { findMany: (...args: unknown[]) => mockEffectFindMany(...args) },
    },
}));

import { EMPTY_MARKET_REFERENTIAL, loadMarketReferential } from "@/lib/market/referential";

beforeEach(() => {
    vi.clearAllMocks();
    mockCharacteristicFindMany.mockResolvedValue([]);
    mockEffectFindMany.mockResolvedValue([]);
});

describe("loadMarketReferential — hygiène des libellés (S8.5)", () => {
    it("publie les libellés réels et ignore les gabarits du siphon", async () => {
        mockCharacteristicFindMany.mockResolvedValue([
            { id: 10, name: "Force", keyword: "force", iconKey: "force" },
            { id: 11, name: "Vitalité", keyword: "vitalite", iconKey: null },
        ]);
        mockEffectFindMany.mockResolvedValue([
            { id: 118, name: "Force", characteristic: 10, isInPercent: false },
            { id: 11, name: "Effet 11", characteristic: 0, isInPercent: false },
            { id: 63, name: "Effet 63", characteristic: 0, isInPercent: false },
            { id: 72, name: "}{ soins", characteristic: 49, isInPercent: false },
            { id: 125, name: "Vitalité", characteristic: 11, isInPercent: true },
        ]);

        const referential = await loadMarketReferential();

        expect(referential.loaded).toBe(true);
        // Les gabarits ne sont JAMAIS publiés comme libellé d'effet…
        expect(referential.effectLabels[11]).toBeUndefined();
        expect(referential.effectLabels[63]).toBeUndefined();
        expect(referential.effectLabels[72]).toBeUndefined();
        // … ni comme libellé de caractéristique (ex. `labels[0] = "Effet 11"`).
        expect(referential.labels[0]).toBeUndefined();
        expect(referential.labels[49]).toBeUndefined();
        // Les vrais libellés passent.
        expect(referential.effectLabels[118]).toBe("Force");
        expect(referential.effectLabels[125]).toBe("Vitalité");
        expect(referential.labels[10]).toBe("Force");
        expect(referential.percentEffectIds).toEqual([125]);
    });

    it("hérite du libellé d'effet réel pour une caractéristique sans nom", async () => {
        mockCharacteristicFindMany.mockResolvedValue([]);
        mockEffectFindMany.mockResolvedValue([
            { id: 424, name: "Dommages Feu", characteristic: 89, isInPercent: false },
        ]);

        const referential = await loadMarketReferential();

        expect(referential.labels[89]).toBe("Dommages Feu");
    });

    it("retombe sur le référentiel vide si la base ne répond pas (fail-soft)", async () => {
        mockCharacteristicFindMany.mockRejectedValue(new Error("db down"));

        await expect(loadMarketReferential()).resolves.toEqual(EMPTY_MARKET_REFERENTIAL);
    });
});
