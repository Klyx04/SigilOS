import { describe, it, expect } from "vitest";
import {
    RAID_LIVE_DURATION_MS,
    defaultGigalodonObjectives,
    defaultObjectivesForRaid,
    liveScoreOf,
    liveAlertLevel,
    formatLiveRemaining,
    isValidObjective,
} from "@/lib/raid-live";

/** Lot 2 — session live : règles pures (chrono serveur, paliers, score). */
describe("lot 2 — session live (pur)", () => {
    it("durée = 60 min (chrono jeu)", () => {
        expect(RAID_LIVE_DURATION_MS).toBe(60 * 60 * 1000);
    });

    it("objectifs gigalodon fermés : 11 jalons, reliques chiffrées", () => {
        const list = defaultGigalodonObjectives();
        expect(list).toHaveLength(11);
        expect(list.map((o) => o.id)).toEqual([
            "farm-moins-1", "mureine", "luminarium", "execrabe", "statues",
            "raccourci", "depot-10k", "fragment-4", "willorque", "depot-final", "gigalodon",
        ]);
        const points = Object.fromEntries(list.map((o) => [o.id, o.points]));
        expect(points).toMatchObject({ mureine: 1000, execrabe: 5000, willorque: 10000, gigalodon: 15000 });
        expect(list.every((o) => !o.done)).toBe(true);
    });

    it("jardin : jalons dérivés des étapes, points jamais inventés", () => {
        const list = defaultObjectivesForRaid("jardin", ["Aile 1", "Aile 2"]);
        expect(list.map((o) => o.label)).toEqual(["Aile 1", "Aile 2"]);
        expect(list.every((o) => o.points === 0)).toBe(true);
    });

    it("score théorique = somme des cochés", () => {
        const list = defaultGigalodonObjectives();
        expect(liveScoreOf(list)).toBe(0);
        list[1].done = true; // mureine
        list[3].done = true; // execrabe
        expect(liveScoreOf(list)).toBe(6000);
    });

    it("paliers d'alerte : 15/30 ambre, 45 rouge, 60 fin", () => {
        const t0 = 1_000_000;
        expect(liveAlertLevel(t0, t0)).toBe("ok");
        expect(liveAlertLevel(t0, t0 + 14 * 60 * 1000)).toBe("ok");
        expect(liveAlertLevel(t0, t0 + 15 * 60 * 1000)).toBe("warn15");
        expect(liveAlertLevel(t0, t0 + 30 * 60 * 1000)).toBe("warn30");
        expect(liveAlertLevel(t0, t0 + 45 * 60 * 1000)).toBe("alert45");
        expect(liveAlertLevel(t0, t0 + 59 * 60 * 1000)).toBe("alert45");
        expect(liveAlertLevel(t0, t0 + 60 * 60 * 1000)).toBe("ended");
        expect(liveAlertLevel(t0, t0 + 90 * 60 * 1000)).toBe("ended");
    });

    it("format mm:ss, jamais négatif", () => {
        expect(formatLiveRemaining(t0plus(60 * 60 * 1000), 1_000_000)).toBe("60:00");
        function t0plus(ms: number) { return 1_000_000 + ms; }
        expect(formatLiveRemaining(1_000_000 + 5 * 1000, 1_000_000)).toBe("00:05");
        expect(formatLiveRemaining(1_000_000 - 10_000, 1_000_000)).toBe("00:00");
    });

    it("garde d'objectif : fail-closed", () => {
        expect(isValidObjective({ id: "mureine", label: "x", points: 1000, done: false })).toBe(true);
        expect(isValidObjective(null)).toBe(false);
        expect(isValidObjective({ id: "", label: "x", points: 1, done: false })).toBe(false);
        expect(isValidObjective({ id: "x", label: "y", points: NaN, done: false })).toBe(false);
        expect(isValidObjective({ id: "x", label: "y", points: 1, done: "oui" })).toBe(false);
        expect(isValidObjective({ id: "x".repeat(65), label: "y", points: 1, done: false })).toBe(false);
    });
});
