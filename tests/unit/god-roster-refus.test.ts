/**
 * Roster God — **refus propre** (jamais une exception dans une Server Component).
 *
 * 🐛 Constat du 12/10/2026 : `getGuildMembersForGod` levait `new Error("Unauthorized")`.
 * Or son seul appelant est la **Server Component** `/god/guilds/[id]` : un `throw` y fait
 * tomber **tout l'écran** (« Application error ») et ouvre une Issue Sentry à chaque clic,
 * là où le produit doit dire « accès refusé ».
 *
 * 🔒 Ce verrou protège la doctrine :
 *  ① **fail-closed** : le refus est renvoyé **avant** toute lecture (mesuré : `findMany`
 *     n'est jamais appelé) — aucune donnée de guilde ne peut fuir ;
 *  ② **contrat explicite** : `{ ok: false, error }` (et non un tableau vide, qui mentirait) ;
 *  ③ le chemin normal reste **intact** : un super-admin reçoit `{ ok: true, ownerId, members }`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsSuperAdmin = vi.fn();
const mockCanAccessBrick = vi.fn();
const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: (...args: unknown[]) => mockIsSuperAdmin(...args),
    canAccessBrick: (...args: unknown[]) => mockCanAccessBrick(...args),
    canGodAccess: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
    db: {
        userProfile: { findMany: (...args: unknown[]) => mockFindMany(...args) },
        guildConfig: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    },
}));

import { getGuildMembersForGod } from "@/server/actions/god-lifecycle-actions";

const PROFILE = {
    id: "p1",
    userId: "u1",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    archivedAt: null,
    archiveReason: null,
    pseudoDofus: "Sigil",
    discordNickname: "sigil#1",
    scheduledDeletion: null,
    user: { name: "Sigil", image: null, accounts: [{ providerAccountId: "42" }] },
};

describe("getGuildMembersForGod — refus propre au lieu d'une exception", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("refuse SANS lire la base (ni God ni brique « guilds »)", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        mockCanAccessBrick.mockResolvedValue(false);

        const res = await getGuildMembersForGod("guild-1");

        expect(res.ok).toBe(false);
        if (res.ok) throw new Error("un refus était attendu");
        expect(res.error).toContain("Accès refusé");
        // Fail-closed : la garde tombe avant toute requête.
        expect(mockFindMany).not.toHaveBeenCalled();
        expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("sert le roster quand la brique « guilds » suffit (sous-god, lecture seule)", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        mockCanAccessBrick.mockResolvedValue(true);
        mockFindMany.mockResolvedValue([PROFILE]);
        mockFindUnique.mockResolvedValue({ ownerId: "u1" });

        const res = await getGuildMembersForGod("guild-1");

        expect(res.ok).toBe(true);
        if (!res.ok) throw new Error("un succès était attendu");
        expect(res.ownerId).toBe("u1");
        expect(res.members).toHaveLength(1);
        expect(res.members[0].pseudoDofus).toBe("Sigil");
        expect(res.members[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
        expect(typeof res.members[0].user.name).toBe("string");
    });
});
