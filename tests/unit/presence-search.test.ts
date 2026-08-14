/**
 * ─────────────────────────────────────────────────────────────
 * Tests Unitaires : searchGuildMembers (chantier #36)
 * Recherche de membres scopée guilde depuis « Membres En Ligne »
 * ─────────────────────────────────────────────────────────────
 * Chemins critiques :
 *   1. Validation Zod (query < 2 car, caractères de contrôle, guildId invalide)
 *   2. Fail-closed : non-auth / non-membre / sans canViewRoster → []
 *   3. Guild isolation : requête Prisma toujours scopée guildId + ACTIVE
 *   4. Mapping des résultats (slug, name, lien lecture seule)
 *   5. Erreur DB → [] (jamais de throw vers le client)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks — AVANT les imports du module testé ───────────────

vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
    db: {
        userProfile: { findMany: vi.fn() },
    },
}));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ─── Imports après les mocks ──────────────────────────────────

import { getUserContext } from "@/server/actions/user-actions";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { searchGuildMembers } from "@/server/actions/search-actions";

const GUILD_ID = "111111111111111111"; // 18 chiffres (snowflake)

const mockCtx = (overrides: Record<string, unknown> = {}) => ({
    isAuthenticated: true,
    isMember: true,
    canViewRoster: true,
    id: "user-1",
    name: "Test",
    ...overrides,
});

describe("searchGuildMembers — sécurité & isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getUserContext as any).mockResolvedValue(mockCtx());
        (db.userProfile.findMany as any).mockResolvedValue([]);
    });

    it("rejette une query trop courte (< 2 caractères) sans requêter la BDD", async () => {
        const res = await searchGuildMembers(GUILD_ID, "a");
        expect(res).toEqual([]);
        expect(db.userProfile.findMany).not.toHaveBeenCalled();
    });

    it("rejette une query contenant des caractères de contrôle", async () => {
        const res = await searchGuildMembers(GUILD_ID, "a\u0000bc");
        expect(res).toEqual([]);
        expect(db.userProfile.findMany).not.toHaveBeenCalled();
    });

    it("rejette un guildId non snowflake (pas de fail-open sur la guilde)", async () => {
        const res = await searchGuildMembers("abc", "wylan");
        expect(res).toEqual([]);
        expect(db.userProfile.findMany).not.toHaveBeenCalled();
    });

    it("fail-closed : utilisateur non authentifié → [] + warn logger", async () => {
        (getUserContext as any).mockResolvedValue(mockCtx({ isAuthenticated: false, isMember: false }));
        const res = await searchGuildMembers(GUILD_ID, "wylan");
        expect(res).toEqual([]);
        expect(db.userProfile.findMany).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it("fail-closed : non-membre de la guilde → []", async () => {
        (getUserContext as any).mockResolvedValue(mockCtx({ isMember: false }));
        const res = await searchGuildMembers(GUILD_ID, "wylan");
        expect(res).toEqual([]);
        expect(db.userProfile.findMany).not.toHaveBeenCalled();
    });

    it("fail-closed : membre sans canViewRoster → []", async () => {
        (getUserContext as any).mockResolvedValue(mockCtx({ canViewRoster: false }));
        const res = await searchGuildMembers(GUILD_ID, "wylan");
        expect(res).toEqual([]);
        expect(db.userProfile.findMany).not.toHaveBeenCalled();
    });

    it("isolation multi-tenant : requête scopée guildId + ACTIVE uniquement", async () => {
        (db.userProfile.findMany as any).mockResolvedValue([]);
        await searchGuildMembers(GUILD_ID, "wylan");

        const where = (db.userProfile.findMany as any).mock.calls[0][0].where;
        expect(where.guild.discordGuildId).toBe(GUILD_ID);
        expect(where.status).toBe("ACTIVE");
        expect(where.OR).toBeDefined();
        // bornes : max 8 résultats
        expect((db.userProfile.findMany as any).mock.calls[0][0].take).toBe(8);
    });

    it("mappe correctement les résultats (nom, pseudo, classe, slug)", async () => {
        (db.userProfile.findMany as any).mockResolvedValue([
            { id: "p1", discordNickname: "Wylan", pseudoDofus: "Wylan", classe: "Iop", ankamaId: "wylan", user: { image: "img.png" } },
        ]);

        const res = await searchGuildMembers(GUILD_ID, "wylan");
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
            profileId: "p1",
            name: "Wylan",
            image: "img.png",
            pseudoDofus: "Wylan",
            classe: "Iop",
            slug: "Wylan",
        });
    });

    it("slug fallback sur l'id quand pas de pseudo/nick (lien lecture seule valide)", async () => {
        (db.userProfile.findMany as any).mockResolvedValue([
            { id: "p2", discordNickname: null, pseudoDofus: null, classe: null, ankamaId: null, user: { image: null } },
        ]);

        const res = await searchGuildMembers(GUILD_ID, "zzz");
        expect(res[0].slug).toBe("p2");
        expect(res[0].name).toBe("Membre");
    });

    it("erreur BDD → [] (jamais de throw vers le client)", async () => {
        (db.userProfile.findMany as any).mockRejectedValue(new Error("db down"));
        const res = await searchGuildMembers(GUILD_ID, "wylan");
        expect(res).toEqual([]);
        expect(logger.error).toHaveBeenCalled();
    });
});
