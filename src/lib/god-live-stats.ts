/**
 * Cartes « temps réel » du tableau de bord God — **une seule** forme de données.
 *
 * Le rendu serveur (`LiveStatsServer`) et le flux SSE (`/api/god/stats/stream`) doivent
 * porter **exactement** les mêmes champs : le client remplace son état par la trame
 * reçue (`setStats(newStats)`). Un champ absent côté flux était donc **effacé** après
 * 5 s (« Actifs (7j) » retombait à 0, « Engagement » à `NaN`), ce qui était le cas de
 * `weeklyActiveUsers`, `retentionRate` et `density` (constat du 22/10/2026).
 *
 * La règle vit ici, en pur, pour que l'ajout d'une carte oblige à mettre à jour **les
 * deux** chemins (verrou : `tests/unit/god-live-stats.test.ts`).
 */

/** Champs consommés par `LiveStats` — l'ordre n'a pas d'importance, la présence si. */
export const GOD_LIVE_STAT_KEYS = [
    "guilds",
    "guildsTrend",
    "activeGuilds",
    "users",
    "usersTrend",
    "profiles",
    "activeProfiles",
    "missions",
    "missionsTrend",
    "weeklyActiveUsers",
    "retentionRate",
    "density",
] as const;

export type GodLiveStats = {
    guilds: number;
    guildsTrend: number;
    activeGuilds: number;
    users: number;
    usersTrend: number;
    profiles: number;
    activeProfiles: number;
    missions: number;
    missionsTrend: number;
    weeklyActiveUsers: number;
    retentionRate: number;
    density: number;
};

/**
 * Sous-ensemble de `getPlatformStats()` réellement utilisé par les cartes. Les
 * tendances sont optionnelles côté source (elles dépendent d'un historique) : on
 * les normalise à `0` ici, jamais à `NaN`.
 */
export type PlatformStatsSource = {
    allowedGuilds: number;
    activeGuilds: number;
    totalUsers: number;
    totalProfiles: number;
    activeProfiles: number;
    totalMissions: number;
    guildsTrend?: number | null;
    usersTrend?: number | null;
    missionsTrend?: number | null;
    weeklyActiveUsers?: number | null;
    retentionRate?: number | null;
    density?: number | null;
};

function toNumber(value: number | null | undefined): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function toGodLiveStats(stats: PlatformStatsSource): GodLiveStats {
    return {
        guilds: toNumber(stats.allowedGuilds),
        guildsTrend: toNumber(stats.guildsTrend),
        activeGuilds: toNumber(stats.activeGuilds),
        users: toNumber(stats.totalUsers),
        usersTrend: toNumber(stats.usersTrend),
        profiles: toNumber(stats.totalProfiles),
        activeProfiles: toNumber(stats.activeProfiles),
        missions: toNumber(stats.totalMissions),
        missionsTrend: toNumber(stats.missionsTrend),
        weeklyActiveUsers: toNumber(stats.weeklyActiveUsers),
        retentionRate: toNumber(stats.retentionRate),
        density: toNumber(stats.density),
    };
}
