import { describe, expect, it } from "vitest";

import { buildTravelCommand, buildZaapTravelCommand } from "@/lib/travel-command";

describe("travel-command — /travel et /zaap (client 3.7)", () => {
    it("construit /travel x,y", () => {
        expect(buildTravelCommand({ x: 13, y: 21 })).toBe("/travel 13,21");
        expect(buildTravelCommand({ x: -70, y: -69 })).toBe("/travel -70,-69");
    });

    it("refuse les positions non entières (jamais inventées)", () => {
        expect(buildTravelCommand(null)).toBeNull();
        expect(buildTravelCommand(undefined)).toBeNull();
        expect(buildTravelCommand({ x: NaN, y: 1 })).toBeNull();
        expect(buildTravelCommand({ x: 1.5, y: 2 })).toBeNull();
        expect(buildTravelCommand({ x: 1, y: Number.POSITIVE_INFINITY })).toBeNull();
    });

    it("construit /zaap x,y ; /travel x,y quand même monde", () => {
        expect(
            buildZaapTravelCommand({ x: 10, y: 22, sameWorld: true }, { x: 13, y: 21 }),
        ).toBe("/zaap 10,22 ; /travel 13,21");
    });

    it("refuse le détour zaap entre mondes (commande inopérante en jeu)", () => {
        expect(
            buildZaapTravelCommand({ x: 10, y: 22, sameWorld: false }, { x: 13, y: 21 }),
        ).toBeNull();
    });

    it("refuse le détour zaap sans zaap ou sans position", () => {
        expect(buildZaapTravelCommand(null, { x: 13, y: 21 })).toBeNull();
        expect(buildZaapTravelCommand(undefined, { x: 13, y: 21 })).toBeNull();
        expect(buildZaapTravelCommand({ x: 10, y: 22 }, null)).toBeNull();
        expect(buildZaapTravelCommand({ x: NaN, y: 22 }, { x: 13, y: 21 })).toBeNull();
    });
});
