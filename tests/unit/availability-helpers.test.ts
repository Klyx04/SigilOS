import { describe, it, expect } from "vitest";
import { countAvailabilitySlots, hasFilledAvailability } from "@/lib/dofus-assets";

describe("countAvailabilitySlots / hasFilledAvailability (module Disponibilités)", () => {
    it("retourne 0 / false pour null, undefined ou objet vide", () => {
        expect(countAvailabilitySlots(null)).toBe(0);
        expect(countAvailabilitySlots(undefined)).toBe(0);
        expect(countAvailabilitySlots({})).toBe(0);
        expect(hasFilledAvailability(null)).toBe(false);
        expect(hasFilledAvailability({})).toBe(false);
    });

    it("compte les créneaux du format legacy (AvailabilityMap directe)", () => {
        const legacy = { lundi: ["matin", "soir"], mardi: ["nuit"] } as any;
        expect(countAvailabilitySlots(legacy)).toBe(3);
        expect(hasFilledAvailability(legacy)).toBe(true);
    });

    it("compte les créneaux du format GlobalAvailability (template)", () => {
        const ga = { template: { samedi: ["matin", "midi", "soir"] } } as any;
        expect(countAvailabilitySlots(ga)).toBe(3);
        expect(hasFilledAvailability(ga)).toBe(true);
    });

    it("privilégie `template` quand le format GlobalAvailability est présent", () => {
        const ga = {
            template: { lundi: ["matin"] },
            weeks: { "2026-W33": { dimanche: ["soir"] } },
        } as any;
        expect(countAvailabilitySlots(ga)).toBe(1);
    });

    it("tolère les entrées non-tableaux sans planter (fail-closed → 0)", () => {
        const weird = { lundi: "matin" as any, mardi: null as any, mercredi: undefined } as any;
        expect(countAvailabilitySlots(weird)).toBe(0);
        expect(hasFilledAvailability(weird)).toBe(false);
    });
});
