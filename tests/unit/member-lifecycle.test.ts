import { describe, it, expect } from "vitest";
import { differenceInDays } from "date-fns";

describe("Member Lifecycle Calculations", () => {
    it("correctly calculates seniority in days", () => {
        const now = new Date("2026-09-01T00:00:00Z");
        const joinDate = new Date("2024-10-07T00:00:00Z");
        const days = differenceInDays(now, joinDate);
        expect(days).toBeGreaterThan(600);
    });

    it("correctly computes remaining trial days", () => {
        const now = new Date("2026-09-01T00:00:00Z");
        const trialEnd = new Date("2026-09-15T00:00:00Z");
        const remaining = differenceInDays(trialEnd, now);
        expect(remaining).toBe(14);
    });

    it("aggregates mules count accurately from profile alts", () => {
        const mockMembers = [
            { id: "1", displayName: "Wylan", mules: [{ pseudo: "Wylou" }, { pseudo: "Weyd" }, { pseudo: "Cubi-Devomi" }] },
            { id: "2", displayName: "Chaudsept", mules: [{ pseudo: "Chaud-Set" }, { pseudo: "Chaudson-ge" }] },
            { id: "3", displayName: "Bigben-Fr", mules: [{ pseudo: "Jaichiedansmon-Ben" }] },
            { id: "4", displayName: "SoloPlayer", mules: [] },
        ];

        const totalMules = mockMembers.reduce((acc, m) => acc + m.mules.length, 0);
        expect(totalMules).toBe(6);

        const maxGuildMules = 35;
        const availablePlaces = maxGuildMules - totalMules;
        expect(availablePlaces).toBe(29);
    });

    it("ranks recruiters properly by total recruits and calculates retention", () => {
        const mockRecruiterData = [
            { recruiterId: "1", recruiterName: "Wylan", total: 70, active: 65, confirmed: 60 },
            { recruiterId: "2", recruiterName: "Obvious", total: 26, active: 22, confirmed: 20 },
            { recruiterId: "3", recruiterName: "Chaud-Sept", total: 8, active: 7, confirmed: 7 },
        ];

        const leaderboard = mockRecruiterData
            .map(r => ({
                ...r,
                retentionRate: Math.round((r.active / r.total) * 100),
            }))
            .sort((a, b) => b.total - a.total);

        expect(leaderboard[0].recruiterName).toBe("Wylan");
        expect(leaderboard[0].total).toBe(70);
        expect(leaderboard[0].retentionRate).toBe(93);
        expect(leaderboard[1].recruiterName).toBe("Obvious");
    });
});
