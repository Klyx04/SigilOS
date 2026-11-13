import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AUD-02 (audit 13/11/2026) — `/api/uploads` utilisait `startsWith(UPLOAD_ROOT)`
 * seul : un dossier frère (`public/uploads_backup`) passait le contrôle.
 */
const m = vi.hoisted(() => ({
    stat: vi.fn(),
    readFile: vi.fn(),
}));

vi.mock("fs/promises", () => ({ stat: m.stat, readFile: m.readFile }));
vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { GET } from "@/app/api/uploads/[...path]/route";

function ctx(path: string[]) {
    return { params: Promise.resolve({ path }) } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    m.stat.mockResolvedValue({ isFile: () => true, size: 2 });
    m.readFile.mockResolvedValue(Buffer.from("ok"));
});

describe("GET /api/uploads — confinement au dossier", () => {
    it("refuse un dossier frère par contournement de préfixe", async () => {
        const res = await GET({} as any, ctx(["..", "uploads_backup", "x.webp"]));
        expect(res.status).toBe(403);
        expect(m.stat).not.toHaveBeenCalled();
    });

    it("refuse une remontée hors de public/uploads", async () => {
        const res = await GET({} as any, ctx(["..", "private_uploads", "x.webp"]));
        expect(res.status).toBe(403);
        expect(m.readFile).not.toHaveBeenCalled();
    });

    it("sert un fichier légitime sous public/uploads", async () => {
        const res = await GET({} as any, ctx(["assets-dofus", "x.webp"]));
        expect(res.status).toBe(200);
        expect(m.readFile).toHaveBeenCalledTimes(1);
    });
});
