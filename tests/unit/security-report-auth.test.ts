import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AUD-01 / AUD-06 (audit 13/11/2026) — `reportSecurityIncident` est l'unique
 * point d'entrée client pour une alerte sécurité :
 *  - session obligatoire ;
 *  - appartenance à la guilde **cible** obligatoire (le `guildId` vient du client) ;
 *  - la notification God est créée côté serveur, en `webOnly` (pas de doublon
 *    Discord) et **sans** `forceChannelId` contrôlable par l'appelant.
 */

const m = vi.hoisted(() => ({
    auth: vi.fn(),
    getUserContext: vi.fn(),
    rateLimit: vi.fn(),
    notifyGod: vi.fn(),
    sendSecurityAlert: vi.fn(),
    isSuperAdmin: vi.fn(),
    guildFindUnique: vi.fn(),
    auditCreate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/server/actions/user-actions", () => ({ getUserContext: m.getUserContext }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/server/god-notifications", () => ({ notifyGod: m.notifyGod }));
vi.mock("@/server/discord", () => ({ sendSecurityAlert: m.sendSecurityAlert }));
vi.mock("@/server/actions/super-admin-actions", () => ({ isSuperAdmin: m.isSuperAdmin }));
vi.mock("next/headers", () => ({
    headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));
vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: m.guildFindUnique },
        auditLog: { create: m.auditCreate },
    },
}));

import { reportSecurityIncident } from "@/server/actions/audit-actions";

beforeEach(() => {
    vi.clearAllMocks();
    m.rateLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });
    m.notifyGod.mockResolvedValue({ success: true });
    m.sendSecurityAlert.mockResolvedValue(undefined);
    m.isSuperAdmin.mockResolvedValue(false);
    m.guildFindUnique.mockResolvedValue({ id: "guild-internal-A", name: "Guilde A" });
    m.auditCreate.mockResolvedValue({ id: "log-1" });
});

describe("reportSecurityIncident — autorisation et notification God", () => {
    it("refuse sans session et n'écrit rien", async () => {
        m.auth.mockResolvedValue(null);

        const res = await reportSecurityIncident("guild-A", "NSFW_BLOCKED", "test");

        expect(res).toEqual({ success: false, error: "Unauthorized" });
        expect(m.guildFindUnique).not.toHaveBeenCalled();
        expect(m.auditCreate).not.toHaveBeenCalled();
        expect(m.notifyGod).not.toHaveBeenCalled();
    });

    it("refuse un non-membre de la guilde cible (le guildId vient du client)", async () => {
        m.auth.mockResolvedValue({ user: { id: "user-1", name: "Visiteur" } });
        m.getUserContext.mockResolvedValue({ isMember: false, name: "Visiteur" });

        const res = await reportSecurityIncident("guild-B", "NSFW_BLOCKED", "faux incident");

        expect(res).toEqual({ success: false, error: "Forbidden" });
        expect(m.guildFindUnique).not.toHaveBeenCalled();
        expect(m.auditCreate).not.toHaveBeenCalled();
        expect(m.notifyGod).not.toHaveBeenCalled();
    });

    it("accepte un membre et crée la notification God côté serveur (webOnly, sans forceChannelId)", async () => {
        m.auth.mockResolvedValue({ user: { id: "user-1", name: "Membre" } });
        m.getUserContext.mockResolvedValue({ isMember: true, name: "Membre", isAdmin: false });

        const res = await reportSecurityIncident("guild-A", "NSFW_BLOCKED", "contenu bloqué");

        expect(res).toEqual({ success: true });
        expect(m.auditCreate).toHaveBeenCalledTimes(1);
        expect(m.notifyGod).toHaveBeenCalledTimes(1);

        const arg = m.notifyGod.mock.calls[0][0];
        expect(arg.type).toBe("SECURITY_ALERT");
        expect(arg.webOnly).toBe(true);
        expect(arg.forceChannelId).toBeUndefined();
        expect(arg.ping).toBeUndefined();
    });
});
