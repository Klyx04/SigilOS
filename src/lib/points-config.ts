/**
 * Points de contribution personnalisables (par guilde, admin).
 * Module PUR — PAS de directive "use server" : ces helpers sont importés par
 * des Server Actions (un fichier "use server" ne peut exporter que des fonctions
 * async). Stockage : GuildConfig.pointsConfig (JSON). Défauts alignés sur
 * l'ancien comportement.
 */
export type GuildPointsConfig = {
    djQuest: number;
    djLvl1_99: number;
    djLvl100_149: number;
    djLvl150_199: number;
    djLvl200Plus: number;
    songesReve: number;
    songesParadoxe: number;
    songesCauchemar: number;
};

export const DEFAULT_POINTS_CONFIG: GuildPointsConfig = {
    djQuest: 1,
    djLvl1_99: 1,
    djLvl100_149: 2,
    djLvl150_199: 3,
    djLvl200Plus: 4,
    songesReve: 1,
    songesParadoxe: 2,
    songesCauchemar: 3,
};

/** Fusionne une config brute (DB) avec les défauts — bornée et fail-safe. */
export function mergePointsConfig(raw: unknown): GuildPointsConfig {
    const base: GuildPointsConfig = { ...DEFAULT_POINTS_CONFIG };
    if (!raw || typeof raw !== "object") return base;
    const r = raw as Partial<GuildPointsConfig>;
    (Object.keys(base) as (keyof GuildPointsConfig)[]).forEach((k) => {
        const v = r[k];
        if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) base[k] = Math.round(v);
    });
    return base;
}

/** Points DJ / quêtes (par niveau de donjon), config admin. */
export function resolveDjContributionPoints(
    dungeonLevel: number | null | undefined,
    cfg?: unknown
): number {
    const c = mergePointsConfig(cfg);
    if (!dungeonLevel) return c.djQuest;
    if (dungeonLevel >= 200) return c.djLvl200Plus;
    if (dungeonLevel >= 150) return c.djLvl150_199;
    if (dungeonLevel >= 100) return c.djLvl100_149;
    return c.djLvl1_99;
}

/** Points Songes (par difficulté), config admin. */
export function resolveSongesContributionPoints(
    difficulty: string,
    cfg?: unknown
): number {
    const c = mergePointsConfig(cfg);
    if (difficulty.startsWith("CAUCHEMAR")) return c.songesCauchemar;
    if (difficulty.startsWith("PARADOXE")) return c.songesParadoxe;
    return c.songesReve;
}
