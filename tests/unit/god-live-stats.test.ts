/**
 * Cartes « temps réel » du tableau de bord God.
 *
 * Le client (`LiveStats`) **remplace** son état par chaque trame SSE : la forme du
 * rendu serveur et celle du flux doivent donc être identiques. Ces tests verrouillent
 * le défaut mesuré le 22/10/2026 — la trame ne portait que 9 champs sur 12, ce qui
 * remettait « Actifs (7j) » à 0 et « Engagement » à `NaN` après 5 secondes.
 */

import { describe, it, expect } from "vitest";
import { toGodLiveStats, GOD_LIVE_STAT_KEYS } from "@/lib/god-live-stats";

const source = {
    allowedGuilds: 12,
    activeGuilds: 9,
    totalUsers: 480,
    totalProfiles: 512,
    activeProfiles: 300,
    totalMissions: 77,
    guildsTrend: 2,
    usersTrend: -1,
    missionsTrend: 5,
    weeklyActiveUsers: 140,
    retentionRate: 58,
    density: 41,
};

describe("toGodLiveStats", () => {
    it("porte exactement les champs consommés par les cartes", () => {
        expect(Object.keys(toGodLiveStats(source)).sort()).toEqual([...GOD_LIVE_STAT_KEYS].sort());
    });

    it("renomme les compteurs de la source sans les perdre", () => {
        const stats = toGodLiveStats(source);
        expect(stats).toMatchObject({
            guilds: 12,
            activeGuilds: 9,
            users: 480,
            profiles: 512,
            activeProfiles: 300,
            missions: 77,
        });
    });

    it("normalise une tendance absente à 0 (jamais NaN)", () => {
        const stats = toGodLiveStats({ ...source, guildsTrend: null, usersTrend: undefined, missionsTrend: null });
        expect(stats.guildsTrend).toBe(0);
        expect(stats.usersTrend).toBe(0);
        expect(stats.missionsTrend).toBe(0);
    });

    it("normalise les mesures optionnelles absentes à 0 (jamais NaN)", () => {
        const stats = toGodLiveStats({ ...source, weeklyActiveUsers: null, retentionRate: undefined, density: null });
        expect(stats.weeklyActiveUsers).toBe(0);
        expect(stats.retentionRate).toBe(0);
        expect(stats.density).toBe(0);
    });

    it("rejette les valeurs non finies plutôt que de propager NaN", () => {
        const stats = toGodLiveStats({ ...source, activeProfiles: Number.NaN, density: Number.POSITIVE_INFINITY });
        expect(stats.activeProfiles).toBe(0);
        expect(stats.density).toBe(0);
    });

    it("garde une mesure réelle à 0 (0 n'est pas une absence)", () => {
        const stats = toGodLiveStats({ ...source, retentionRate: 0 });
        expect(stats.retentionRate).toBe(0);
        expect(stats.weeklyActiveUsers).toBe(140);
    });
});
