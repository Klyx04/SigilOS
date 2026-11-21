import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * AUD-05 (audit 13/11/2026) — le proxy d'images ne doit jamais servir un SVG
 * (contenu actif) depuis l'origine SigilOS. Un `<svg onload=…>` ne contient pas
 * `<script>` et passait l'ancien filtre.
 */
const m = vi.hoisted(() => ({
    mkdir: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    safeFetch: vi.fn(),
}));

vi.mock("node:fs", () => {
    const api = {
        promises: {
            mkdir: m.mkdir,
            readdir: m.readdir,
            unlink: m.unlink,
            stat: m.stat,
            writeFile: m.writeFile,
            readFile: m.readFile,
        },
    };
    return { default: api, ...api };
});
// Le proxy passe par la connexion sûre : on délègue au `fetch` stubé par chaque cas.
vi.mock("@/lib/safe-fetch", () => ({ safeFetch: m.safeFetch }));

import { GET } from "@/app/api/proxy-image/route";

function req(url: string) {
    return { nextUrl: { searchParams: new URLSearchParams({ url }) } } as any;
}

function fetchReturning(body: BodyInit, contentType: string, length: number) {
    return vi.fn(async () =>
        new Response(body, {
            status: 200,
            headers: { "content-type": contentType, "content-length": String(length) },
        }),
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    // Cache froid : aucun fichier, dossier créé sans erreur, écriture fail-open.
    m.stat.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    m.mkdir.mockResolvedValue(undefined);
    m.readdir.mockResolvedValue([]);
    m.writeFile.mockResolvedValue(undefined);
    m.unlink.mockResolvedValue(undefined);
    m.readFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    m.safeFetch.mockImplementation((input: unknown, init?: unknown) =>
        (globalThis.fetch as unknown as (i: unknown, n?: unknown) => unknown)(input, init),
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("GET /api/proxy-image — refus du SVG actif", () => {
    it("refuse un SVG avec gestionnaire onload (415)", async () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>';
        vi.stubGlobal("fetch", fetchReturning(svg, "image/svg+xml", svg.length));

        const res = await GET(req("https://i.imgur.com/x.svg"));

        expect(res.status).toBe(415);
    });

    it("refuse un SVG présenté avec un Content-Type mensonger", async () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject /></svg>';
        vi.stubGlobal("fetch", fetchReturning(svg, "image/png", svg.length));

        const res = await GET(req("https://i.imgur.com/x.png"));

        expect(res.status).toBe(415);
    });

    it("sert une vraie image avec nosniff", async () => {
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
        vi.stubGlobal("fetch", fetchReturning(png, "image/png", png.length));

        const res = await GET(req("https://i.imgur.com/x.png"));

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/png");
        expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    });

    it("sert depuis le cache disque sans rappeler la source (chemin HIT, fs.promises)", async () => {
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        m.stat.mockResolvedValue({ size: png.length, mtimeMs: Date.now() });
        m.readFile.mockResolvedValue(png);

        const res = await GET(req("https://i.imgur.com/cached.png"));

        expect(res.status).toBe(200);
        expect(res.headers.get("x-cache")).toBe("HIT");
        expect(m.safeFetch).not.toHaveBeenCalled();
    });
});
