/**
 * God — vue d'ensemble allégée (lot C, 16/11/2026).
 *
 * Décision user : retirer « Indicateurs plateforme » et « Activité de la plateforme »
 * (lectures massives : tous les `User` + tous les `AuditLog` 30 j en mémoire) et le flux
 * SSE de 5 s (172 800 comptages par jour et par onglet). Restent la santé des services,
 * les annonces et la synchronisation.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const PAGE = "src/app/god/page.tsx";
const OVERVIEW = "src/app/god/components/overview-tabs.tsx";

describe("God — vue d'ensemble allégée", () => {
    const page = readFileSync(PAGE, "utf8");
    const overview = readFileSync(OVERVIEW, "utf8");

    it("ne rend plus les KPI, le graphe d'activité ni leurs actions", () => {
        for (const forbidden of [
            "LiveStats",
            "ActivityChart",
            "getPlatformStats",
            "getPlatformActivityStats",
            "toGodLiveStats",
        ]) {
            expect(page, `page.tsx contient encore ${forbidden}`).not.toContain(forbidden);
            expect(overview, `overview-tabs.tsx contient encore ${forbidden}`).not.toContain(forbidden);
        }
    });

    it("ne déclare plus que deux sections (communication + worker)", () => {
        expect(overview).toContain("interface OverviewTabsProps");
        expect(overview).toContain("communication: React.ReactNode");
        expect(overview).toContain("worker: React.ReactNode");
        expect(overview).not.toContain("stats: React.ReactNode");
        expect(overview).not.toContain("chart: React.ReactNode");
        expect(page).toContain("<OverviewTabs");
        expect(page).toContain("communication={");
        expect(page).toContain("worker={");
    });

    it("le flux SSE et ses fichiers n'existent plus", () => {
        expect(existsSync("src/app/api/god/stats/stream/route.ts")).toBe(false);
        expect(existsSync("src/lib/god-live-stats.ts")).toBe(false);
        expect(existsSync("src/app/god/components/live-stats.tsx")).toBe(false);
        expect(existsSync("src/app/god/activity-chart.tsx")).toBe(false);
        expect(existsSync("tests/unit/god-live-stats.test.ts")).toBe(false);
    });

    it("la santé reste montée et le bandeau est compact", () => {
        expect(overview).toContain("SystemHealthDashboard");
        expect(page).toContain("Pilotage");
        expect(page).toContain("Dernière lecture");
        expect(page).not.toContain("Command Center");
        expect(page).not.toContain("Central Operations");
    });
});
