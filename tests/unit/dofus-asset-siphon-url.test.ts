/**
 * Phase 1.2 — `siphonAndCompressImage` utilise la vraie URL fournie en premier.
 * L'ID logique ≠ toujours l'ID image (ex. Cadob 3220 → img 499) : deviner le
 * pattern faisait échouer des assets pourtant disponibles. La tentative 1
 * (pattern) ne doit jamais écraser un succès de la tentative 0.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────
const mockExistsSync = vi.fn();
const mockStatSync = vi.fn();
const mockMkdirSync = vi.fn();
vi.mock("fs", () => ({
    default: {
        existsSync: (...args: any[]) => mockExistsSync(...args),
        statSync: (...args: any[]) => mockStatSync(...args),
        mkdirSync: (...args: any[]) => mockMkdirSync(...args),
    },
    existsSync: (...args: any[]) => mockExistsSync(...args),
    statSync: (...args: any[]) => mockStatSync(...args),
    mkdirSync: (...args: any[]) => mockMkdirSync(...args),
}));

const mockSharpToFile = vi.fn();
vi.mock("sharp", () => ({
    default: vi.fn(() => ({ webp: () => ({ toFile: mockSharpToFile }) })),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { siphonAndCompressImage } from "@/lib/dofus-asset-siphon";

function imageResponse() {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => new Uint8Array(200).buffer,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockStatSync.mockReturnValue({ size: 500 });
    mockSharpToFile.mockResolvedValue(undefined);
    vi.unstubAllGlobals();
});

describe("siphonAndCompressImage — priorité à l'URL réelle", () => {
    it("télécharge d'abord l'URL fournie (img DofusDB), pas le pattern deviné", async () => {
        const fetchMock = vi.fn().mockResolvedValue(imageResponse());
        vi.stubGlobal("fetch", fetchMock);

        const res = await siphonAndCompressImage(
            "https://api.dofusdb.fr/img/monsters/499.png",
            "monsters",
            3220
        );

        expect(res.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.dofusdb.fr/img/monsters/499.png");
    });

    it("URL fournie hors allowlist → repli pattern (SSRF intact)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(imageResponse());
        vi.stubGlobal("fetch", fetchMock);

        const res = await siphonAndCompressImage("https://evil.example.com/x.png", "monsters", 3220);

        expect(res.success).toBe(true);
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.dofusdb.fr/img/monsters/3220.png");
    });

    it("URL fournie en échec → pattern tenté en repli (pas d'abandon)", async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new Error("down"))
            .mockResolvedValue(imageResponse());
        vi.stubGlobal("fetch", fetchMock);

        const res = await siphonAndCompressImage(
            "https://api.dofusdb.fr/img/monsters/499.png",
            "monsters",
            3220
        );

        expect(res.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toBe("https://api.dofusdb.fr/img/monsters/3220.png");
    });

    it("sans URL fournie → pattern direct (comportement historique)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(imageResponse());
        vi.stubGlobal("fetch", fetchMock);

        const res = await siphonAndCompressImage(null, "monsters", 3220);

        expect(res.success).toBe(true);
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.dofusdb.fr/img/monsters/3220.png");
    });

    it("fichier local présent → zéro requête réseau", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        mockExistsSync.mockReturnValue(true);

        const res = await siphonAndCompressImage("https://api.dofusdb.fr/img/monsters/499.png", "monsters", 3220);

        expect(res.success).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
