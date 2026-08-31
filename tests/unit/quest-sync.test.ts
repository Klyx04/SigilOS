import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn(),
    canAccessBrick: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
    db: {
        gameQuest: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { db } from "@/lib/prisma";
import { checkDofusDbDeltas } from "@/server/actions/game-quest-sync-actions";
import { siphonQuestsFromDofusDB } from "@/server/actions/game-data-admin-actions";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockIsSuperAdmin = isSuperAdmin as unknown as ReturnType<typeof vi.fn>;
const mockGameQuest = db.gameQuest as any;

function jsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe("checkDofusDbDeltas — DofusDB Quest Sync", () => {
    it("détecte correctement les nouvelles quêtes et les quêtes modifiées", async () => {
        mockAuth.mockResolvedValue({ user: { id: "admin-1" } });
        mockIsSuperAdmin.mockResolvedValue(true);

        // Quêtes locales existantes
        mockGameQuest.findMany
            .mockResolvedValueOnce([
                { dofusDbId: 10, name: "Quête Existante", levelMin: 50, levelMax: 50 },
                { dofusDbId: 20, name: "Quête Modifiée", levelMin: 60, levelMax: 60 },
            ])
            .mockResolvedValueOnce([
                { id: "q1", dofusDbId: 10, name: "Quête Existante", levelMin: 50, levelMax: 50 },
                { id: "q2", dofusDbId: 20, name: "Quête Modifiée", levelMin: 60, levelMax: 60 },
            ]);

        // Mock fetch DofusDB
        const fetchMock = vi.fn()
            // 1. Total count
            .mockResolvedValueOnce(jsonResponse({ total: 3 }))
            // 2. Fetch quests with select array
            .mockResolvedValueOnce(jsonResponse({
                total: 3,
                limit: 500,
                skip: 0,
                data: [
                    { id: 10, name: { fr: "Quête Existante" }, levelMin: 50, levelMax: 50, categoryId: 1 },
                    { id: 20, name: { fr: "Quête Modifiée" }, levelMin: 70, levelMax: 70, categoryId: 1 }, // Level changed
                    { id: 30, name: { fr: "Nouvelle Quête" }, levelMin: 100, levelMax: 100, categoryId: 2 }, // New quest
                ]
            }));
        vi.stubGlobal("fetch", fetchMock);

        const res = await checkDofusDbDeltas();

        expect(res.success).toBe(true);
        expect(res.data?.totalRemote).toBe(3);
        expect(res.data?.totalLocal).toBe(2);
        expect(res.data?.deltas).toHaveLength(2);

        const newDelta = res.data?.deltas.find(d => d.dofusDbId === 30);
        expect(newDelta).toBeDefined();
        expect(newDelta?.type).toBe("NEW");
        expect(newDelta?.name).toBe("Nouvelle Quête");

        const modDelta = res.data?.deltas.find(d => d.dofusDbId === 20);
        expect(modDelta).toBeDefined();
        expect(modDelta?.type).toBe("MODIFIED");
        expect(modDelta?.levelMin).toBe(70);
    });
});

describe("siphonQuestsFromDofusDB — Siphon continu", () => {
    it("pagine au-delà des quêtes déjà existantes pour importer les quêtes demandées", async () => {
        mockAuth.mockResolvedValue({ user: { id: "admin-1" } });
        mockIsSuperAdmin.mockResolvedValue(true);

        const page1Quests = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            name: { fr: `Quête Existante ${i + 1}` },
            levelMin: 10,
            levelMax: 10,
            category: { name: { fr: "Zone" } },
        }));

        const page2Quests = Array.from({ length: 10 }, (_, i) => ({
            id: 51 + i,
            name: { fr: `Nouvelle Quête ${51 + i}` },
            levelMin: 20,
            levelMax: 20,
            category: { name: { fr: "Zone" } },
        }));

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                total: 60,
                limit: 50,
                skip: 0,
                data: page1Quests,
            }))
            .mockResolvedValueOnce(jsonResponse({
                total: 60,
                limit: 50,
                skip: 50,
                data: page2Quests,
            }));
        vi.stubGlobal("fetch", fetchMock);

        // Les 50 premières existent, les 10 suivantes sont neuves
        mockGameQuest.findFirst.mockImplementation(async ({ where }: any) => {
            if (where?.dofusDbId && where.dofusDbId <= 50) return { id: `db-${where.dofusDbId}` };
            return null;
        });

        mockGameQuest.findUnique.mockResolvedValue(null);
        mockGameQuest.create.mockResolvedValue({ id: "created-id" });

        const res = await siphonQuestsFromDofusDB(10);

        expect(res.success).toBe(true);
        expect(res.data?.created).toBe(10);
        expect(res.data?.skipped).toBe(50);
        expect(mockGameQuest.create).toHaveBeenCalledTimes(10);
    });
});
