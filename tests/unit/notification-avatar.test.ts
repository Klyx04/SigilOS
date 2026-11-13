/**
 * Notification — l'avatar de l'émetteur et l'asset de l'objet remontent dans la lecture.
 *
 * 🛡️ Ce que ce test protège (demande user du 15/10/2026 : « ajouter l'icône Discord de la
 * personne, les assets si un Dofus a été validé ou un DJ ») :
 * ① la lecture demande **une** jointure sur `User.image` (pas de colonne dupliquée : `userId`
 *    existait déjà) et l'avatar est remonté **à plat** (`actorImage`) — sinon l'écran ne peut
 *    pas l'afficher et le `include` serait un aller-retour payé pour rien ;
 * ② la colonne `imageUrl` est transmise telle quelle (le chemin est validé à l'**écriture**,
 *    par `createNotification` — cf. `notification-categories.test.ts`) ;
 * ③ le filtre RBAC `ADMIN_ALERT` reste appliqué après ce changement (non-régression : ce
 *    filtre est la seule raison pour laquelle une notification d'administration ne fuit pas).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({
    // `set`/`del` rendent une promesse : la production chaîne `.catch()` dessus (un `vi.fn()`
    // nu rendrait `undefined` ⇒ `.catch is not a function` et la lecture échouerait en silence).
    redis: {
        del: vi.fn().mockResolvedValue(1),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
    },
}));

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        guildConfig: { findUnique: vi.fn() },
        notification: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/prisma", () => ({ db: mockDb }));

import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { getUnreadNotifications } from "@/server/actions/notification-actions";

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedCtx = getUserContext as unknown as ReturnType<typeof vi.fn>;

/** Ligne Prisma telle que la jointure la renvoie (avatar imbriqué dans `user`). */
function row(overrides: Record<string, unknown> = {}) {
    return {
        id: "n1",
        userId: "user-1",
        guildId: "guild-1",
        title: "Nouvelle candidature DJ",
        message: "X a rejoint ton groupe",
        type: "SYSTEM_INFO",
        category: "DONJONS",
        read: false,
        link: "/dashboard/guild-1/donjons-et-quetes",
        createdAt: new Date("2026-10-15T10:00:00.000Z"),
        imageUrl: null,
        imageKind: null,
        user: { image: null },
        ...overrides,
    };
}

describe("getUnreadNotifications — avatar + asset", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
        mockedCtx.mockResolvedValue({ isMember: true, isAdmin: false });
        mockDb.guildConfig.findUnique.mockResolvedValue(null);
        mockDb.notification.findMany.mockResolvedValue([]);
    });

    it("demande l'avatar de l'émetteur dans la requête (une jointure, pas une colonne)", async () => {
        await getUnreadNotifications("guild-1");
        expect(mockDb.notification.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                include: { user: { select: { image: true } } },
            })
        );
    });

    it("remonte l'avatar à plat et conserve l'asset de l'objet", async () => {
        mockDb.notification.findMany.mockResolvedValue([
            row({
                user: { image: "https://cdn.discordapp.com/avatars/1/abc.png" },
                imageUrl: "/api/assets-dofus/items/32239",
                imageKind: "ITEM",
            }),
        ]);

        const res = await getUnreadNotifications("guild-1");

        expect(res.success).toBe(true);
        expect(res.data).toHaveLength(1);
        expect(res.data?.[0].actorImage).toBe("https://cdn.discordapp.com/avatars/1/abc.png");
        expect(res.data?.[0].imageUrl).toBe("/api/assets-dofus/items/32239");
        expect(res.data?.[0].imageKind).toBe("ITEM");
        // Le champ imbriqué Prisma ne part pas au client : la vue est plate.
        expect(res.data?.[0]).not.toHaveProperty("user");
    });

    it("reste lisible sans avatar ni asset (repli sur le picto de catégorie)", async () => {
        mockDb.notification.findMany.mockResolvedValue([row()]);

        const res = await getUnreadNotifications("guild-1");

        expect(res.data?.[0].actorImage).toBeNull();
        expect(res.data?.[0].imageUrl).toBeNull();
    });

    it("applique toujours le filtre RBAC des notifications administratives", async () => {
        mockDb.notification.findMany.mockResolvedValue([
            row({ id: "admin-1", category: "ADMIN_ALERT" }),
            row({ id: "mission-1", category: "MISSION" }),
        ]);

        const res = await getUnreadNotifications("guild-1");

        expect(res.data?.map((n) => n.id)).toEqual(["mission-1"]);
    });

    it("laisse passer les notifications administratives à un admin", async () => {
        mockedCtx.mockResolvedValue({ isMember: true, isAdmin: true });
        mockDb.notification.findMany.mockResolvedValue([row({ id: "admin-1", category: "ADMIN_ALERT" })]);

        const res = await getUnreadNotifications("guild-1");

        expect(res.data?.map((n) => n.id)).toEqual(["admin-1"]);
    });
});
