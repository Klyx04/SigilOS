import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AUD-03 (audit 13/11/2026) — `/api/storage/[...path]` ne doit **jamais** utiliser
 * `getUserContext()` sans argument comme bypass : il résout la guilde d'accueil
 * (`DISCORD_GUILD_ID`) et son `isAdmin` suffisait à lire les preuves privées de
 * toutes les guildes. Seul God est exempté ; tout autre utilisateur doit être
 * membre de la guilde **cible**.
 */

const m = vi.hoisted(() => ({
    auth: vi.fn(),
    isSuperAdmin: vi.fn(),
    getUserContext: vi.fn(),
    existsSync: vi.fn(),
    readFile: vi.fn(),
    guildFindUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/server/actions/super-admin-actions", () => ({ isSuperAdmin: m.isSuperAdmin }));
vi.mock("@/server/actions/user-actions", () => ({ getUserContext: m.getUserContext }));
vi.mock("fs", () => ({ existsSync: m.existsSync }));
vi.mock("fs/promises", () => ({ readFile: m.readFile }));
vi.mock("@/lib/prisma", () => ({
    db: { guildConfig: { findUnique: m.guildFindUnique } },
}));

import { GET } from "@/app/api/storage/[...path]/route";

function req() {
    return { nextUrl: { searchParams: new URLSearchParams() } } as any;
}
function ctx(path: string[]) {
    return { params: Promise.resolve({ path }) } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ user: { id: "user-1" } });
    m.isSuperAdmin.mockResolvedValue(false);
    m.existsSync.mockReturnValue(true);
    m.readFile.mockResolvedValue(Buffer.from("ok"));
    m.guildFindUnique.mockResolvedValue({ discordGuildId: "discord-B" });
});

describe("GET /api/storage — isolation de guilde (proofs)", () => {
    it("refuse un admin de la guilde d'accueil sur les preuves de la guilde B", async () => {
        // Avant le correctif, `getUserContext()` (sans argument) renvoyait isAdmin=true
        // et sautait entièrement le contrôle d'appartenance.
        m.getUserContext.mockResolvedValue({ isMember: false, isAdmin: true });

        const res = await GET(req(), ctx(["proofs", "guild-B", "preuve.webp"]));

        expect(res.status).toBe(403);
        expect(m.readFile).not.toHaveBeenCalled();
        // La cible est bien résolue côté serveur (CUID → discordGuildId).
        expect(m.guildFindUnique).toHaveBeenCalledWith({
            where: { id: "guild-B" },
            select: { discordGuildId: true },
        });
        expect(m.getUserContext).toHaveBeenCalledWith("discord-B");
    });

    it("autorise un membre de la guilde cible", async () => {
        m.getUserContext.mockResolvedValue({ isMember: true });

        const res = await GET(req(), ctx(["proofs", "guild-B", "preuve.webp"]));

        expect(res.status).toBe(200);
        expect(m.readFile).toHaveBeenCalledTimes(1);
    });

    it("autorise God sans exiger l'appartenance", async () => {
        m.isSuperAdmin.mockResolvedValue(true);

        const res = await GET(req(), ctx(["proofs", "guild-B", "preuve.webp"]));

        expect(res.status).toBe(200);
        expect(m.getUserContext).not.toHaveBeenCalled();
    });

    it("refuse (fail-closed) une cible inconnue", async () => {
        m.guildFindUnique.mockResolvedValue(null);

        const res = await GET(req(), ctx(["proofs", "guild-inconnue", "preuve.webp"]));

        expect(res.status).toBe(403);
        expect(m.getUserContext).not.toHaveBeenCalled();
        expect(m.readFile).not.toHaveBeenCalled();
    });
});
