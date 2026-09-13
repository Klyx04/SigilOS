/**
 * Backfill des effets natifs (`backfillNativeEffects`, S4.0e) — non-régression.
 *
 * Bug corrigé : le `findMany` n'avait **ni filtre sur les effets ni tri**, donc
 * il renvoyait d'abord des milliers de fiches sans effet (`effects = []`) ; le lot
 * ressortait « 0 réparée » et la boucle du panneau God **s'arrêtait à la 1ʳᵉ
 * passe** alors que 10 661 fiches étaient réparables.
 *
 * ⚠️ La forme `NOT: { effects: { equals: [] } }` est **obligatoire** : la forme
 * `effects: { not: { equals: [] } }` est silencieusement ignorée par Prisma
 * (vérifié en base : 19 952 lignes au lieu de 10 661).
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

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        gameItem: {
            findMany: (...args: unknown[]) => mockFindMany(...args),
            update: (...args: unknown[]) => mockUpdate(...args),
            count: (...args: unknown[]) => mockCount(...args),
        },
    },
}));

import { backfillNativeEffects } from "@/server/actions/game-item-actions";

beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockResolvedValue(true);
    mockCanAccessBrick.mockResolvedValue(false);
    mockUpdate.mockResolvedValue({});
    mockCount.mockResolvedValue(10_661);
});

describe("backfillNativeEffects — garde d'autorisation", () => {
    it("refuse un utilisateur sans accès aux données de jeu", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        mockCanAccessBrick.mockResolvedValue(false);

        const res = await backfillNativeEffects(1000);

        expect(res).toMatchObject({ success: false, error: "Non autorisé" });
        expect(mockFindMany).not.toHaveBeenCalled();
    });
});

describe("backfillNativeEffects — requête (S4.0e)", () => {
    it("ne cible QUE les fiches ayant réellement des effets (NOT effects = [])", async () => {
        mockFindMany.mockResolvedValue([]);

        await backfillNativeEffects(1000);

        const args = mockFindMany.mock.calls[0][0];
        expect(args.where.NOT).toEqual({ effects: { equals: [] } });
        // L'ancienne forme défaillante ne doit jamais revenir.
        expect(args.where.effects).toBeUndefined();
        // Tri déterministe : sans lui, l'ordre physique décidait du lot.
        expect(args.orderBy).toEqual({ ankamaId: "asc" });
        expect(args.take).toBe(1000);
    });
});

describe("backfillNativeEffects — réparation", () => {
    it("répare les fiches exploitables et ignore celles sans effet", async () => {
        mockFindMany.mockResolvedValue([
            { id: "item-effectueux", ankamaId: 1710, effects: [{ effectId: 724, diceNum: 568, diceSide: 0 }], nativeEffects: null },
            { id: "item-vide", ankamaId: 1711, effects: [], nativeEffects: null },
            { id: "item-sans-effectId", ankamaId: 1712, effects: [{ effectId: 0 }], nativeEffects: null },
        ]);

        const res = await backfillNativeEffects(1000);

        expect(res.success).toBe(true);
        expect(res.data).toMatchObject({ scanned: 3, repaired: 1, remaining: 10_661 });
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const update = mockUpdate.mock.calls[0][0];
        expect(update.where).toEqual({ id: "item-effectueux" });
        // S7.4 — `diceSide = 0` ⇒ **valeur fixe** : la plage devient `[568, 568]`
        // (avant, `to: 0` produisait `[568 à 0]` puis « 0 SOUS LA PLAGE »).
        // Correction 13/09 — la ligne réparée est en plus **résolue**
        // (`isNegative`, et `label` quand le référentiel sait la nommer) : une
        // fiche rattrapée une fois s'affiche juste sans référentiel. Ici l'effet
        // 724 n'est ni curated ni dans le référentiel (base mockée) ⇒ aucun
        // libellé muet n'est persisté.
        expect(update.data.nativeEffects).toEqual([
            {
                effectId: 724,
                characteristic: null,
                from: 568,
                to: 568,
                category: null,
                elementId: null,
                isNegative: false,
            },
        ]);
    });
});
