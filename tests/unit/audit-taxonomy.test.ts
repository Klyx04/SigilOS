/**
 * Régression — **séparation audit / sécurité** (audit croisé du 24/09/2026, §6).
 *
 * Constats mesurés : aucune catégorie n'existait — tout était classé par conventions
 * d'`action`, donc l'écran « **Security Feed** » de `/god` affichait
 * `CONFIG_UPDATED` / `WEBHOOK_MEMBER_UPDATE`, et les deux écrans God montraient le
 * **même total brut** (« le même 779 partout »). Le filtrage se faisait **en
 * mémoire**, sur la première page seulement, avec deux listes de filtres
 * différentes dans les deux composants.
 *
 * Ce test verrouille : ① la liste fermée des actions de sécurité ; ② le filtrage
 * **en base** (`in` / `notIn`) et le périmètre (`isGodLog`) ; ③ l'usage unique de
 * la liste partagée par les deux écrans.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
    AUDIT_ACTION_FILTER_OPTIONS,
    SECURITY_AUDIT_ACTIONS,
    auditCategoryOf,
} from "@/lib/audit-taxonomy";

vi.mock("@/lib/prisma", () => ({
    db: {
        auditLog: { count: vi.fn(), findMany: vi.fn() },
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

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { isSuperAdmin, canGodAccess } from "@/server/actions/super-admin-actions";
import { getGlobalAuditLogs } from "@/server/actions/audit-actions";

const mockDb = db as any;

describe("taxonomie — catégories d'audit", () => {
    it("les incidents et refus sont `security`, le reste `functional`", () => {
        for (const action of ["SECURITY_ALERT", "ADMIN_FULL_DENIED", "BETA_ACCESS_ATTEMPT", "GOD_AUTH_BYPASS"]) {
            expect(auditCategoryOf(action), action).toBe("security");
        }
        // Ce que « Security Feed » affichait à tort :
        for (const action of ["CONFIG_UPDATED", "WEBHOOK_MEMBER_UPDATE", "MISSION_CREATED", "GOD_GUILD_WHITELIST", "PROFILE_ARCHIVED"]) {
            expect(auditCategoryOf(action), action).toBe("functional");
        }
    });

    it("une seule liste de filtres, sans doublon, avec un groupe sécurité", () => {
        const values = AUDIT_ACTION_FILTER_OPTIONS.map((o) => o.value);
        expect(new Set(values).size).toBe(values.length);
        const securityOption = AUDIT_ACTION_FILTER_OPTIONS.find((o) => o.category === "security");
        expect(securityOption).toBeTruthy();
        for (const action of SECURITY_AUDIT_ACTIONS) {
            expect(securityOption!.value.split(",")).toContain(action);
        }
    });
});

describe("getGlobalAuditLogs — filtrage EN BASE", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth as any).mockResolvedValue({ user: { id: "god-1", name: "God" } });
        (isSuperAdmin as any).mockResolvedValue(true);
        (canGodAccess as any).mockResolvedValue(true);
        mockDb.auditLog.count.mockResolvedValue(3);
        mockDb.auditLog.findMany.mockResolvedValue([]);
    });

    const whereOf = () => mockDb.auditLog.count.mock.calls[0][0].where;

    it("catégorie `security` ⇒ `action: { in: … }` (jamais un filtrage en mémoire)", async () => {
        await getGlobalAuditLogs({ category: "security" });

        expect(whereOf().AND).toEqual([{ action: { in: [...SECURITY_AUDIT_ACTIONS] } }]);
    });

    it("catégorie `functional` ⇒ `action: { notIn: … }`", async () => {
        await getGlobalAuditLogs({ category: "functional" });

        expect(whereOf().AND).toEqual([{ action: { notIn: [...SECURITY_AUDIT_ACTIONS] } }]);
    });

    it("un filtre d'action explicite est CROISÉ avec la catégorie, jamais écrasé", async () => {
        await getGlobalAuditLogs({ category: "security", actionFilter: "SECURITY_ALERT,CONFIG_UPDATED" });

        expect(whereOf().action).toEqual({ in: ["SECURITY_ALERT", "CONFIG_UPDATED"] });
        expect(whereOf().AND).toEqual([{ action: { in: [...SECURITY_AUDIT_ACTIONS] } }]);
    });

    it("périmètre : `platform` ⇒ `isGodLog: true`, `guild` ⇒ `isGodLog: false`", async () => {
        await getGlobalAuditLogs({ scope: "platform" });
        expect(whereOf().isGodLog).toBe(true);

        vi.clearAllMocks();
        (auth as any).mockResolvedValue({ user: { id: "god-1", name: "God" } });
        (isSuperAdmin as any).mockResolvedValue(true);
        mockDb.auditLog.count.mockResolvedValue(0);
        mockDb.auditLog.findMany.mockResolvedValue([]);

        await getGlobalAuditLogs({ scope: "guild" });
        expect(whereOf().isGodLog).toBe(false);
    });
});

describe("usage unique — un seul viewer de journaux (lot 3)", () => {
    it("le viewer unique importe la taxonomie", () => {
        const code = readFileSync("src/app/god/logs/log-viewer.tsx", "utf8");
        expect(code).toMatch(/from "@\/lib\/audit-taxonomy"/);
        expect(code).toMatch(/AUDIT_ACTION_FILTER_OPTIONS/);
    });

    it("le dashboard God ne monte plus de second journal (une seule porte)", () => {
        const page = readFileSync("src/app/god/page.tsx", "utf8");
        expect(page).not.toMatch(/AuditFeedPanel/);
        expect(page).toMatch(/requestedTab === "security"\) redirect/);
    });
});
