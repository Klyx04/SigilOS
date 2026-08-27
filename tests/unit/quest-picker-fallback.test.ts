import { describe, it, expect, vi, afterEach } from "vitest";

// Mocks globaux : auth (session) + prisma (table GameQuest).
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
    db: {
        gameQuest: { findMany: vi.fn() },
    },
}));

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { searchGameQuests } from "@/server/actions/picker-actions";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockFindMany = db.gameQuest.findMany as unknown as ReturnType<typeof vi.fn>;

function dofusdbResponse(data: unknown): Response {
    return new Response(JSON.stringify({ total: Array.isArray(data) ? data.length : 0, data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe("searchGameQuests — local-first + fallback DofusDB", () => {
    it("retourne les quêtes locales (pas d'appel réseau) si la base locale a un résultat", async () => {
        (mockAuth as any).mockResolvedValue({ user: { id: "u1" } });
        mockFindMany.mockResolvedValueOnce([
            { id: "1", name: "Quête Locale", category: null, levelMin: 1, levelMax: 200, imageUrl: null },
        ]);
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await searchGameQuests("quête");

        expect(res.success).toBe(true);
        expect((res as any).data).toHaveLength(1);
        expect((res as any).data[0]).toMatchObject({ name: "Quête Locale", levelMax: 200 });
        // Aucun fallback réseau quand le local répond.
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("recherche < 2 caractères → liste locale seule, sans appel réseau", async () => {
        (mockAuth as any).mockResolvedValue({ user: { id: "u1" } });
        mockFindMany.mockResolvedValue([]);
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await searchGameQuests("a");

        expect(res.success).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("base locale vide + requête >= 2 car. → fallback API DofusDB", async () => {
        (mockAuth as any).mockResolvedValue({ user: { id: "u1" } });
        // 1er appel (local) = vide ; 2e appel (dans le fallback, re-recherche locale) = vide.
        mockFindMany.mockResolvedValue([]);
        const fetchMock = vi.fn().mockResolvedValue(
            dofusdbResponse([
                { id: 42, name: { fr: "Quête DofusDB" }, levelMin: 50, category: { name: { fr: "Épopée" } } },
            ])
        );
        vi.stubGlobal("fetch", fetchMock);

        const res = await searchGameQuests("dofus");

        expect(res.success).toBe(true);
        expect(fetchMock).toHaveBeenCalled();
        const data = (res as any).data;
        expect(data).toHaveLength(1);
        expect(data[0]).toMatchObject({ name: "Quête DofusDB", category: "Épopée", levelMin: 50, levelMax: null });
    });
});
