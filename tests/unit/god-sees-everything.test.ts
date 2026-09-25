/**
 * Lot 4 — **« le God voit tout »** (G7 · A4 · A5).
 *
 * Deux causes racines **mesurées par lecture du code**, avant correction :
 *  ① **lecture (A5)** : l'onglet Logs de la fiche guilde évaluait le God avec
 *     `getUserContext().canViewAuditLogs` — qui répond `false` pour un super-admin qui
 *     n'est **pas membre** du serveur Discord. D'où « *ce compte n'a pas la permission
 *     de lire le journal de cette guilde* » sous un en-tête « INSPECTION GOD MODE ».
 *  ② **écriture (A4)** : `createAuditLog` écrivait **toujours** `isGodLog: false` avec le
 *     `guildId` interne — une action du God sur un membre apparaissait donc dans le
 *     journal de **la guilde** (verbatim 10 : « les guildes ne doivent pas savoir que le
 *     God a accès à leurs logs »).
 *
 * Ce test verrouille : le routage de l'écriture (God ⇒ journal plateforme ; admin de
 * guilde / bot ⇒ journal de guilde), l'absence de trace God dans le journal de guilde,
 * et le fait que « erreur de chargement » ≠ « accès refusé ».
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/prisma", () => ({
    db: {
        auditLog: { create: vi.fn(), count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
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
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { createAuditLog, getAuditLogs } from "@/server/actions/audit-actions";

const mockDb = db as any;
const read = (path: string) => readFileSync(path, "utf8");
/** Code **sans commentaires** : une garde doit porter sur le code, pas sur un commentaire. */
const readCode = (path: string) =>
    read(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");

const GOD_ACTOR = { isAuthenticated: true, isAdmin: false, canManageMembers: false, isSuperAdmin: true, id: "god-1", name: "God" };
const GUILD_ADMIN = { isAuthenticated: true, isAdmin: true, canManageMembers: true, isSuperAdmin: true, id: "god-1", name: "God" };

describe("A4 — une action du God n'entre JAMAIS dans le journal d'une guilde", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth as any).mockResolvedValue({ user: { id: "god-1", name: "God" } });
        (isSuperAdmin as any).mockResolvedValue(true);
        (getUserContext as any).mockResolvedValue(GOD_ACTOR);
        mockDb.guildConfig.findUnique.mockResolvedValue({ id: "guild-internal-1" });
        mockDb.account.findFirst.mockResolvedValue({ providerAccountId: "123456789012345678" });
        mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });
    });

    it("super-admin sans autorité dans la guilde ⇒ journal plateforme (`isGodLog: true`, sans `guildId`)", async () => {
        await createAuditLog({
            guildId: "111111111111111111",
            actorUserId: "god-1",
            actorName: "God",
            action: "MEMBER_BANNED",
            targetType: "PROFILE",
            targetId: "user-1",
            metadata: { reason: "purge administrative" },
        });

        const data = mockDb.auditLog.create.mock.calls[0][0].data;
        expect(data.isGodLog).toBe(true);
        expect(data.guildId).toBeUndefined();
        // La guilde ciblée reste traçable… dans les métadonnées du journal plateforme.
        expect(data.metadata.discordGuildId).toBe("111111111111111111");
    });

    it("super-admin QUI EST admin de la guilde ⇒ journal de sa guilde (il n'agit pas en God)", async () => {
        (getUserContext as any).mockResolvedValue(GUILD_ADMIN);

        await createAuditLog({
            guildId: "111111111111111111",
            actorUserId: "god-1",
            actorName: "God",
            action: "PROFILE_REACTIVATED",
            targetType: "PROFILE",
            targetId: "user-1",
        });

        const data = mockDb.auditLog.create.mock.calls[0][0].data;
        expect(data.guildId).toBe("guild-internal-1");
        expect(data.isGodLog).toBeFalsy();
    });

    it("sans session (bot, cron) ⇒ journal de guilde, comme avant (aucun routage par accident)", async () => {
        (auth as any).mockResolvedValue(null);

        await createAuditLog({
            guildId: "111111111111111111",
            actorUserId: "bot",
            actorName: "Bot SigilOS",
            action: "WEBHOOK_MEMBER_ADD",
            targetType: "MEMBER",
            targetId: "user-1",
        });

        const data = mockDb.auditLog.create.mock.calls[0][0].data;
        expect(data.guildId).toBe("guild-internal-1");
        expect(data.isGodLog).toBeFalsy();
    });

    it("lecture d'une guilde : le `where` exclut les lignes God (aucune fuite en sens inverse)", async () => {
        (getUserContext as any).mockResolvedValue({ ...GUILD_ADMIN, canViewAuditLogs: true });
        mockDb.auditLog.count.mockResolvedValue(0);
        mockDb.auditLog.findMany.mockResolvedValue([]);

        await getAuditLogs("111111111111111111", { limit: 20, page: 1 });

        expect(mockDb.auditLog.count.mock.calls[0][0].where.isGodLog).toBe(false);
    });

    it("la règle est posée UNE fois, dans `createAuditLog` (pas un `if` par écran)", () => {
        const source = read("src/server/actions/audit-actions.ts");

        expect(source).toMatch(/isGodActorWithoutGuildAuthority/);
        // Les écrans ne décident pas du journal : aucun d'eux ne touche `isGodLog`.
        for (const file of ["src/components/admin/member-management-table.tsx", "src/app/god/guilds/[id]/page.tsx"]) {
            expect(read(file), file).not.toMatch(/isGodLog\s*:/);
        }
    });
});

describe("A5 — le God lit toujours, et un refus n'est jamais une erreur", () => {
    const page = read("src/app/god/guilds/[id]/page.tsx");

    it("la fiche guilde lit par `isGod`, jamais par `getUserContext().canViewAuditLogs`", () => {
        expect(page).toMatch(/isGod\s*\n?\s*\? getGlobalAuditLogs\(\{ guildConfigId, scope: "guild"/);
        expect(page).toMatch(/isGod=\{isAdmin\}/);
        // La cause racine ne doit plus exister dans la section Logs : plus AUCUN appel
        // à `getUserContext` pour décider de la lecture (son `canViewAuditLogs` répond
        // faux pour un God non-membre). Garde sur le CODE, pas sur les commentaires.
        const code = readCode("src/app/god/guilds/[id]/page.tsx");
        expect(code).not.toMatch(/getUserContext/);
        expect(code).not.toMatch(/canViewAuditLogs/);
    });

    it("« erreur de chargement » et « accès refusé » sont DEUX textes distincts", () => {
        expect(page).toMatch(/Erreur de chargement du journal/);
        expect(page).toMatch(/Accès refusé/);
        // Le refus n'est jamais affiché à un God (branche `isRefusal` gardée par `!isGod`).
        expect(page).toMatch(/const isRefusal = !isGod && result\.error === "Accès non autorisé"/);
    });

    it("la pagination du mode God passe par la route plateforme", () => {
        const client = read("src/app/dashboard/[guildId]/admin/logs/_components/audit-logs-client.tsx");

        expect(client).toMatch(/godGuildConfigId/);
        expect(client).toMatch(/\/api\/god\/audit-logs\?scope=guild&guildConfigId=/);
        // Le mode God n'est actif que si l'id interne est fourni (aucun changement côté guilde).
        expect(client).toMatch(/godGuildConfigId\?: string/);
    });

    it("la route God accepte les mêmes filtres que la route de guilde (acteur, dates)", () => {
        const route = read("src/app/api/god/audit-logs/route.ts");

        expect(route).toMatch(/actorFilter: actor/);
        expect(route).toMatch(/dateFrom,/);
        expect(route).toMatch(/dateTo,/);
    });
});
