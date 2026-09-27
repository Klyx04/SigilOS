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
            updateMany: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { db } from "@/lib/prisma";
import { checkDofusDbDeltas } from "@/server/actions/game-quest-sync-actions";
import { siphonQuestsFromDofusDB } from "@/server/actions/game-data-admin-actions";
import {
    applyQuestVisualsCore,
    backfillQuestVisualsCore,
    syncQuestDeltasCore,
} from "@/lib/quest-siphon";

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
        // ⚠️ Ordre des lectures de `findMany` : (1) quêtes liées à DofusDB, (2) **rattrapage**
        // des contenus non stockés (24/09/2026), (3) index par nom.
        mockGameQuest.findMany
            .mockResolvedValueOnce([
                { dofusDbId: 10, name: "Quête Existante", levelMin: 50, levelMax: 50 },
                { dofusDbId: 20, name: "Quête Modifiée", levelMin: 60, levelMax: 60 },
            ])
            .mockResolvedValueOnce([])
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

    // 🖼️ Constat user du 27/09/2026 : « vrai asset quête Dofus par quête ». L'import initial
    // écrivait `q?.img` — un champ que `/quests` **n'expose pas** (mesuré) ⇒ 0/1 976 visuels.
    it("écrit la carte de départ de la quête comme visuel (et rien quand DofusDB n'en donne pas)", async () => {
        mockAuth.mockResolvedValue({ user: { id: "admin-1" } });
        mockIsSuperAdmin.mockResolvedValue(true);

        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({
            total: 2,
            data: [
                { id: 1, name: { fr: "Quête avec départ" }, category: { name: { fr: "Zone" } }, startPosition: [{ mapId: 160695296, npcId: 12 }] },
                { id: 2, name: { fr: "Quête sans départ" }, category: { name: { fr: "Zone" } } },
            ],
        })));
        mockGameQuest.findFirst.mockResolvedValue(null);
        mockGameQuest.findUnique.mockResolvedValue(null);
        mockGameQuest.create.mockResolvedValue({ id: "created-id" });

        const res = await siphonQuestsFromDofusDB(10);

        expect(res.data?.created).toBe(2);
        expect(mockGameQuest.create.mock.calls[0][0].data.imageUrl).toBe("/game-data/hd_maps/160695296.webp");
        expect(mockGameQuest.create.mock.calls[1][0].data.imageUrl).toBeNull();
    });
});

describe("backfillQuestVisualsCore — rattrapage du visuel des quêtes déjà en base", () => {
    it("lit les ids manquants puis interroge DofusDB par lots (id[$in][]), une requête par 50", async () => {
        mockGameQuest.findMany.mockResolvedValueOnce([
            { dofusDbId: 568 },
            { dofusDbId: 584 },
            { dofusDbId: null }, // jamais interrogé (aucune clé d'écriture)
        ]);
        const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
            data: [
                { id: 568, startPosition: [{ mapId: 54169887, npcId: 1241 }] },
                { id: 584, startPosition: [{ mapId: 54165306, npcId: 1280 }] },
            ],
        }));
        vi.stubGlobal("fetch", fetchMock);
        mockGameQuest.updateMany.mockResolvedValue({ count: 1 });

        const written = await backfillQuestVisualsCore(50);

        expect(written).toBe(2);
        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toContain("id[$in][]=568");
        expect(url).toContain("id[$in][]=584");
        expect(url).toContain("$select[]=startPosition");
        expect(mockGameQuest.updateMany).toHaveBeenCalledWith({
            // Garde d'état : la ligne doit **encore** être sans visuel (idempotent, jamais d'écrasement).
            where: { dofusDbId: 568, imageUrl: null },
            data: { imageUrl: "/game-data/hd_maps/54169887.webp" },
        });
    });

    it("ne fait AUCUNE requête quand toutes les quêtes ont déjà un visuel", async () => {
        mockGameQuest.findMany.mockResolvedValueOnce([]);
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        expect(await backfillQuestVisualsCore()).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("applyQuestVisualsCore — écriture locale des visuels", () => {
    it("n'écrit qu'un chemin interne, et seulement sur une ligne encore sans visuel", async () => {
        mockGameQuest.updateMany.mockResolvedValue({ count: 1 });

        const updated = await applyQuestVisualsCore([
            { dofusDbId: 10, imageUrl: "/game-data/hd_maps/160695296.webp" },
            { dofusDbId: 11, imageUrl: "https://exemple.fr/x.png" }, // externe → refusé
            { dofusDbId: 12, imageUrl: "//exemple.fr/x.png" }, // protocole-relatif → refusé
            { dofusDbId: -1, imageUrl: "/game-data/hd_maps/1.webp" }, // id invalide → refusé
        ]);

        expect(updated).toBe(1);
        expect(mockGameQuest.updateMany).toHaveBeenCalledTimes(1);
        expect(mockGameQuest.updateMany).toHaveBeenCalledWith({
            // Garde d'état dans le WHERE : jamais d'écrasement d'un visuel existant (idempotent).
            where: { dofusDbId: 10, imageUrl: null },
            data: { imageUrl: "/game-data/hd_maps/160695296.webp" },
        });
    });
});

describe("syncQuestDeltasCore — le visuel voyage avec la quête", () => {
    it("persiste la carte de départ, et laisse le visuel intact quand DofusDB n'en donne pas", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: 1, name: { fr: "Zone" } }] }))
            .mockResolvedValueOnce(jsonResponse({
                id: 10,
                name: { fr: "Ma quête" },
                levelMin: 1,
                levelMax: 2,
                categoryId: 1,
                updatedAt: "2026-09-01T00:00:00.000Z",
                startPosition: [{ mapId: 160695296, npcId: 7 }],
            }))
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: 1, name: { fr: "Zone" } }] }))
            .mockResolvedValueOnce(jsonResponse({
                id: 11,
                name: { fr: "Sans départ" },
                levelMin: 1,
                levelMax: 2,
                categoryId: 1,
                updatedAt: "2026-09-01T00:00:00.000Z",
            })));
        mockGameQuest.findFirst.mockResolvedValue(null);
        mockGameQuest.upsert.mockResolvedValue({ id: "created-id" });

        await syncQuestDeltasCore([10]);
        expect(mockGameQuest.upsert.mock.calls[0][0].create.imageUrl).toBe(
            "/game-data/hd_maps/160695296.webp"
        );

        await syncQuestDeltasCore([11]);
        // `undefined` = « ne touche pas » pour Prisma : on n'efface jamais un visuel déjà posé.
        expect(mockGameQuest.upsert.mock.calls[1][0].create.imageUrl).toBeUndefined();
    });
});

