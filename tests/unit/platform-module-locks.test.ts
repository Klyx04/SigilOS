/**
 * Régression — **verrou plateforme des modules** (A2 · A3 · G12).
 *
 * Le God peut couper un module pour **toutes** les guildes avec un message
 * perso ; l'écriture doit être aussi dure que le verrou de guilde (Zod borné,
 * rate-limit, garde d'état dans le `WHERE`, journal God, `admin` jamais
 * verrouillable) et la migration doit rester **additive et idempotente**.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/prisma", () => ({
    db: {
        platformConfig: { upsert: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
        guildModules: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
        guildConfig: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/server/actions/super-admin-actions", () => ({ isSuperAdmin: vi.fn() }));
vi.mock("@/server/actions/audit-actions", () => ({
    createAuditLog: vi.fn(),
    createGodAuditLog: vi.fn(),
    logAction: vi.fn(),
}));
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
    invalidateGuildCache: vi.fn().mockResolvedValue(undefined),
    flushGuildUserContextCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { createGodAuditLog } from "@/server/actions/audit-actions";
import { getPlatformModuleOverview, setPlatformModuleLock } from "@/server/actions/module-actions";
import { invalidatePlatformModuleStateCache } from "@/server/platform-module-state";

const mockDb = db as any;

beforeEach(() => {
    vi.clearAllMocks();
    invalidatePlatformModuleStateCache();
    (auth as any).mockResolvedValue({ user: { id: "god-1", name: "God" } });
    (isSuperAdmin as any).mockResolvedValue(true);
    (rateLimit as any).mockResolvedValue({ success: true });
    mockDb.platformConfig.upsert.mockResolvedValue({});
    mockDb.platformConfig.findUnique.mockResolvedValue({ disabledModules: [], moduleNotices: null });
    mockDb.platformConfig.updateMany.mockResolvedValue({ count: 1 });
    mockDb.guildModules.findMany.mockResolvedValue([]);
    mockDb.guildConfig.findMany.mockResolvedValue([{ discordGuildId: "111111111111111111" }]);
});

describe("setPlatformModuleLock — écriture God durcie", () => {
    it("coupe un module pour la plateforme : garde d'état + journal God", async () => {
        const res = await setPlatformModuleLock("songes", true, "Migration en cours");

        expect(res.success).toBe(true);
        expect(mockDb.platformConfig.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "singleton", disabledModules: { equals: [] } },
                data: expect.objectContaining({
                    disabledModules: { set: ["songes"] },
                    moduleNotices: { songes: "Migration en cours" },
                }),
            })
        );
        expect((createGodAuditLog as any).mock.calls[0][0]).toMatchObject({
            action: "GOD_MODULE_LOCK",
            targetId: "MODULE_PLATFORM_LOCK:songes",
            newValue: ["songes"],
        });
    });

    it("retire un module et purge son message", async () => {
        mockDb.platformConfig.findUnique.mockResolvedValue({
            disabledModules: ["songes", "marche"],
            moduleNotices: { songes: "Migration", marche: "Autre" },
        });

        const res = await setPlatformModuleLock("songes", false);

        expect(res.success).toBe(true);
        expect(mockDb.platformConfig.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "singleton", disabledModules: { equals: ["songes", "marche"] } },
                data: expect.objectContaining({
                    disabledModules: { set: ["marche"] },
                    moduleNotices: { marche: "Autre" },
                }),
            })
        );
    });

    it("refuse un non-God, `admin` et toute clé hors registre", async () => {
        (isSuperAdmin as any).mockResolvedValue(false);
        expect((await setPlatformModuleLock("songes", true)).success).toBe(false);

        (isSuperAdmin as any).mockResolvedValue(true);
        expect((await setPlatformModuleLock("admin", true)).success).toBe(false);
        expect((await setPlatformModuleLock("pas-un-module", true)).success).toBe(false);
        expect(mockDb.platformConfig.updateMany).not.toHaveBeenCalled();
    });

    it("rate-limit : refus propre, aucune lecture", async () => {
        (rateLimit as any).mockResolvedValue({ success: false });

        const res = await setPlatformModuleLock("songes", true);

        expect(res.success).toBe(false);
        expect(res.error).toContain("Trop de modifications");
        expect(mockDb.platformConfig.findUnique).not.toHaveBeenCalled();
    });

    it("garde d'état : si la valeur lue n'est plus en base, on refuse", async () => {
        mockDb.platformConfig.updateMany.mockResolvedValue({ count: 0 });

        const res = await setPlatformModuleLock("songes", true);

        expect(res.success).toBe(false);
        expect(res.error).toContain("recharge la page");
    });

    it("borne et nettoie le message : 500 caractères refusés (Zod), espaces rognés", async () => {
        expect((await setPlatformModuleLock("songes", true, "x".repeat(500))).success).toBe(false);
        expect(mockDb.platformConfig.updateMany).not.toHaveBeenCalled();

        await setPlatformModuleLock("songes", true, "   Migration en cours   ");
        const data = mockDb.platformConfig.updateMany.mock.calls[0][0].data;
        expect((data.moduleNotices as Record<string, string>).songes).toBe("Migration en cours");
    });
});

describe("getPlatformModuleOverview — vue God « Modules »", () => {
    it("refuse un non-God (fail-closed)", async () => {
        (isSuperAdmin as any).mockResolvedValue(false);
        await expect(getPlatformModuleOverview()).rejects.toThrow("Non autorisé");
    });

    it("compte les guildes dont le God a verrouillé le module", async () => {
        mockDb.platformConfig.findUnique.mockResolvedValue({
            disabledModules: ["marche"],
            moduleNotices: { marche: "Indisponible" },
            disabledModulesUpdatedAt: new Date("2026-09-26T10:00:00Z"),
            disabledModulesUpdatedBy: "god-1",
        });
        mockDb.guildModules.findMany.mockResolvedValue([
            { disabledByGod: ["missions"] },
            { disabledByGod: ["missions", "marche"] },
            { disabledByGod: [] },
        ]);

        const overview = await getPlatformModuleOverview();

        expect(overview.locks).toEqual(["marche"]);
        expect(overview.notices.marche).toBe("Indisponible");
        expect(overview.guildLockCounts).toEqual({ missions: 2, marche: 1 });
        expect(overview.updatedBy).toBe("god-1");
    });
});

describe("migration — additive et idempotente (lot 2)", () => {
    const sql = readFileSync(
        "prisma/migrations/20260926100000_platform_module_locks/migration.sql",
        "utf8"
    ).replace(/--.*$/gm, "");

    it("n'ajoute que des colonnes (`ADD COLUMN IF NOT EXISTS`)", () => {
        const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
        expect(statements).toHaveLength(4);
        for (const statement of statements) {
            expect(statement).toMatch(/^ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS/);
        }
    });

    it("ne détruit rien (aucun DROP / TRUNCATE / DELETE / renommage)", () => {
        expect(sql).not.toMatch(/DROP|TRUNCATE|DELETE|RENAME|ALTER COLUMN/i);
    });

    it("les 4 colonnes du verrou plateforme sont présentes", () => {
        for (const column of ["disabledModules", "moduleNotices", "disabledModulesUpdatedAt", "disabledModulesUpdatedBy"]) {
            expect(sql).toContain(`"${column}"`);
        }
    });
});
