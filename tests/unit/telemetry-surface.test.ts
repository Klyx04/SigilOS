/**
 * Surface d'un événement de télémétrie — Admin / Membre / God / Public.
 *
 * L'écran God doit dire **qui va où**, surtout côté admin. La classification est
 * une règle pure ; le filtre serveur en est la traduction SQL (segments de chemin).
 */

import { describe, it, expect } from "vitest";
import {
    buildTelemetrySurfaceWhere,
    classifyTelemetrySurface,
} from "@/lib/telemetry/surface";

describe("classifyTelemetrySurface", () => {
    it("classe les pages admin d'une guilde", () => {
        expect(classifyTelemetrySurface("/dashboard/abc/admin")).toBe("ADMIN");
        expect(classifyTelemetrySurface("/dashboard/abc/admin/logs")).toBe("ADMIN");
        expect(classifyTelemetrySurface("/dashboard/abc/admin?tab=x")).toBe("ADMIN");
    });

    it("classe les pages membre d'une guilde", () => {
        expect(classifyTelemetrySurface("/dashboard/abc")).toBe("MEMBER");
        expect(classifyTelemetrySurface("/dashboard/abc/missions")).toBe("MEMBER");
        // Un chemin qui commence par « admin » sans être le segment /admin reste membre.
        expect(classifyTelemetrySurface("/dashboard/abc/administrateur")).toBe("MEMBER");
    });

    it("classe le panneau God", () => {
        expect(classifyTelemetrySurface("/god")).toBe("GOD");
        expect(classifyTelemetrySurface("/god?tab=telemetry")).toBe("GOD");
        expect(classifyTelemetrySurface("/god/logs")).toBe("GOD");
    });

    it("classe le reste en public (y compris null)", () => {
        expect(classifyTelemetrySurface("/")).toBe("PUBLIC");
        expect(classifyTelemetrySurface("/visiteurs/x")).toBe("PUBLIC");
        expect(classifyTelemetrySurface(null)).toBe("PUBLIC");
    });
});

describe("buildTelemetrySurfaceWhere", () => {
    it("borne les pages admin au dashboard et au segment /admin", () => {
        expect(buildTelemetrySurfaceWhere("ADMIN")).toEqual({
            AND: [
                { path: { startsWith: "/dashboard/" } },
                { OR: [{ path: { endsWith: "/admin" } }, { path: { contains: "/admin/" } }] },
            ],
        });
    });

    it("exclut les pages admin du périmètre membre", () => {
        expect(buildTelemetrySurfaceWhere("MEMBER")).toEqual({
            AND: [
                { path: { startsWith: "/dashboard/" } },
                { NOT: { OR: [{ path: { endsWith: "/admin" } }, { path: { contains: "/admin/" } }] } },
            ],
        });
    });

    it("isole le panneau God", () => {
        expect(buildTelemetrySurfaceWhere("GOD")).toEqual({ path: { startsWith: "/god" } });
    });

    it("le public exclut le dashboard et le God", () => {
        expect(buildTelemetrySurfaceWhere("PUBLIC")).toEqual({
            NOT: [
                { path: { startsWith: "/dashboard/" } },
                { path: { startsWith: "/god" } },
            ],
        });
    });
});
