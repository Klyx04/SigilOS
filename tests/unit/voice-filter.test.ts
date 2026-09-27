/**
 * Filtre vocal des rappels manuels (`@/lib/voice-filter`) — demande user du
 * 28/09/2026 : « pinger uniquement les gens pas dans le vocal ».
 *
 * Règle « suivre le capitaine » verrouillée ici : capitaine en vocal dans V →
 * présents = avec lui dans V ; sinon présents = dans n'importe quel vocal.
 */

import { describe, it, expect } from "vitest";
import { splitVoiceAbsent } from "@/lib/voice-filter";

describe("splitVoiceAbsent — suivre le capitaine", () => {
    it("pinge ceux qui ne sont pas avec le capitaine dans son salon", () => {
        const states = new Map([
            ["captain", "V1"],
            ["p1", "V1"],
            ["p2", "V2"],
        ]);
        const split = splitVoiceAbsent(["p1", "p2", "p3"], states, "captain");
        expect(split.captainChannelId).toBe("V1");
        expect(split.present).toEqual(["p1"]);
        expect(split.absent).toEqual(["p2", "p3"]);
    });

    it("sans capitaine en vocal : présent = dans n'importe quel vocal", () => {
        const states = new Map([
            ["p1", "V1"],
            ["p2", "V2"],
        ]);
        const split = splitVoiceAbsent(["p1", "p2", "p3"], states, "captain-offline");
        expect(split.captainChannelId).toBeNull();
        expect(split.present).toEqual(["p1", "p2"]);
        expect(split.absent).toEqual(["p3"]);
    });

    it("fail-open : état vocal inconnu → tout le monde à pinger", () => {
        const split = splitVoiceAbsent(["p1", "p2"], new Map(), "captain");
        expect(split.present).toEqual([]);
        expect(split.absent).toEqual(["p1", "p2"]);
    });

    it("déduplique les inscrits et ignore les valeurs vides", () => {
        const split = splitVoiceAbsent(["p1", "p1", null, undefined, ""], new Map(), null);
        expect(split.absent).toEqual(["p1"]);
    });
});
