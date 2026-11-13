import { describe, it, expect } from "vitest";
import {
    normalizeStatCode,
    calculateItemStatTotals,
    applyVariantsToBuild,
    VARIANT_SLOTS,
} from "@/lib/dofus-variant-utils";
import type { DofusbookPreviewData, DofusbookItem } from "@/lib/dofusbook-utils";

describe("dofus-variant-utils", () => {
    it("normalizes characteristic and effect IDs correctly", () => {
        expect(normalizeStatCode(1)).toBe("pa");
        expect(normalizeStatCode(23)).toBe("pm");
        expect(normalizeStatCode(19)).toBe("po");
        expect(normalizeStatCode(11)).toBe("vi");
        expect(normalizeStatCode(10)).toBe("fo");
        expect(normalizeStatCode(15)).toBe("in");
        expect(normalizeStatCode(13)).toBe("ch");
        expect(normalizeStatCode(14)).toBe("ag");
        expect(normalizeStatCode("Vitalité")).toBe("vi");
        expect(normalizeStatCode("Force")).toBe("fo");
        expect(normalizeStatCode("Do Terre")).toBe("dtf");
        expect(normalizeStatCode("rnp")).toBe("rnp");
    });

    it("calculates item stat totals properly", () => {
        const item: DofusbookItem = {
            id: 100,
            name: "Bottes de Test",
            picture: 100,
            official: 100,
            effects: [
                { code: "vi", min: 100, max: 150, value: 150 },
                { code: "fo", min: 50, max: 50, value: 50 },
                { code: "pm", min: 1, max: 1, value: 1 },
            ],
        };

        const totals = calculateItemStatTotals(item);
        expect(totals.vi).toBe(150);
        expect(totals.fo).toBe(50);
        expect(totals.pm).toBe(1);
    });

    it("applies variant replacement and recalculates build stats without mutating original", () => {
        const originalItem: DofusbookItem = {
            id: 1,
            name: "Bottes Originales",
            picture: 1,
            official: 1,
            effects: [
                { code: "vi", min: 100, max: 100, value: 100 },
                { code: "fo", min: 40, max: 40, value: 40 },
                { code: "pm", min: 1, max: 1, value: 1 },
            ],
        };

        const baseBuild: DofusbookPreviewData = {
            v: 2,
            id: 12345,
            name: "Mon Build",
            level: 200,
            className: "Iop",
            classId: 8,
            stats: {
                pa: 11,
                pm: 6,
                po: 4,
                vit: 4000,
                ini: 1500,
                pp: 100,
                cc: 25,
                invo: 2,
                so: 0,
            },
            elements: {
                fo: 800,
                in: 0,
                ch: 0,
                ag: 0,
                sa: 200,
                pu: 100,
            },
            resists: {
                neutre: 10,
                terre: 15,
                feu: 10,
                eau: 10,
                air: 10,
            },
            damages: {
                neutre: 20,
                terre: 80,
                feu: 0,
                eau: 0,
                air: 0,
                general: 0,
                critique: 30,
                poussee: 0,
                armes: 0,
                sorts: 0,
                melee: 0,
                distance: 0,
            },
            items: {
                bo: originalItem,
            },
        };

        const variantBoot: DofusbookItem = {
            id: 2,
            name: "Sandales du Minotot",
            picture: 2,
            official: 2,
            effects: [
                { code: "vi", min: 200, max: 200, value: 200 }, // +100 vi
                { code: "fo", min: 0, max: 0, value: 0 },       // -40 fo
                { code: "in", min: 50, max: 50, value: 50 },     // +50 in
                { code: "pm", min: 1, max: 1, value: 1 },       // 0 change
                { code: "po", min: 1, max: 1, value: 1 },       // +1 po
            ],
        };

        const updated = applyVariantsToBuild(baseBuild, { bo: variantBoot });
        expect(updated).not.toBeNull();
        // Original remains untouched
        expect(baseBuild.items?.bo?.name).toBe("Bottes Originales");
        expect(baseBuild.stats.vit).toBe(4000);
        expect(baseBuild.elements.fo).toBe(800);

        // Updated build has recalculated values
        expect(updated?.items?.bo?.name).toBe("Sandales du Minotot");
        expect(updated?.stats.vit).toBe(4100); // 4000 - 100 + 200
        expect(updated?.elements.fo).toBe(760); // 800 - 40 + 0
        expect(updated?.elements.in).toBe(50);  // 0 + 50
        expect(updated?.stats.pm).toBe(6);     // unchanged
        expect(updated?.stats.po).toBe(5);     // 4 + 1
    });

    it("has complete slot configuration for all equipment pieces", () => {
        expect(VARIANT_SLOTS.bo.slotName).toBe("Bottes");
        expect(VARIANT_SLOTS.ch.slotName).toBe("Coiffe");
        expect(VARIANT_SLOTS.d1.slotName).toBe("Dofus / Trophée");
        expect(VARIANT_SLOTS.br.slotName).toBe("Bouclier");
    });
});
