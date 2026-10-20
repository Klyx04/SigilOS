/**
 * `getGuildMemberStats` — **une** requête pour la répartition par statut.
 *
 * Mesure du 19/10/2026 (`JAVASCRIPT-NEXTJS-1X`) : la page `/admin/members` était signalée
 * en « N+1 Query ». La cause n'était pas une boucle par ligne mais **trois `count`**
 * successifs sur `UserProfile` qui ne différaient que par la valeur du statut — invisible
 * dans le SQL paramétré (`status = $2`) ⇒ trois spans identiques dans la même transaction.
 *
 * Ce que ce test verrouille : ① un seul `groupBy` (plus aucun `count`) ; ② le contrat de
 * l'action ne change pas (active / archived / banned / total / maxMembers) ; ③ un statut
 * absent de la réponse vaut 0 ; ④ le garde reste fail-closed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockRequireGuildMember = vi.fn();
const guildConfigFindUnique = vi.fn();
const userProfileCount = vi.fn();
const userProfileGroupBy = vi.fn();

vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
vi.mock("@/server/actions/guards", () => ({
    requireGuildMember: (...args: unknown[]) => mockRequireGuildMember(...args),
}));
vi.mock("@/lib/prisma", () => ({
    db: {
        userProfile: {
            count: (...args: unknown[]) => userProfileCount(...args),
            groupBy: (...args: unknown[]) => userProfileGroupBy(...args),
        },
        guildConfig: { findUnique: (...args: unknown[]) => guildConfigFindUnique(...args) },
    },
}));
vi.mock("@/lib/redis", () => ({
    redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() },
}));
vi.mock("@/server/discord", () => ({
    fetchGuildRoles: vi.fn().mockResolvedValue([]),
    fetchGuild: vi.fn().mockResolvedValue(null),
    fetchGuildMember: vi.fn().mockResolvedValue(null),
    fetchGuildExists: vi.fn().mockResolvedValue(true),
    invalidateDiscordCache: vi.fn(),
}));
vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn().mockResolvedValue(false),
    isGuildAllowed: vi.fn().mockResolvedValue(true),
    isDiscordSuperAdmin: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/presence", () => ({
    PresenceManager: { updatePresence: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return { ...actual, cache: (fn: unknown) => fn };
});

import { getGuildMemberStats } from "@/server/actions/user-actions";

const GUILD_ID = "1290442961380835451";
const INTERNAL_ID = "b3f1c2d4-0000-4000-8000-000000000001";

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockRequireGuildMember.mockResolvedValue({ isAuthorized: true });
    guildConfigFindUnique.mockResolvedValue({ id: INTERNAL_ID, maxMembers: 350 });
});

describe("getGuildMemberStats — répartition par statut en une requête", () => {
    it("① un seul `groupBy` sur la guilde interne, aucun `count` séparé", async () => {
        userProfileGroupBy.mockResolvedValue([
            { status: "ACTIVE", _count: { _all: 12 } },
            { status: "ARCHIVED", _count: { _all: 3 } },
            { status: "BANNED", _count: { _all: 1 } },
        ]);

        const stats = await getGuildMemberStats(GUILD_ID);

        expect(userProfileGroupBy).toHaveBeenCalledTimes(1);
        expect(userProfileGroupBy).toHaveBeenCalledWith({
            by: ["status"],
            where: { guildId: INTERNAL_ID },
            _count: { _all: true },
        });
        expect(userProfileCount).not.toHaveBeenCalled();
        expect(stats).toEqual({ active: 12, archived: 3, banned: 1, total: 16, maxMembers: 350 });
    });

    it("② un statut absent de la réponse vaut zéro (pas de `undefined` dans les totaux)", async () => {
        userProfileGroupBy.mockResolvedValue([{ status: "ACTIVE", _count: { _all: 4 } }]);

        const stats = await getGuildMemberStats(GUILD_ID);

        expect(stats).toEqual({ active: 4, archived: 0, banned: 0, total: 4, maxMembers: 350 });
    });

    it("③ aucun profil ⇒ des zéros et la borne de guilde par défaut", async () => {
        guildConfigFindUnique.mockResolvedValue({ id: INTERNAL_ID, maxMembers: null });
        userProfileGroupBy.mockResolvedValue([]);

        const stats = await getGuildMemberStats(GUILD_ID);

        expect(stats).toEqual({ active: 0, archived: 0, banned: 0, total: 0, maxMembers: 350 });
    });

    it("④ le garde reste fail-closed : non autorisé ⇒ l'action refuse, sans requête", async () => {
        mockRequireGuildMember.mockResolvedValue({ isAuthorized: false, error: "Prohibited" });

        await expect(getGuildMemberStats(GUILD_ID)).rejects.toThrow("Prohibited");
        expect(userProfileGroupBy).not.toHaveBeenCalled();
    });
});
