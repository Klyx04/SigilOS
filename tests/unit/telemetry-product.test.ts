import { describe, it, expect } from "vitest";
import {
    MIN_COHORT_SIZE,
    MIN_INACTIVITY_FLOOR_DAYS,
    MIN_RELIABLE_DISTINCT_ACTORS,
    buildRetentionCohorts,
    buildWeeklyActivity,
    classifyGuildFreshness,
    deriveFreshnessThresholds,
    deriveModuleAdoption,
    isSampleReliable,
    listWeekKeys,
    startOfIsoWeek,
    weekKey,
} from "@/lib/telemetry/product";

/**
 * Chantier D-2bis — règles **produit** de la télémétrie God.
 * Ce fichier verrouille la refonte : les mesures produit (adoption réelle, rétention, guildes à
 * relancer) ne doivent jamais publier un chiffre hors échantillon ni un seuil inventé.
 */

const DAY = 86400000;

describe("semaines ISO — une facture sans date n'est jamais rangée au hasard", () => {
    it("range une date au lundi de sa semaine", () => {
        // 2026-09-28 est un lundi : sa semaine commence ce jour-là.
        const monday = new Date(Date.UTC(2026, 8, 28));
        expect(startOfIsoWeek(monday).toISOString()).toBe("2026-09-28T00:00:00.000Z");
        // Le dimanche qui suit appartient à la même semaine ISO.
        const sunday = new Date(Date.UTC(2026, 9, 4));
        expect(startOfIsoWeek(sunday).toISOString()).toBe("2026-09-28T00:00:00.000Z");
    });

    it("applique la règle ISO de l'année (1er janvier 2023 = semaine 52 de 2022)", () => {
        expect(weekKey(new Date(Date.UTC(2023, 0, 1)))).toBe("2022-S52");
        expect(weekKey(new Date(Date.UTC(2024, 0, 4)))).toBe("2024-S01");
        expect(weekKey(new Date(Date.UTC(2026, 8, 28)))).toBe("2026-S40");
    });

    it("renvoie null pour une date absente ou invalide", () => {
        expect(weekKey(null)).toBeNull();
        expect(weekKey(undefined)).toBeNull();
        expect(weekKey("pas-une-date")).toBeNull();
        expect(weekKey(new Date("Invalid"))).toBeNull();
    });

    it("liste les semaines de la plus ancienne à la plus récente", () => {
        expect(listWeekKeys(new Date(Date.UTC(2026, 8, 28)), 3)).toEqual([
            "2026-S38",
            "2026-S39",
            "2026-S40",
        ]);
        expect(listWeekKeys(new Date(Date.UTC(2026, 8, 28)), 0)).toEqual([]);
        expect(listWeekKeys(new Date(Date.UTC(2026, 8, 28)), -4)).toEqual([]);
    });
});

describe("buildWeeklyActivity — série continue, jamais de trou qui embellit", () => {
    const end = new Date(Date.UTC(2026, 8, 28)); // lundi, semaine 2026-S40

    it("compte les guildes et les membres distincts par semaine", () => {
        const series = buildWeeklyActivity(
            [
                { guildId: "g1", actorId: "u1", at: new Date(Date.UTC(2026, 8, 28)) },
                { guildId: "g1", actorId: "u1", at: new Date(Date.UTC(2026, 8, 29)) }, // même semaine, doublon
                { guildId: "g2", actorId: "u2", at: new Date(Date.UTC(2026, 8, 29)) },
            ],
            { end, weeks: 2 }
        );

        expect(series.map((week) => week.week)).toEqual(["2026-S39", "2026-S40"]);
        expect(series[0]).toEqual({ week: "2026-S39", activeGuilds: 0, activeMembers: 0 });
        expect(series[1]).toEqual({ week: "2026-S40", activeGuilds: 2, activeMembers: 2 });
    });

    it("ignore ce qui est hors fenêtre et les factures sans date", () => {
        const series = buildWeeklyActivity(
            [
                { guildId: "g1", actorId: "u1", at: new Date(Date.UTC(2025, 0, 1)) },
                { guildId: "g1", actorId: "u1", at: null },
                { guildId: "g1", actorId: "u1", at: "n'importe quoi" },
            ],
            { end, weeks: 2 }
        );

        expect(series.every((week) => week.activeGuilds === 0 && week.activeMembers === 0)).toBe(true);
    });

    it("n'invente pas de membre sans identifiant", () => {
        const series = buildWeeklyActivity(
            [{ guildId: "g1", actorId: null, at: new Date(Date.UTC(2026, 8, 28)) }],
            { end, weeks: 1 }
        );

        expect(series[0]?.activeGuilds).toBe(1);
        expect(series[0]?.activeMembers).toBe(0);
    });
});

describe("buildRetentionCohorts — un taux n'est publié que si la cohorte tient debout", () => {
    const weeks = listWeekKeys(new Date(Date.UTC(2026, 8, 28)), 4); // S37 → S40

    it("mesure le retour semaine après semaine depuis la semaine d'entrée", () => {
        const cohorts = buildRetentionCohorts(
            [
                { guildId: "g1", weeks: ["2026-S37", "2026-S38", "2026-S39", "2026-S40"] },
                { guildId: "g2", weeks: ["2026-S37", "2026-S38"] },
                { guildId: "g3", weeks: ["2026-S37"] },
                { guildId: "g4", weeks: ["2026-S37", "2026-S40"] },
            ],
            weeks
        );

        expect(cohorts).toHaveLength(1);
        expect(cohorts[0]?.cohortWeek).toBe("2026-S37");
        expect(cohorts[0]?.size).toBe(4);
        expect(cohorts[0]?.points).toEqual([
            { weekOffset: 1, retained: 2, rate: 50 },
            { weekOffset: 2, retained: 1, rate: 25 },
            { weekOffset: 3, retained: 2, rate: 50 },
        ]);
    });

    it("ne publie aucun taux sous la taille minimale de cohorte, mais dit combien sont revenus", () => {
        const cohorts = buildRetentionCohorts(
            [
                { guildId: "g1", weeks: ["2026-S37", "2026-S38"] },
                { guildId: "g2", weeks: ["2026-S37"] },
            ],
            weeks
        );

        expect(MIN_COHORT_SIZE).toBeGreaterThan(cohorts[0]?.size ?? 0);
        expect(cohorts[0]?.points[0]).toEqual({ weekOffset: 1, retained: 1, rate: null });
    });

    it("ignore une guilde absente de la fenêtre et ne prolonge jamais au-delà", () => {
        const cohorts = buildRetentionCohorts(
            [
                { guildId: "ghost", weeks: ["2019-S01"] },
                { guildId: "g1", weeks: ["2026-S40"] },
            ],
            weeks
        );

        expect(cohorts).toHaveLength(1);
        expect(cohorts[0]?.cohortWeek).toBe("2026-S40");
        expect(cohorts[0]?.points).toEqual([]);
    });

    it("déduplique les semaines répétées", () => {
        const cohorts = buildRetentionCohorts(
            [{ guildId: "g1", weeks: ["2026-S37", "2026-S37", null, "2026-S38"] }],
            weeks
        );

        expect(cohorts[0]?.size).toBe(1);
        expect(cohorts[0]?.points[0]).toEqual({ weekOffset: 1, retained: 1, rate: null });
    });

    it("renvoie un tableau vide sans semaine de référence", () => {
        expect(buildRetentionCohorts([{ guildId: "g1", weeks: ["2026-S37"] }], [])).toEqual([]);
    });
});

describe("deriveModuleAdoption — activé ne veut pas dire utilisé", () => {
    it("croise activation et usage réel", () => {
        const adoption = deriveModuleAdoption([{ module: "marche", enabledGuilds: 5, usedGuilds: 1 }]);

        expect(adoption[0]).toEqual({
            module: "marche",
            enabledGuilds: 5,
            usedGuilds: 1,
            idleGuilds: 4,
            adoptionRate: 20,
        });
    });

    it("borne un usage qui dépasse l'activation (jamais plus de 100 %)", () => {
        const adoption = deriveModuleAdoption([{ module: "tickets", enabledGuilds: 2, usedGuilds: 9 }]);

        expect(adoption[0]?.usedGuilds).toBe(2);
        expect(adoption[0]?.idleGuilds).toBe(0);
        expect(adoption[0]?.adoptionRate).toBe(100);
    });

    it("borne les effectifs aberrants et le plafond de guildes connues", () => {
        const adoption = deriveModuleAdoption(
            [
                { module: "a", enabledGuilds: -3, usedGuilds: Number.NaN },
                { module: "b", enabledGuilds: 9, usedGuilds: 9 },
            ],
            5
        );

        const a = adoption.find((row) => row.module === "a");
        const b = adoption.find((row) => row.module === "b");
        expect(a).toEqual({ module: "a", enabledGuilds: 0, usedGuilds: 0, idleGuilds: 0, adoptionRate: 0 });
        expect(b?.enabledGuilds).toBe(5);
        expect(b?.adoptionRate).toBe(100);
    });

    it("met en tête les modules activés mais inutilisés", () => {
        const adoption = deriveModuleAdoption([
            { module: "missions", enabledGuilds: 5, usedGuilds: 5 },
            { module: "marche", enabledGuilds: 5, usedGuilds: 1 },
            { module: "tickets", enabledGuilds: 5, usedGuilds: 0 },
        ]);

        expect(adoption.map((row) => row.module)).toEqual(["tickets", "marche", "missions"]);
    });
});

describe("fraîcheur des guildes — le seuil vient des données, pas d'une invention", () => {
    const now = new Date(Date.UTC(2026, 8, 28));
    const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);

    it("retombe sur le plancher documenté quand l'échantillon est trop pauvre pour un centile", () => {
        const thresholds = deriveFreshnessThresholds(
            [
                { id: "g1", name: "A", lastActivityAt: daysAgo(3) },
                { id: "g2", name: "B", lastActivityAt: null },
            ],
            now
        );

        expect(thresholds).toEqual({
            warningDays: MIN_INACTIVITY_FLOOR_DAYS,
            dormantDays: MIN_INACTIVITY_FLOOR_DAYS * 2,
            derived: false,
            sampleSize: 1,
        });
    });

    it("dérive le seuil du troisième quartile des inactivités observées", () => {
        const thresholds = deriveFreshnessThresholds(
            [
                { id: "g1", name: "A", lastActivityAt: daysAgo(10) },
                { id: "g2", name: "B", lastActivityAt: daysAgo(20) },
                { id: "g3", name: "C", lastActivityAt: daysAgo(30) },
                { id: "g4", name: "D", lastActivityAt: daysAgo(40) },
            ],
            now
        );

        expect(thresholds).toEqual({ warningDays: 30, dormantDays: 60, derived: true, sampleSize: 4 });
    });

    it("garde le plancher quand la distribution observée est plus courte que lui", () => {
        const thresholds = deriveFreshnessThresholds(
            [
                { id: "g1", name: "A", lastActivityAt: daysAgo(1) },
                { id: "g2", name: "B", lastActivityAt: daysAgo(2) },
                { id: "g3", name: "C", lastActivityAt: daysAgo(3) },
            ],
            now
        );

        expect(thresholds.derived).toBe(true);
        expect(thresholds.warningDays).toBe(MIN_INACTIVITY_FLOOR_DAYS);
    });

    it("classe les guildes sans jamais dépasser les bornes", () => {
        const thresholds = { warningDays: 7, dormantDays: 14, derived: true, sampleSize: 3 };
        const { guilds } = classifyGuildFreshness(
            [
                { id: "active", name: "Active", lastActivityAt: daysAgo(3) },
                { id: "borne", name: "À la borne", lastActivityAt: daysAgo(7) },
                { id: "slow", name: "Ralentit", lastActivityAt: daysAgo(8) },
                { id: "slow2", name: "Ralentit 2", lastActivityAt: daysAgo(14) },
                { id: "dormant", name: "Endormie", lastActivityAt: daysAgo(15) },
                { id: "never", name: "Jamais vue", lastActivityAt: null },
            ],
            now,
            thresholds
        );

        const statusOf = (id: string) => guilds.find((guild) => guild.id === id)?.status;
        expect(statusOf("active")).toBe("ACTIVE");
        expect(statusOf("borne")).toBe("ACTIVE");
        expect(statusOf("slow")).toBe("SLOWING");
        expect(statusOf("slow2")).toBe("SLOWING");
        expect(statusOf("dormant")).toBe("DORMANT");
        expect(statusOf("never")).toBe("DORMANT");
        expect(guilds.find((guild) => guild.id === "never")?.daysInactive).toBeNull();
    });

    it("met en tête les guildes jamais vues, puis les plus inactives", () => {
        const { guilds } = classifyGuildFreshness(
            [
                { id: "recent", name: "Récente", lastActivityAt: daysAgo(1) },
                { id: "never", name: "Jamais vue", lastActivityAt: null },
                { id: "old", name: "Ancienne", lastActivityAt: daysAgo(90) },
            ],
            now,
            { warningDays: 7, dormantDays: 14, derived: true, sampleSize: 2 }
        );

        expect(guilds.map((guild) => guild.id)).toEqual(["never", "old", "recent"]);
        expect(guilds[1]?.daysInactive).toBe(90);
    });

    it("ignore une date illisible au lieu de la compter comme inactive depuis 1970", () => {
        const thresholds = deriveFreshnessThresholds([{ id: "g1", name: "A", lastActivityAt: "n'importe quoi" }], now);

        expect(thresholds).toEqual({
            warningDays: MIN_INACTIVITY_FLOOR_DAYS,
            dormantDays: MIN_INACTIVITY_FLOOR_DAYS * 2,
            derived: false,
            sampleSize: 0,
        });
    });
});

describe("isSampleReliable — on ne classe pas 4 personnes", () => {
    it("exige le seuil du module", () => {
        expect(MIN_RELIABLE_DISTINCT_ACTORS).toBe(15);
        expect(isSampleReliable(14)).toBe(false);
        expect(isSampleReliable(15)).toBe(true);
        expect(isSampleReliable(Number.NaN)).toBe(false);
        expect(isSampleReliable(5, 5)).toBe(true);
        expect(isSampleReliable(4, 5)).toBe(false);
    });
});
