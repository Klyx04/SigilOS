/**
 * Chantier D-2bis — mesures **produit** côté serveur (`getProductStats`).
 *
 * Ce que ce fichier verrouille (les trois pièges qui rendraient l'écran malhonnête) :
 * ① l'usage interne du panneau God ne compte pas comme activité produit (`isGodLog: false`) ;
 * ② un module **verrouillé par le staff** (`disabledByGod`) n'est pas compté comme activé, et
 *    un usage constaté chez une guilde non activée ne gonfle pas l'usage ;
 * ③ un module **sans table métier horodatée** n'est pas compté comme « inutilisé » : il est
 *    publié à part (`unmeasured`), et une lecture qui touche son plafond le dit (`truncated`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type LooseMock = ReturnType<typeof vi.fn>;

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findMany: vi.fn() },
        auditLog: { findMany: vi.fn(), groupBy: vi.fn() },
        guildModules: { findMany: vi.fn() },
        user: { count: vi.fn() },
        userProfile: { count: vi.fn(), groupBy: vi.fn() },
        dreamRun: { groupBy: vi.fn() },
        mission: { groupBy: vi.fn() },
        poll: { groupBy: vi.fn() },
        marketListing: { groupBy: vi.fn() },
        ticketRecord: { groupBy: vi.fn() },
        achievementSubmission: { groupBy: vi.fn() },
        guildEvent: { groupBy: vi.fn() },
        serviceListing: { groupBy: vi.fn() },
    },
}));
vi.mock("@/server/actions/super-admin-actions", () => ({ isSuperAdmin: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { PRODUCT_FACT_LIMIT, getProductStats } from "@/server/actions/telemetry-product-actions";

const mockDb = db as unknown as Record<string, Record<string, LooseMock>>;
const DAY = 86400000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const countOf = (guildId: string, all: number) => ({ guildId, _count: { _all: all } });

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSuperAdmin).mockResolvedValue(true);

    mockDb.guildConfig.findMany.mockResolvedValue([
        { id: "g1", name: "Guilde A", createdAt: daysAgo(2) },
        { id: "g2", name: "Guilde B", createdAt: daysAgo(400) },
    ]);
    mockDb.auditLog.findMany.mockResolvedValue([
        { guildId: "g1", actorUserId: "u1", createdAt: daysAgo(1) },
        { guildId: "g1", actorUserId: "u1", createdAt: daysAgo(2) },
        { guildId: "g2", actorUserId: "u2", createdAt: daysAgo(40) },
    ]);
    mockDb.auditLog.groupBy.mockResolvedValue([{ guildId: "g1", _max: { createdAt: daysAgo(1) } }]);
    mockDb.guildModules.findMany.mockResolvedValue([
        { guildId: "g1", songes: true, marche: true, ladder: true, disabledByGod: [] },
        { guildId: "g2", songes: true, marche: true, ladder: false, disabledByGod: ["marche"] },
    ]);
    mockDb.user.count.mockResolvedValue(28);
    mockDb.userProfile.count.mockResolvedValue(31);
    mockDb.userProfile.groupBy.mockResolvedValue([]);
    mockDb.dreamRun.groupBy.mockResolvedValue([countOf("g1", 3), countOf("g2", 5)]);
    mockDb.mission.groupBy.mockResolvedValue([]);
    mockDb.poll.groupBy.mockResolvedValue([]);
    mockDb.marketListing.groupBy.mockResolvedValue([countOf("g2", 9)]);
    mockDb.ticketRecord.groupBy.mockResolvedValue([]);
    mockDb.achievementSubmission.groupBy.mockResolvedValue([]);
    mockDb.guildEvent.groupBy.mockResolvedValue([]);
    mockDb.serviceListing.groupBy.mockResolvedValue([]);
});

describe("getProductStats — l'usage interne du God n'est pas de l'activité produit", () => {
    it("refuse l'accès quand l'appelant n'est pas super-admin (fail-closed)", async () => {
        vi.mocked(isSuperAdmin).mockResolvedValue(false);

        await expect(getProductStats()).rejects.toThrow(/Super-admin/);
        expect(mockDb.auditLog.findMany).not.toHaveBeenCalled();
    });

    it("lit l'audit en excluant explicitement les lignes du panneau God", async () => {
        await getProductStats();

        expect(mockDb.auditLog.findMany.mock.calls[0]?.[0]?.where?.isGodLog).toBe(false);
        expect(mockDb.auditLog.groupBy.mock.calls[0]?.[0]?.where?.isGodLog).toBe(false);
    });

    it("compte les acteurs et les guildes réellement actifs sur la fenêtre", async () => {
        const stats = await getProductStats();

        expect(stats.counts).toMatchObject({
            guildsTotal: 2,
            guildsActive7: 1,
            guildsActive30: 1,
            guildsNew30: 1,
            accountsTotal: 28,
            profilesTotal: 31,
            membersActive7: 1,
            membersActive30: 1,
            actions7: 2,
            actions30: 2,
        });
        // 2 acteurs distincts seulement ⇒ aucun classement nominatif publiable.
        expect(stats.sample).toEqual({ actions: 3, distinctActors: 2, reliable: false });
    });
});

describe("getProductStats — activé, verrouillé, mesuré", () => {
    it("ne compte pas un module verrouillé par le staff comme activé", async () => {
        const stats = await getProductStats();

        const songes = stats.adoption.modules.find((row) => row.module === "songes");
        const marche = stats.adoption.modules.find((row) => row.module === "marche");
        expect(songes).toMatchObject({ enabledGuilds: 2, usedGuilds: 2, idleGuilds: 0 });
        expect(marche).toMatchObject({ enabledGuilds: 1, usedGuilds: 0, idleGuilds: 1 });
    });

    it("ignore l'usage d'une guilde qui n'a pas le module activé", async () => {
        const stats = await getProductStats();
        const marche = stats.adoption.modules.find((row) => row.module === "marche");

        // `marketListing` renvoie g2 — mais g2 est verrouillée sur ce module : 0 usage compté.
        expect(marche?.usedGuilds).toBe(0);
        expect(marche?.adoptionRate).toBe(0);
    });

    it("publie à part les modules sans mesure d'usage plutôt que de les dire inutilisés", async () => {
        const stats = await getProductStats();

        expect(stats.adoption.modules.some((row) => row.module === "ladder")).toBe(false);
        expect(stats.adoption.unmeasured).toEqual([{ module: "ladder", enabledGuilds: 1 }]);
        expect(stats.adoption.probedModules).toBe(stats.adoption.modules.length);
    });

    it("mesure la profondeur d'usage par guilde", async () => {
        const stats = await getProductStats();

        expect(stats.businessRows30).toEqual([
            { guildId: "g2", guildName: "Guilde B", rows: 14 },
            { guildId: "g1", guildName: "Guilde A", rows: 3 },
        ]);
    });
});

describe("getProductStats — rétention, fraîcheur, échantillon", () => {
    it("ne publie aucun taux de rétention sur une cohorte trop petite", async () => {
        const stats = await getProductStats();

        // Deux cohortes (g1 cette semaine, g2 il y a 40 jours), chacune d'une seule guilde.
        const cohorts = stats.retention.filter((cohort) => cohort.size > 0);
        expect(cohorts.length).toBeGreaterThanOrEqual(1);
        expect(cohorts.reduce((total, cohort) => total + cohort.size, 0)).toBe(2);
        expect(stats.minCohortSize).toBeGreaterThan(2);
        for (const cohort of cohorts) {
            expect(cohort.size).toBeLessThan(stats.minCohortSize);
            // Le compte brut est publié, jamais un pourcentage calculé sur une guilde.
            expect(cohort.points.every((point) => point.rate === null)).toBe(true);
        }
    });

    it("produit une série hebdomadaire continue, trous compris", async () => {
        const stats = await getProductStats();

        expect(stats.weekly).toHaveLength(stats.retentionWeeks);
        expect(stats.weekly.every((week) => typeof week.activeGuilds === "number")).toBe(true);
        // La semaine des faits est présente ; les semaines sans activité sont à zéro, pas absentes.
        const activeWeeks = stats.weekly.filter((week) => week.activeGuilds > 0);
        expect(activeWeeks.length).toBeGreaterThanOrEqual(1);
        expect(activeWeeks.at(-1)?.activeGuilds).toBe(1);
        expect(stats.weeks).toHaveLength(stats.retentionWeeks);
    });

    it("signale une guilde jamais vue et dérive ses seuils de la distribution", async () => {
        const stats = await getProductStats();

        const never = stats.freshness.guilds.find((guild) => guild.id === "g2");
        expect(never).toMatchObject({ status: "DORMANT", daysInactive: null });
        expect(stats.freshness.guilds[0]?.id).toBe("g2");
        expect(stats.freshness.thresholds.derived).toBe(false);
    });

    it("publie la troncature au lieu de laisser croire à un total", async () => {
        mockDb.auditLog.findMany.mockResolvedValue(
            Array.from({ length: PRODUCT_FACT_LIMIT }, () => ({
                guildId: "g1",
                actorUserId: "u1",
                createdAt: daysAgo(1),
            }))
        );

        const stats = await getProductStats();

        expect(stats.truncated).toBe(true);
        expect(stats.sample.actions).toBe(PRODUCT_FACT_LIMIT);
    });
});
