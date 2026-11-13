import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * AUD-05 (audit 13/11/2026) — le proxy d'images ne doit jamais servir un SVG
 * (contenu actif) depuis l'origine SigilOS. Un `<svg onload=…>` ne contient pas
 * `<script>` et passait l'ancien filtre.
 */
const m = vi.hoisted(() => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn(),
    writeFileSync: vi.fn(),
    lookup: vi.fn(),
}));

vi.mock("node:fs", () => {
    const api = {
        existsSync: m.existsSync,
        mkdirSync: m.mkdirSync,
        readdirSync: m.readdirSync,
        unlinkSync: m.unlinkSync,
        statSync: m.statSync,
        writeFileSync: m.writeFileSync,
    };
    return { default: api, ...api };
});
vi.mock("node:dns/promises", () => ({ lookup: m.lookup }));

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
    m.existsSync.mockReturnValue(false);
    m.mkdirSync.mockImplementation(() => undefined);
    m.readdirSync.mockReturnValue([]);
    m.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
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
});
