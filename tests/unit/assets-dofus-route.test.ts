/**
 * Phase 1.1 — Proxy `/api/assets-dofus/[type]/[id]` : jamais de 404.
 * local → siphon à la volée → placeholder SVG 200. Hôtes distants allowlistés.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFile = vi.fn();
vi.mock("fs", () => ({
    default: {
        existsSync: (...args: any[]) => mockExistsSync(...args),
        readFileSync: (...args: any[]) => mockReadFileSync(...args),
        writeFile: (...args: any[]) => mockWriteFile(...args),
    },
    existsSync: (...args: any[]) => mockExistsSync(...args),
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
    writeFile: (...args: any[]) => mockWriteFile(...args),
}));

const mockSharpToBuffer = vi.fn();
vi.mock("sharp", () => ({
    default: vi.fn(() => ({ webp: () => ({ toBuffer: mockSharpToBuffer }) })),
}));

vi.mock("@/lib/dofus-asset-siphon", () => ({
    ASSET_DIRS: { monsters: "/tmp/sigilos-m", items: "/tmp/sigilos-i", spells: "/tmp/sigilos-s" },
    ensureAssetDirsExist: vi.fn(),
}));

const mockAssertSafeUrl = vi.fn();
vi.mock("@/lib/image-downloader", () => ({
    assertSafeUrl: (...args: any[]) => mockAssertSafeUrl(...args),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/assets-dofus/[type]/[id]/route";

function req(url: string) {
    return new NextRequest(url);
}
function ctx(type: string, id: string) {
    return { params: Promise.resolve({ type, id }) };
}
function imageResponse(body: object = {}) {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png", "content-length": "100" }),
        arrayBuffer: async () => new Uint8Array(100).buffer,
        ...body,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAssertSafeUrl.mockResolvedValue(undefined);
    mockSharpToBuffer.mockResolvedValue(Buffer.from("webp-bytes"));
    vi.unstubAllGlobals();
});

describe("GET /api/assets-dofus/[type]/[id] — garde-fous", () => {
    it("type invalide → 400", async () => {
        const res = await GET(req("http://localhost/api/assets-dofus/boss/123"), ctx("boss", "123"));
        expect(res.status).toBe(400);
    });

    it("id vide après sanitize → 400", async () => {
        const res = await GET(req("http://localhost/api/assets-dofus/monsters/..."), ctx("monsters", "..."));
        expect(res.status).toBe(400);
    });

    it("webp local présent → 200 image/webp sans fetch distant", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(Buffer.alloc(100));

        const res = await GET(req("http://localhost/api/assets-dofus/monsters/123"), ctx("monsters", "123"));

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/webp");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("?url= hors allowlist + id non numérique → placeholder SVG 200 (jamais 404)", async () => {
        vi.stubGlobal("fetch", vi.fn());
        mockExistsSync.mockReturnValue(false);

        const res = await GET(
            req("http://localhost/api/assets-dofus/monsters/abc?url=" + encodeURIComponent("https://evil.example.com/x.png")),
            ctx("monsters", "abc")
        );

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("svg");
    });

    it("id numérique, distant OK → 200 webp + persistance disque", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(imageResponse()));
        mockExistsSync.mockReturnValue(false);

        const res = await GET(req("http://localhost/api/assets-dofus/monsters/456"), ctx("monsters", "456"));

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/webp");
        expect(mockWriteFile).toHaveBeenCalled();
    });

    it("tout échoue → placeholder SVG 200 (pas 404, pas 500)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
        mockExistsSync.mockReturnValue(false);

        const res = await GET(req("http://localhost/api/assets-dofus/monsters/789"), ctx("monsters", "789"));

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("svg");
    });
});
