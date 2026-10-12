/**
 * Lot 3 — **« les logs, une seule porte »** (G11 · A9 · A10 · A11 · G6).
 *
 * Mesures du 25/09/2026 sur la base locale (lecture seule) :
 *  - `AuditLog` : **1 033** lignes, dont **749** `GOD_DASHBOARD_ACCESS` (**72 %** du
 *    journal — chaque visite du God créait une ligne, malgré un throttle horaire) ;
 *  - `GodAccessLog` : **55** lignes (20 GRANT, 28 REVOKE, 7 SYNC) **écrites et jamais
 *    lues** par aucune surface ;
 *  - `GodSessionLog` : **495** sessions → la **source** du compteur agrégé retenu.
 *
 * Ce test verrouille : ① la disparition du doublon (une seule entrée de nav,
 * `?tab=security` redirigé, aucun second panneau dans `/god`) ; ② l'arrêt de la
 * ligne de journal par visite ; ③ la lecture du journal d'une guilde (God, lecture
 * seule, super-admin obligatoire) ; ④ l'exposition de `GodAccessLog` ; ⑤ les règles
 * pures de période, de pagination numérotée et de regroupement par jour (UTC).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
    AUDIT_LOG_PAGE_SIZES,
    AUDIT_LOG_PERIODS,
    DEFAULT_AUDIT_LOG_PERIOD,
    auditLogPeriodStart,
    dailyCounts,
    groupLogsByDay,
    paginationWindow,
    totalPagesOf,
    utcDayKey,
    utcDayLabel,
} from "@/lib/audit-log-view";

vi.mock("@/lib/prisma", () => ({
    db: {
        auditLog: { count: vi.fn(), findMany: vi.fn() },
        godAccessLog: { count: vi.fn(), findMany: vi.fn() },
        user: { findMany: vi.fn() },
        guildConfig: { findUnique: vi.fn() },
        account: { findFirst: vi.fn() },
    },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn(),
    canGodAccess: vi.fn(),
}));
vi.mock("@/server/actions/user-actions", () => ({ getUserContext: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { db } from "@/lib/prisma";
import { isSuperAdmin, canGodAccess } from "@/server/actions/super-admin-actions";
import { getGlobalAuditLogs, getGodAccessLogs } from "@/server/actions/audit-actions";

const mockDb = db as any;

const read = (path: string) => readFileSync(path, "utf8");

describe("règles pures — période, pagination numérotée, jours UTC (G6)", () => {
    it("« Toute la rétention » ne borne rien ; les presets bornent en heures", () => {
        const now = new Date("2026-09-25T12:00:00.000Z");

        expect(auditLogPeriodStart("all", now)).toBeUndefined();
        expect(auditLogPeriodStart("24h", now)?.toISOString()).toBe("2026-09-24T12:00:00.000Z");
        expect(auditLogPeriodStart("7d", now)?.toISOString()).toBe("2026-09-18T12:00:00.000Z");
        expect(DEFAULT_AUDIT_LOG_PERIOD).toBe("all");
        expect(AUDIT_LOG_PERIODS.map((p) => p.value)).toEqual(["all", "24h", "7d", "30d", "90d"]);
        expect(AUDIT_LOG_PAGE_SIZES).toEqual([20, 50, 100]);
    });

    it("la fenêtre affiche première, dernière et voisines — jamais un trou muet", () => {
        expect(paginationWindow(1, 1)).toEqual([1]);
        expect(paginationWindow(2, 2)).toEqual([1, 2]);
        expect(paginationWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
        expect(paginationWindow(10, 10)).toEqual([1, "gap", 9, 10]);
        // Une page hors bornes est ramenée dans la fenêtre (jamais un écran vide).
        expect(paginationWindow(99, 5)).toEqual([1, "gap", 4, 5]);
        expect(totalPagesOf(0, 50)).toBe(1);
        expect(totalPagesOf(101, 50)).toBe(3);
    });

    it("les jours sont **UTC** (aucun écart serveur ↔ navigateur) et labellisés en français", () => {
        const now = new Date("2026-09-25T09:00:00.000Z");

        expect(utcDayKey("2026-09-25T23:30:00.000Z")).toBe("2026-09-25");
        expect(utcDayLabel(new Date("2026-09-25T00:10:00.000Z"), now)).toBe("Aujourd'hui");
        expect(utcDayLabel(new Date("2026-09-24T23:00:00.000Z"), now)).toBe("Hier");
        expect(utcDayLabel(new Date("2026-09-22T10:00:00.000Z"), now)).toBe("22/09/2026");

        const groups = groupLogsByDay(
            [
                { id: "a", createdAt: "2026-09-25T08:00:00.000Z" },
                { id: "b", createdAt: "2026-09-25T07:00:00.000Z" },
                { id: "c", createdAt: "2026-09-24T23:00:00.000Z" },
            ],
            (row) => row.createdAt,
            now,
        );
        expect(groups.map((group) => group.label)).toEqual(["Aujourd'hui", "Hier"]);
        expect(groups[0].rows.map((row) => row.id)).toEqual(["a", "b"]);
        expect(groups[1].rows.map((row) => row.id)).toEqual(["c"]);
    });

    it("la série de compteurs est **continue** (un jour sans ligne vaut 0)", () => {
        const now = new Date("2026-09-25T12:00:00.000Z");
        const series = dailyCounts(
            ["2026-09-25T08:00:00.000Z", "2026-09-25T09:00:00.000Z", "2026-09-23T09:00:00.000Z"],
            3,
            now,
        );

        expect(series.map((day) => [day.key, day.count])).toEqual([
            ["2026-09-23", 1],
            ["2026-09-24", 0],
            ["2026-09-25", 2],
        ]);
        expect(series[series.length - 1].label).toBe("Aujourd'hui");
    });
});

describe("une seule porte pour les journaux (G11)", () => {
    it("le menu God n'a plus qu'une entrée de journal", () => {
        const nav = read("src/components/layout/god-nav-config.ts");

        expect(nav).not.toMatch(/id: "security"/);
        expect(nav).toMatch(/id: "logs", name: "Journaux", sub: "logs"/);
        // Une seule entrée pointe vers la page des journaux.
        expect(nav.match(/sub: "logs"/g)?.length).toBe(1);
    });

    it("la brique `security` est fusionnée dans `logs` (aucune brique morte)", () => {
        const bricks = read("src/lib/god-bricks.ts");

        expect(bricks).not.toMatch(/\{ id: "security"/);
        expect(bricks).toMatch(/\{ id: "logs",\s+label: "Journaux & audit"/);
    });

    it("`?tab=security` REDIRIGE (la route n'est jamais supprimée à sec)", () => {
        const page = read("src/app/god/page.tsx");

        expect(page).toMatch(/requestedTab === "security"\) redirect\(`\$\{godRoute\}\/logs`\)/);
        // Plus de second panneau de journal dans le dashboard God.
        expect(page).not.toContain("GlobalLogsServer");
        expect(page).not.toContain("audit-feed-panel");
        expect(page).not.toMatch(/security: "security"/);
    });

    it("`/god/logs` expose les 5 onglets, dont le journal de guilde en lecture seule", () => {
        const tabs = read("src/app/god/logs/logs-tabs.tsx");

        for (const value of ["platform", "guild", "access", "market", "delegates"]) {
            expect(tabs, `onglet manquant : ${value}`).toMatch(new RegExp(`value="${value}"`));
        }
        expect(tabs).toMatch(/scope="guild"/);
        expect(tabs).toMatch(/DelegatedAccessView/);
    });

    it("le viewer unique consomme la pagination du kit et les règles pures", () => {
        const viewer = read("src/app/god/logs/log-viewer.tsx");

        expect(viewer).toMatch(/GodPagination/);
        expect(viewer).toMatch(/AUDIT_LOG_PERIODS/);
        expect(viewer).toMatch(/groupLogsByDay/);
        // L'ancienne pagination « Page 1 / 2 » (chevrons nus) a disparu du viewer.
        expect(viewer).not.toMatch(/ChevronLeft/);
    });

    it("A9 — plus aucune ligne de journal par visite du God", () => {
        const layout = read("src/app/god/layout.tsx");
        const actions = read("src/server/actions/audit-actions.ts");

        // Le layout God n'écrit plus rien ; le throttle devenu orphelin est supprimé.
        expect(layout).not.toContain("createGodAuditLog");
        expect(layout).not.toMatch(/action: "GOD_DASHBOARD_ACCESS"/);
        expect(actions).not.toMatch(/action === "GOD_DASHBOARD_ACCESS"\) \{/);
        // Le compteur agrégé (sessions God) est la trace retenue.
        expect(read("src/app/god/logs/page.tsx")).toMatch(/getGodAccessDailyStats/);
    });
});

describe("lectures God — journal de guilde (A11) et accès délégués (A10)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.auditLog.count.mockResolvedValue(0);
        mockDb.auditLog.findMany.mockResolvedValue([]);
        mockDb.godAccessLog.count.mockResolvedValue(0);
        mockDb.godAccessLog.findMany.mockResolvedValue([]);
        mockDb.user.findMany.mockResolvedValue([]);
    });

    it("le journal d'une guilde filtre par id **interne** (`guildId`)", async () => {
        (isSuperAdmin as any).mockResolvedValue(true);
        (canGodAccess as any).mockResolvedValue(true);

        await getGlobalAuditLogs({ scope: "guild", guildConfigId: "guild-1" });

        expect(mockDb.auditLog.count.mock.calls[0][0].where.guildId).toBe("guild-1");
        expect(mockDb.auditLog.count.mock.calls[0][0].where.isGodLog).toBe(false);
    });

    it("le journal d'une guilde est REFUSÉ à un sous-god (fail-closed)", async () => {
        (isSuperAdmin as any).mockResolvedValue(false);
        (canGodAccess as any).mockResolvedValue(true);

        const result = await getGlobalAuditLogs({ scope: "guild", guildConfigId: "guild-1" });

        expect(result.success).toBe(false);
        expect(mockDb.auditLog.findMany).not.toHaveBeenCalled();
    });

    it("le compteur de sécurité accompagne le total (compteur par famille, G6)", async () => {
        (isSuperAdmin as any).mockResolvedValue(true);
        (canGodAccess as any).mockResolvedValue(true);
        mockDb.auditLog.count.mockResolvedValueOnce(12).mockResolvedValueOnce(3);

        const result = await getGlobalAuditLogs({ scope: "platform" });

        expect(result.data?.total).toBe(12);
        expect(result.data?.securityCount).toBe(3);
        // La partition `security` / `functional` est faite **en base** (liste fermée).
        const securityWhere = mockDb.auditLog.count.mock.calls[1][0].where;
        expect(securityWhere.AND[1].action.in.length).toBeGreaterThan(0);
    });

    it("`getGodAccessLogs` refuse un non-super-admin sans toucher la base", async () => {
        (isSuperAdmin as any).mockResolvedValue(false);

        const result = await getGodAccessLogs({ page: 1, limit: 50 });

        expect(result.success).toBe(false);
        expect(mockDb.godAccessLog.findMany).not.toHaveBeenCalled();
    });

    it("`getGodAccessLogs` expose les 55 lignes jamais lues, avec nom et détail borné", async () => {
        (isSuperAdmin as any).mockResolvedValue(true);
        mockDb.godAccessLog.count.mockResolvedValue(55);
        mockDb.godAccessLog.findMany.mockResolvedValue([
            {
                id: "log-1",
                userId: "user-1",
                action: "GRANT",
                targetId: "grant-1",
                metadata: { brickId: "tickets", reason: "renfort support", performedBy: "god" },
                createdAt: new Date("2026-09-25T08:00:00.000Z"),
            },
        ]);
        mockDb.user.findMany.mockResolvedValue([{ id: "user-1", name: "Sous-God" }]);

        const result = await getGodAccessLogs({ page: 1, limit: 50 });

        expect(result.data?.total).toBe(55);
        expect(result.data?.logs[0]).toMatchObject({
            action: "GRANT",
            userName: "Sous-God",
            targetId: "grant-1",
        });
        expect(result.data?.logs[0].detail).toContain("brickId: tickets");
        expect(result.data?.logs[0].detail?.length).toBeLessThanOrEqual(160);
    });
});
