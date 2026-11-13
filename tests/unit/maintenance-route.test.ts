import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AUD-11 (audit 13/11/2026) — `/api/health/maintenance` est public et appelé par
 * le proxy. Il doit mettre en cache (5 s) et limiter par IP, sans transformer une
 * panne BDD en blocage global.
 */
const m = vi.hoisted(() => ({
    findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    db: { platformConfig: { findUnique: m.findUnique } },
}));
vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function req(ip = "203.0.113.9") {
    return { headers: new Headers({ "x-real-ip": ip }) } as any;
}

describe("GET /api/health/maintenance — cache et rate-limit", () => {
    let GET: typeof import("@/app/api/health/maintenance/route").GET;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        m.findUnique.mockResolvedValue({ maintenanceMode: true });
        ({ GET } = await import("@/app/api/health/maintenance/route"));
    });

    it("met en cache 5 s : deux appels = une seule lecture BDD", async () => {
        const first = await GET(req());
        const second = await GET(req());

        expect(await first.json()).toEqual({ maintenanceMode: true });
        expect(await second.json()).toEqual({ maintenanceMode: true });
        expect(m.findUnique).toHaveBeenCalledTimes(1);
    });

    it("renvoie 429 au-delà de 120 requêtes par minute et par IP", async () => {
        let last: Response | undefined;
        for (let i = 0; i < 121; i++) {
            last = await GET(req());
        }
        expect(last?.status).toBe(429);
    });

    it("reste fail-open si la base est indisponible", async () => {
        m.findUnique.mockRejectedValue(new Error("db down"));

        const res = await GET(req());

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ maintenanceMode: false });
    });
});
