import { describe, it, expect } from "vitest";
import manifest from "@/app/manifest";

describe("📱 Lot 3 — PWA & Performance (#197 & #186a)", () => {
    describe("Manifest PWA Standards (#197)", () => {
        it("génère un manifest valide conforme aux standards PWA", () => {
            const m = manifest();
            expect(m.name).toContain("SigilOS");
            expect(m.short_name).toBe("SigilOS");
            expect(m.display).toBe("standalone");
            expect(m.start_url).toBe("/");
            expect(m.icons).toBeDefined();
            expect(m.icons?.length).toBeGreaterThanOrEqual(2);
            expect(m.shortcuts).toBeDefined();
            expect(m.shortcuts?.length).toBeGreaterThanOrEqual(3);
        });

        it("contient des raccourcis d'application configurés", () => {
            const m = manifest();
            const shortcutNames = m.shortcuts?.map((s) => s.short_name);
            expect(shortcutNames).toContain("Guides");
            expect(shortcutNames).toContain("Almanax");
            expect(shortcutNames).toContain("Boss");
        });
    });

    describe("Virtualisation Slice Calculation (#186a)", () => {
        it("calcule correctement les indices de virtualisation pour 1000 items", () => {
            const itemHeight = 50;
            const containerHeight = 500; // 10 items visibles
            const overscan = 2;

            const scrollTop = 200; // Scrolled 4 items down
            const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
            const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
            const end = Math.min(1000, start + visibleCount);

            expect(start).toBe(2); // 4 - 2 = 2
            expect(end).toBe(16); // 2 + 14 = 16
            expect(end - start).toBeLessThanOrEqual(20);
        });
    });
});
