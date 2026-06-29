
export interface TierStep {
    xp: number;
    label: string;
    description: string;
}

export const GUILD_TIERS = {
    1: {
        id: 1,
        xpMax: 25000,
        membersRecommended: 10,
        guildXp: 52,
        guildKamas: 50,
        steps: [
            { xp: 5000, label: "Jalon 1", description: "Départ" },
            { xp: 10000, label: "Jalon 2", description: "Avancée" },
            { xp: 16000, label: "Jalon 3", description: "Maîtrise" },
            { xp: 25000, label: "Validé", description: "Complété" }
        ]
    },
    2: {
        id: 2,
        xpMax: 75000,
        membersRecommended: 30,
        guildXp: 64,
        guildKamas: 150,
        steps: [
            { xp: 25000, label: "Jalon 1", description: "Départ" },
            { xp: 38000, label: "Jalon 2", description: "Avancée" },
            { xp: 54000, label: "Jalon 3", description: "Maîtrise" },
            { xp: 75000, label: "Validé", description: "Complété" }
        ]
    },
    3: {
        id: 3,
        xpMax: 150000,
        membersRecommended: 50,
        guildXp: 76,
        guildKamas: 250,
        steps: [
            { xp: 75000, label: "Jalon 1", description: "Départ" },
            { xp: 95000, label: "Jalon 2", description: "Avancée" },
            { xp: 120000, label: "Jalon 3", description: "Maîtrise" },
            { xp: 150000, label: "Validé", description: "Complété" }
        ]
    },
    4: {
        id: 4,
        xpMax: 300000,
        membersRecommended: 100,
        guildXp: 88,
        guildKamas: 500,
        steps: [
            { xp: 150000, label: "Jalon 1", description: "Départ" },
            { xp: 190000, label: "Jalon 2", description: "Avancée" },
            { xp: 235000, label: "Jalon 3", description: "Maîtrise" },
            { xp: 300000, label: "Validé", description: "Complété" }
        ]
    },
    5: {
        id: 5,
        xpMax: 500000,
        membersRecommended: 150,
        guildXp: 100,
        guildKamas: 750,
        steps: [
            { xp: 300000, label: "Jalon 1", description: "Départ" },
            { xp: 350000, label: "Jalon 2", description: "Avancée" },
            { xp: 415000, label: "Jalon 3", description: "Maîtrise" },
            { xp: 500000, label: "Validé", description: "Complété" }
        ]
    },
} as const;

export const MISSION_RANKS = {
    1: { id: 1, label: "Rang 1", levels: "30 - 109" },
    2: { id: 2, label: "Rang 2", levels: "110 - 169" },
    3: { id: 3, label: "Rang 3", levels: "170 - 199" },
    4: { id: 4, label: "Rang 4", levels: "200" },
    5: { id: 5, label: "Rang 5", levels: "200+" },
} as const;

export type GuildTierId = keyof typeof GUILD_TIERS;
export type MissionRankId = keyof typeof MISSION_RANKS;

export function getTierInfo(tier: number) {
    return GUILD_TIERS[tier as GuildTierId] || GUILD_TIERS[1];
}

export function getRankInfo(rank: number) {
    return MISSION_RANKS[rank as MissionRankId] || MISSION_RANKS[1];
}

export function getRankFromLevel(level: number): MissionRankId {
    if (level >= 200) return 4;
    if (level >= 170) return 3;
    if (level >= 110) return 2;
    return 1;
}
