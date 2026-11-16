/**
 * Flux live de la télémétrie — garde de source.
 *
 * L'action sépare le direct de l'agrégat : elle ne doit lire qu'une page bornée
 * (`limit + 1`), filtrer par la règle pure de surface et ne jamais renvoyer une
 * empreinte (`sanitizeTelemetryDetails`). Le filtre guilde est résolu côté serveur.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ACTIONS = "src/server/actions/telemetry-actions.ts";

describe("getTelemetryLiveEvents — garde de source", () => {
    const source = readFileSync(ACTIONS, "utf8");

    it("reste super-admin et borné par Zod (limit ≤ 200)", () => {
        expect(source).toContain("export async function getTelemetryLiveEvents");
        expect(source).toContain("isSuperAdmin");
        expect(source).toMatch(/limit:\s*z\.number\(\)\.int\(\)\.min\(1\)\.max\(200\)/);
    });

    it("résout la guilde par la règle pure et pagine par cursor", () => {
        expect(source).toContain("resolveTelemetryGuildScope");
        expect(source).toContain("buildTelemetrySurfaceWhere");
        expect(source).toContain("classifyTelemetrySurface");
        expect(source).toContain("take: limit + 1");
        expect(source).toContain("cursor: { id: cursor }");
        expect(source).toContain("nextCursor");
    });

    it("ne renvoie jamais une empreinte au client", () => {
        expect(source).toContain("sanitizeTelemetryDetails");
        expect(source).not.toContain("userAgent:");
    });
});
