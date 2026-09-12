/**
 * Purge des libellés d'effets gabarits (`purgePlaceholderEffectLabels`, S8.5).
 *
 * Le siphon `/effects` ramène **231** gabarits (« Effet 63 », « }{ soins ») sur
 * **871** effets. La purge doit être **idempotente**, **sans suppression**, et
 * **sans invention** : seule la caractéristique jointe (`GameCharacteristic`) est
 * une source fiable — et en base, les 231 gabarits portent `characteristic = 0`,
 * donc la purge ne répare rien tant que le siphon n'apporte pas mieux.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/dofus-asset-siphon", () => ({ siphonAndCompressImage: vi.fn() }));
vi.mock("@/lib/dofusdb-limiter", () => ({ dofusDbFetch: vi.fn() }));

const mockIsSuperAdmin = vi.fn();
const mockCanAccessBrick = vi.fn();
vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: (...args: unknown[]) => mockIsSuperAdmin(...args),
    canAccessBrick: (...args: unknown[]) => mockCanAccessBrick(...args),
}));

const mockEffectFindMany = vi.fn();
const mockEffectUpdate = vi.fn();
const mockEffectDelete = vi.fn();
const mockCharacteristicFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        gameEffect: {
            findMany: (...args: unknown[]) => mockEffectFindMany(...args),
            update: (...args: unknown[]) => mockEffectUpdate(...args),
            delete: (...args: unknown[]) => mockEffectDelete(...args),
        },
        gameCharacteristic: {
            findMany: (...args: unknown[]) => mockCharacteristicFindMany(...args),
        },
    },
}));

import { purgePlaceholderEffectLabels } from "@/server/actions/game-item-actions";

beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockResolvedValue(true);
    mockCanAccessBrick.mockResolvedValue(false);
    mockEffectUpdate.mockResolvedValue({});
    mockCharacteristicFindMany.mockResolvedValue([]);
});

describe("purgePlaceholderEffectLabels — garde d'autorisation", () => {
    it("refuse un utilisateur sans accès aux données de jeu", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        mockCanAccessBrick.mockResolvedValue(false);

        const res = await purgePlaceholderEffectLabels();

        expect(res).toMatchObject({ success: false, error: "Non autorisé" });
        expect(mockEffectFindMany).not.toHaveBeenCalled();
    });
});

describe("purgePlaceholderEffectLabels — ciblage", () => {
    it("ne vise que les gabarits (« Effet … » / accolades) et rien d'autre", async () => {
        mockEffectFindMany.mockResolvedValue([]);

        const res = await purgePlaceholderEffectLabels();

        expect(res).toMatchObject({ success: true, data: { scanned: 0, repaired: 0, unresolved: 0 } });
        const args = mockEffectFindMany.mock.calls[0][0];
        expect(args.where.OR).toEqual([
            { name: { startsWith: "Effet " } },
            { name: { contains: "{" } },
            { name: { contains: "}" } },
        ]);
        // Aucune écriture si rien à faire.
        expect(mockEffectUpdate).not.toHaveBeenCalled();
    });
});

describe("purgePlaceholderEffectLabels — idempotence & sûreté", () => {
    it("répare depuis la caractéristique jointe et ne supprime jamais rien", async () => {
        mockEffectFindMany.mockResolvedValue([
            { id: 11, name: "Effet 11", characteristic: 10 },
            { id: 63, name: "Effet 63", characteristic: 0 },
            { id: 72, name: "}{ soins", characteristic: null },
        ]);
        mockCharacteristicFindMany.mockResolvedValue([
            { id: 10, name: "Force" },
            { id: 0, name: "Effet 0" },
        ]);

        const res = await purgePlaceholderEffectLabels();

        expect(res.success).toBe(true);
        expect(res.data).toEqual({ scanned: 3, repaired: 1, unresolved: 2 });
        expect(mockEffectUpdate).toHaveBeenCalledTimes(1);
        expect(mockEffectUpdate.mock.calls[0][0]).toEqual({
            where: { id: 11 },
            data: { name: "Force" },
        });
        // La purge est purement additive : jamais de `delete`.
        expect(mockEffectDelete).not.toHaveBeenCalled();
    });

    it("relancer la purge est sans effet une fois les lignes réparées", async () => {
        // 2ᵉ passe : le gabarit réparé n'est plus renvoyé par la requête.
        mockEffectFindMany.mockResolvedValue([]);

        const res = await purgePlaceholderEffectLabels();

        expect(res.data).toEqual({ scanned: 0, repaired: 0, unresolved: 0 });
        expect(mockEffectUpdate).not.toHaveBeenCalled();
    });

    it("ne répare pas avec un libellé-gabarit de caractéristique (« Effet 0 »)", async () => {
        mockEffectFindMany.mockResolvedValue([{ id: 30, name: "Effet 30", characteristic: 0 }]);
        mockCharacteristicFindMany.mockResolvedValue([{ id: 0, name: "Effet 0" }]);

        const res = await purgePlaceholderEffectLabels();

        expect(res.data).toEqual({ scanned: 1, repaired: 0, unresolved: 1 });
        expect(mockEffectUpdate).not.toHaveBeenCalled();
    });
});
