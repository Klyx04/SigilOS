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

function jsonResponse(body: unknown) {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => body,
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

    it("id numérique (ITEM) : l'iconId est résolu par l'API (garde d'identité) → 200 webp + persistance", async () => {
        const calls: string[] = [];
        const fetchMock = vi.fn((url: any) => {
            const u = String(url);
            calls.push(u);
            // 1) fiche DofusDB : l'id DOIT correspondre (garde d'identité).
            if (u.includes("/items/456")) return Promise.resolve(jsonResponse({ id: 456, iconId: 4242 }));
            // 2) image de l'APPARENCE (iconId), jamais « /img/items/456.png ».
            if (u.includes("/img/items/4242.png")) return Promise.resolve(imageResponse());
            return Promise.resolve({ ok: false, status: 404, headers: new Headers(), json: async () => null } as any);
        });
        vi.stubGlobal("fetch", fetchMock);
        mockExistsSync.mockReturnValue(false);

        const res = await GET(req("http://localhost/api/assets-dofus/items/456"), ctx("items", "456"));

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/webp");
        expect(mockWriteFile).toHaveBeenCalled();
        expect(calls).toContain("https://api.dofusdb.fr/img/items/4242.png");
        expect(calls).not.toContain("https://api.dofusdb.fr/img/items/456.png");
    });

    it("ITEM dont l'id ne correspond pas à la fiche DofusDB → placeholder (jamais l'icône d'un autre objet)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ id: 999, iconId: 4242 })));
        mockExistsSync.mockReturnValue(false);

        const res = await GET(req("http://localhost/api/assets-dofus/items/456"), ctx("items", "456"));

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("svg");
    });

    it("tout échoue → placeholder SVG 200 (pas 404, pas 500)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
        mockExistsSync.mockReturnValue(false);

        const res = await GET(req("http://localhost/api/assets-dofus/monsters/789"), ctx("monsters", "789"));

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("svg");
    });
});

/**
 * 🐛 Mesure du 27/09/2026 (signalement user : « des images ne correspondent pas aux avis ») :
 * l'apparence d'un monstre est indexée par son **gfxId**, jamais par son id — 100 % des
 * 300 monstres DofusDB testés ont `gfxId ≠ id` (Predagob 4834 → `img/monsters/1583.png` ;
 * `img/monsters/4834.png` → **404**) et le dump local `monsters_2x/` est indexé par gfx lui
 * aussi (281/300 collisions avec un id de monstre). L'ancien ordre servait donc l'apparence
 * d'un AUTRE monstre — et la figeait 1 an dans le cache (`{id}.webp`).
 */
describe("GET /api/assets-dofus/monsters/[id] — l'apparence suit le gfxId (autorité DofusDB)", () => {
    const MONSTER_ID = 4834;
    const GFX_ID = 1583;
    const API_URL = `https://api.dofusdb.fr/monsters/${MONSTER_ID}`;
    const IMG_URL = `https://api.dofusdb.fr/img/monsters/${GFX_ID}.png`;

    function mockApi(monster: unknown, opts: { fail?: boolean } = {}) {
        const fetchMock = vi.fn(async (url: string) => {
            const target = String(url);
            // Fiche DofusDB du monstre (…/monsters/<id>) — jamais l'URL d'image (`…/img/monsters/x.png`).
            if (/\/monsters\/\d+$/.test(target)) {
                if (opts.fail) throw new Error("api down");
                return jsonResponse(monster);
            }
            return imageResponse();
        });
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    const fetched = (fetchMock: any): string[] => fetchMock.mock.calls.map((c: any[]) => String(c[0]));

    it("résout par l'API puis `img` (gfx) — `img/monsters/{id}.png` n'est PLUS jamais demandé", async () => {
        const fetchMock = mockApi({ id: MONSTER_ID, gfxId: GFX_ID, img: IMG_URL });
        mockExistsSync.mockReturnValue(false);

        const res = await GET(req(`http://localhost/api/assets-dofus/monsters/${MONSTER_ID}`), ctx("monsters", String(MONSTER_ID)));

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/webp");
        const urls = fetched(fetchMock);
        expect(urls[0]).toBe(API_URL);
        expect(urls).toContain(IMG_URL);
        expect(urls.some((u) => u.includes(`img/monsters/${MONSTER_ID}.png`))).toBe(false);
        // Le cache reste indexé par l'id du MONSTRE (notre clé d'affichage) : jamais de doublon.
        expect(mockWriteFile).toHaveBeenCalled();
    });

    it("un `?url=` périmé (apparence d'un AUTRE monstre) ne passe jamais devant l'autorité", async () => {
        const fetchMock = mockApi({ id: MONSTER_ID, gfxId: GFX_ID, img: IMG_URL });
        mockExistsSync.mockReturnValue(false);

        await GET(
            req(`http://localhost/api/assets-dofus/monsters/${MONSTER_ID}?url=${encodeURIComponent("https://api.dofusdb.fr/img/monsters/9999.png")}`),
            ctx("monsters", String(MONSTER_ID))
        );

        const urls = fetched(fetchMock);
        expect(urls.some((u) => u.includes("9999"))).toBe(false);
        expect(urls).toContain(IMG_URL);
    });

    it("garde d'identité : une fiche de repli DofusDB (autre id) ⇒ placeholder, jamais son apparence", async () => {
        const fetchMock = mockApi({ id: 666, gfxId: 1, img: "https://api.dofusdb.fr/img/monsters/1.png" });
        mockExistsSync.mockReturnValue(false);

        const res = await GET(req(`http://localhost/api/assets-dofus/monsters/999999`), ctx("monsters", "999999"));

        expect(res.headers.get("content-type")).toContain("svg");
        expect(fetched(fetchMock).some((u) => u.includes("img/monsters/1.png"))).toBe(false);
    });

    it("API indisponible + `?url=` allowlisté ⇒ repli déclaré (fail-soft, jamais de 404)", async () => {
        mockApi(null, { fail: true });
        mockExistsSync.mockReturnValue(false);

        const res = await GET(
            req(`http://localhost/api/assets-dofus/monsters/${MONSTER_ID}?url=${encodeURIComponent(IMG_URL)}`),
            ctx("monsters", String(MONSTER_ID))
        );

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/webp");
    });

    it("le dump local est interrogé avec le gfxId, jamais avec l'id du monstre", async () => {
        const fetchMock = mockApi({ id: MONSTER_ID, gfxId: GFX_ID, img: IMG_URL });
        // Seul le fichier du gfx existe : ni le cache `{id}.webp`, ni `monsters_2x/{id}.png`.
        mockExistsSync.mockImplementation((p: any) => typeof p === "string" && p.includes("monsters_2x") && p.includes(String(GFX_ID)));
        mockReadFileSync.mockReturnValue(Buffer.alloc(100));

        const res = await GET(req(`http://localhost/api/assets-dofus/monsters/${MONSTER_ID}`), ctx("monsters", String(MONSTER_ID)));

        expect(res.headers.get("content-type")).toBe("image/webp");
        expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringContaining(String(GFX_ID)));
        expect(fetched(fetchMock).some((u) => u.includes("img/monsters"))).toBe(false);
    });
});
