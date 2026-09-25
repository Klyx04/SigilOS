/**
 * Régression — **verrou God des modules** (audit 24/09/2026, §2).
 *
 * Constats mesurés et corrigés ici :
 *  1. `getUserContext` ne lisait pas `disabledByGod` ⇒ `canView*`/`canManage*` restaient
 *     `true` (trouée n°1) et les pages exemptaient `isAdmin` (trouée n°2) ;
 *  2. `internalCheckPermission` (bot) ne consultait jamais le verrou (trouée n°3) ;
 *  3. `setModuleGodLock` n'avait **ni garde d'état** (`WHERE disabledByGod equals`),
 *     ni Zod, ni rate-limit, écrivait dans le **journal de la guilde** au lieu du
 *     journal God, et `commandes` n'était pas verrouillable (26/27 clés).
 *
 * Ce test verrouille la règle pure, l'écriture God et la couverture de la UI
 * (la grille `/god/guilds/[id]` doit lister TOUS les modules verrouillables).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_MODULES } from "@/lib/module-types";
import { GOD_LOCKABLE_MODULES, applyGodLocks, normalizeGodLocks } from "@/lib/module-lock";

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: vi.fn() },
        guildModules: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
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
    invalidateGuildCache: vi.fn(),
    flushGuildUserContextCache: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { createAuditLog, createGodAuditLog } from "@/server/actions/audit-actions";
import { setModuleGodLock } from "@/server/actions/module-actions";

const GUILD = "111111111111111111";

describe("règle pure — verrou God", () => {
    it("la liste des modules verrouillables est DÉRIVÉE du registre (admin exclu)", () => {
        const expected = Object.keys(DEFAULT_MODULES).filter((k) => k !== "admin").sort();
        expect([...GOD_LOCKABLE_MODULES].sort()).toEqual(expected);
        // `commandes` manquait à la liste codée en dur de l'audit du 24/09.
        expect(GOD_LOCKABLE_MODULES).toContain("commandes");
        expect(GOD_LOCKABLE_MODULES).not.toContain("admin");
    });

    it("normalise : clés inconnues écartées, doublons retirés, `admin` jamais verrouillable", () => {
        expect(normalizeGodLocks(["missions", "missions", "admin", "pas-un-module"])).toEqual(["missions"]);
        expect(normalizeGodLocks(undefined)).toEqual([]);
        expect(normalizeGodLocks("missions")).toEqual([]);
    });


describe("setModuleGodLock — écriture durcie", () => {
    const mockDb = db as any;

    beforeEach(() => {
        vi.clearAllMocks();
        (auth as any).mockResolvedValue({ user: { id: "god-1", name: "God" } });
        (isSuperAdmin as any).mockResolvedValue(true);
        (rateLimit as any).mockResolvedValue({ success: true });
        mockDb.guildConfig.findUnique.mockResolvedValue({ id: "cfg-1" });
        mockDb.guildModules.findUnique.mockResolvedValue({ disabledByGod: [] });
        mockDb.guildModules.updateMany.mockResolvedValue({ count: 1 });
        mockDb.guildModules.upsert.mockResolvedValue({});
    });

    it("pose le verrou avec la GARDE D'ÉTAT (valeur lue encore en base) et journalise côté God", async () => {
        const res = await setModuleGodLock(GUILD, "commandes", true);

        expect(res.success).toBe(true);
        expect(mockDb.guildModules.updateMany).toHaveBeenCalledWith({
            where: { guildId: "cfg-1", disabledByGod: { equals: [] } },
            data: { disabledByGod: { set: ["commandes"] } },
        });
        expect(createGodAuditLog).toHaveBeenCalledWith(expect.objectContaining({
            action: "GOD_MODULE_LOCK",
            guildId: GUILD,
            oldValue: [],
            newValue: ["commandes"],
        }));
        // Le journal de la GUILDE ne doit plus recevoir une action plateforme.
        expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("course entre deux Gods : aucune écriture si la valeur lue a changé", async () => {
        mockDb.guildModules.updateMany.mockResolvedValue({ count: 0 });

        const res = await setModuleGodLock(GUILD, "missions", true);

        expect(res.success).toBe(false);
        expect(createGodAuditLog).not.toHaveBeenCalled();
    });

    it("crée la ligne quand la guilde n'en a pas (create gardé par l'unicité guildId)", async () => {
        mockDb.guildModules.findUnique.mockResolvedValue(null);

        const res = await setModuleGodLock(GUILD, "marche", true);

        expect(res.success).toBe(true);
        expect(mockDb.guildModules.upsert).toHaveBeenCalled();
        expect(mockDb.guildModules.updateMany).not.toHaveBeenCalled();
    });

    it("refuse `admin` (garde-fou) et toute clé hors registre", async () => {
        expect((await setModuleGodLock(GUILD, "admin", true)).success).toBe(false);
        expect((await setModuleGodLock(GUILD, "pas-un-module", true)).success).toBe(false);
        expect(mockDb.guildModules.updateMany).not.toHaveBeenCalled();
    });

    it("rate-limit : un God ne peut pas marteler l'écriture", async () => {
        (rateLimit as any).mockResolvedValue({ success: false });

        const res = await setModuleGodLock(GUILD, "missions", true);

        expect(res.success).toBe(false);
        expect(mockDb.guildModules.findUnique).not.toHaveBeenCalled();
    });

    it("entrée invalide (id Discord non snowflake) refusée avant toute lecture", async () => {
        const res = await setModuleGodLock("pas-un-id", "missions", true);

        expect(res.success).toBe(false);
        expect(mockDb.guildConfig.findUnique).not.toHaveBeenCalled();
    });
});

describe("couverture — une seule vérité, jusqu'à la UI", () => {
    it("la grille God liste TOUS les modules verrouillables", () => {
        const client = readFileSync("src/app/god/guilds/[id]/god-guild-modules-client.tsx", "utf8");
        const order = (client.match(/const ORDER: ModuleKey\[\] = \[([\s\S]*?)\];/)?.[1] ?? "")
            .match(/"(\w+)"/g)?.map((s) => s.replace(/"/g, "")) ?? [];
        for (const key of GOD_LOCKABLE_MODULES) {
            expect(order, `module verrouillable absent de la grille God : ${key}`).toContain(key);
        }
        expect(order).not.toContain("admin");
    });

    it("getUserContext lit le verrou et l'applique (select + règle partagée)", () => {
        const code = readFileSync("src/server/actions/user-actions.ts", "utf8");
        expect(code).toMatch(/disabledByGod:\s*true/);
        expect(code).toMatch(/applyGodLocks\(/);
        expect(code).toMatch(/options\?: \{ module\?: ModuleKey \}/);
    });

    it("aucune page ne réintroduit l'exemption `isAdmin` sur un module verrouillable", () => {
        const files = [
            "src/app/dashboard/[guildId]/marche/page.tsx",
            "src/app/dashboard/[guildId]/services/page.tsx",
            "src/app/dashboard/[guildId]/stats/page.tsx",
            "src/app/dashboard/[guildId]/succes/page.tsx",
            "src/app/dashboard/[guildId]/calendar/page.tsx",
            "src/app/dashboard/[guildId]/donjons-et-quetes/page.tsx",
            "src/app/dashboard/[guildId]/sondages/page.tsx",
        ];
        for (const file of files) {
            const code = readFileSync(file, "utf8");
            expect(code, `${file} : un admin ne doit pas contourner le module (seul le God)`).not.toMatch(
                /!(\w+\.)?isAdmin\s*&&\s*!\(?await isModuleEnabled/,
            );
        }
    });
});

    it("applique le verrou : clés verrouillées à false, toggle guilde conservé, entrée NON mutée", () => {
        const modules = { missions: true, songes: false };
        const effective = applyGodLocks(modules, ["missions", "admin", "inconnu"]);
        expect(effective).toEqual({ missions: false, songes: false });
        expect(modules.missions).toBe(true); // pas de mutation en place
        expect(applyGodLocks(modules, [])).toBe(modules); // aucun verrou = pas de copie
        expect(applyGodLocks(null, ["missions"])).toBeNull();
    });
});
