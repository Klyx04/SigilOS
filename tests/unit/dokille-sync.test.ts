import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
}));

const { mockDb } = vi.hoisted(() => {
    return {
        mockDb: {
            guildConfig: {
                findFirst: vi.fn(),
            },
            userProfile: {
                findUnique: vi.fn(),
            },
            dofusItem: {
                findUnique: vi.fn(),
            },
            dofusQuestChain: {
                findMany: vi.fn(),
            },
            playerDofusProgress: {
                upsert: vi.fn(),
                update: vi.fn(),
            },
            playerDofusQuestProgress: {
                upsert: vi.fn(),
            },
            $transaction: vi.fn(async (promises: any[]) => Promise.all(promises)),
        },
    };
});

vi.mock("@/lib/prisma", () => ({
    db: mockDb,
}));

import { getUserContext } from "@/server/actions/user-actions";
import { toggleDofusObtained, updateDokilleProgress } from "@/server/actions/dofus-quest-actions";
import { ALL_KROKILLE_MONSTERS } from "@/components/dofus-quests/DofusDokilleTracker";

describe("Dokille & Dolmanax — Synchronisation complète", () => {
    const mockGetUserContext = getUserContext as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserContext.mockResolvedValue({
            isAuthenticated: true,
            isMember: true,
            profileId: "profile-123",
            id: "user-123",
        });

        mockDb.guildConfig.findFirst.mockResolvedValue({ id: "internal-guild-123" });
    });

    it("toggleDofusObtained(dokille, true) enregistre les 20 krokilles et valide toutes les quêtes", async () => {
        mockDb.dofusItem.findUnique.mockResolvedValue({ slug: "dokille" });
        mockDb.dofusQuestChain.findMany.mockResolvedValue([
            { entries: [{ id: "quest-1" }, { id: "quest-2" }] },
            { entries: [{ id: "quest-3" }, { id: "quest-4" }] },
        ]);

        const res = await toggleDofusObtained("guild-test", "dofus-dokille-id", true, "PRINCIPAL", false);

        expect(res.success).toBe(true);

        // Vérifie l'upsert du Dofus avec notes KROKILLES:[...] et 100%
        expect(mockDb.playerDofusProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                profileId_dofusId_characterName: {
                    profileId: "profile-123",
                    dofusId: "dofus-dokille-id",
                    characterName: "PRINCIPAL",
                },
            },
            update: expect.objectContaining({
                isObtained: true,
                completionPercent: 100,
                notes: `KROKILLES:${JSON.stringify(ALL_KROKILLE_MONSTERS)}`,
            }),
        }));

        // Vérifie que les 4 quêtes de la chaîne sont complétées
        expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it("updateDokilleProgress avec 20 monstres valide automatiquement toutes les quêtes et marque le Dokille obtenu", async () => {
        mockDb.dofusQuestChain.findMany.mockResolvedValue([
            { entries: [{ id: "q1" }, { id: "q2" }] },
        ]);

        const res = await updateDokilleProgress("guild-test", "dofus-dokille-id", ALL_KROKILLE_MONSTERS, "PRINCIPAL");

        expect(res.success).toBe(true);

        // Vérifie que playerDofusProgress est enregistré comme isObtained: true, 100%
        expect(mockDb.playerDofusProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                completionPercent: 100,
                isObtained: true,
            }),
        }));

        // Transaction de validation des quêtes
        expect(mockDb.$transaction).toHaveBeenCalled();
    });
});
