/**
 * Phase 5.2 — Items disparus de DofusDB : flag isDeprecated, jamais supprimés.
 * Les ressuscités (de retour côté distant) repassent actifs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        gameItem: {
            findMany: (...args: any[]) => mockFindMany(...args),
            updateMany: (...args: any[]) => mockUpdateMany(...args),
        },
    },
}));

vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn().mockResolvedValue(true),
    canAccessBrick: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/dofus-asset-siphon", () => ({
    siphonAndCompressImage: vi.fn(),
    getAssetStorageStats: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    diffVanishedIds,
    previewVanishedGameItems,
    flagVanishedGameItems,
} from "@/server/actions/game-item-actions";

function idsJson(ids: number[]) {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ data: ids.map((id) => ({ id })) }),
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe("diffVanishedIds (pur)", () => {
    it("retourne les locaux absents du distant, ignore les invalides", () => {
        expect(diffVanishedIds([1, 2, 3], [2, 3, 4])).toEqual([1]);
        expect(diffVanishedIds([0, -1, NaN as any, 5], [5])).toEqual([]);
        expect(diffVanishedIds([], [1])).toEqual([]);
    });
});

describe("previewVanishedGameItems (dry-run, aucun write)", () => {
    it("liste disparus + ressuscitables sans écrire", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(idsJson([2, 3])));
        mockFindMany
            .mockResolvedValueOnce([
                { ankamaId: 1, name: "Vieux" },
                { ankamaId: 2, name: "Actuel" },
            ])
            .mockResolvedValueOnce([{ ankamaId: 3, name: "Revenu" }]);

        const res = await previewVanishedGameItems();

        expect(res.success).toBe(true);
        expect(res.data?.vanished).toEqual([{ ankamaId: 1, name: "Vieux" }]);
        expect(res.data?.revivable).toEqual([{ ankamaId: 3, name: "Revenu" }]);
        expect(res.data?.localTotal).toBe(3);
        expect(res.data?.remoteTotal).toBe(2);
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("DofusDB injoignable → échec propre, aucun write", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));

        const res = await previewVanishedGameItems();

        expect(res.success).toBe(false);
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });
});

describe("flagVanishedGameItems (applique, jamais de delete)", () => {
    it("flag les disparus + ressuscite les revenus", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(idsJson([2, 3])));
        mockFindMany
            .mockResolvedValueOnce([{ ankamaId: 1, name: "Vieux" }])
            .mockResolvedValueOnce([{ ankamaId: 3, name: "Revenu" }]);
        mockUpdateMany.mockResolvedValue({ count: 1 });

        const res = await flagVanishedGameItems();

        expect(res.success).toBe(true);
        expect(res.data).toEqual({ deprecated: 1, revived: 1 });
        expect(mockUpdateMany).toHaveBeenCalledTimes(2);
        expect(mockUpdateMany.mock.calls[0][0]).toMatchObject({
            where: { ankamaId: { in: [1] }, isDeprecated: false },
            data: { isDeprecated: true },
        });
        expect(mockUpdateMany.mock.calls[1][0]).toMatchObject({
            where: { ankamaId: { in: [3] }, isDeprecated: true },
            data: { isDeprecated: false },
        });
    });
});
