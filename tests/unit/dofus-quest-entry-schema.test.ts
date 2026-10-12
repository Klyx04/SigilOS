import { describe, expect, it } from "vitest";
import { z } from "zod";

import { questPositionSchema } from "@/lib/travel-command";

const EntryPositionsSchema = z.object({
    positions: z.array(questPositionSchema).optional().default([]),
});

describe("quest-positions — GPS + zaap manuel (lot 1)", () => {
    it("accepte une position travel seule", () => {
        const parsed = EntryPositionsSchema.parse({ positions: [{ x: -22, y: -24 }] });
        expect(parsed.positions).toEqual([{ x: -22, y: -24 }]);
    });

    it("persiste le détour zaap manuel {x, y} (plus de strip Zod)", () => {
        const parsed = EntryPositionsSchema.parse({
            positions: [{ x: -22, y: -24, zaap: { x: -20, y: -20 } }],
        });
        expect(parsed.positions).toEqual([{ x: -22, y: -24, zaap: { x: -20, y: -20 } }]);
    });

    it("garde la compatibilité du flag auto historique (zaap: true)", () => {
        const parsed = EntryPositionsSchema.parse({
            positions: [{ x: -22, y: -24, zaap: true }],
        });
        expect(parsed.positions).toEqual([{ x: -22, y: -24, zaap: true }]);
    });
});
