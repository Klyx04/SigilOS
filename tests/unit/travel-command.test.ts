import { describe, expect, it } from "vitest";

import { buildTravelCommand, buildManualZaapTravelCommand, buildZaapTravelCommand, parseGameCoord } from "@/lib/travel-command";

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

    it("parse les champs X / Y dissociés du God (anti miss-clic)", () => {
        expect(parseGameCoord(" -22 ")).toBe(-22);
        expect(parseGameCoord("-20")).toBe(-20);
        expect(parseGameCoord(10)).toBe(10);
        expect(parseGameCoord("")).toBeNull();
        expect(parseGameCoord("10.5")).toBeNull();
        expect(parseGameCoord("abc")).toBeNull();
        expect(parseGameCoord(null)).toBeNull();
        expect(parseGameCoord(NaN)).toBeNull();
    });

    it("construit la combinée manuelle /zaap zx,zy ; /travel x,y (saisie God)", () => {
        expect(buildManualZaapTravelCommand(-20, -20, -22, -24)).toBe("/zaap -20,-20 ; /travel -22,-24");
        expect(buildManualZaapTravelCommand("-20", "-20", "-22", "-24")).toBe("/zaap -20,-20 ; /travel -22,-24");
    });

    it("refuse la combinée manuelle incomplète (jamais inventée)", () => {
        expect(buildManualZaapTravelCommand(null, -20, -22, -24)).toBeNull();
        expect(buildManualZaapTravelCommand(-20, null, -22, -24)).toBeNull();
        expect(buildManualZaapTravelCommand(-20, -20, null, -24)).toBeNull();
        expect(buildManualZaapTravelCommand("", "", "", "")).toBeNull();
        expect(buildManualZaapTravelCommand(1.5, -20, -22, -24)).toBeNull();
    });
});
