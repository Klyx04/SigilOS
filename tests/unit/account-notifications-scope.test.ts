/**
 * Boîte de notifications du **compte** (rang 65, lot N1) — verrou de comportement.
 *
 * Ce que ce test protège :
 *  ① l'écriture plateforme est **explicite** (`guildId: null`) et bornée (Zod) ;
 *  ② la lecture est **celle du propriétaire**, plafonnée à 50 lignes ;
 *  ③ le marquage lu ne peut toucher que `userId` de session + `guildId: null` ;
 *  ④ le verrou `notification-guild-isolation` reste intact : la boîte compte est
 *    une branche séparée, pas un assouplissement du filtre de guilde.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NotificationCategory, NotificationType } from "@prisma/client";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/public-account", () => ({ getPublicSession: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        user: { findUnique: vi.fn(), update: vi.fn() },
        notification: {
            create: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/prisma", () => ({ db: mockDb }));

import { rateLimit } from "@/lib/ratelimit";
import { getPublicSession } from "@/server/public-account";
import {
    ACCOUNT_NOTIFICATION_MAX_TAKE,
    countUnreadAccountNotifications,
    createAccountNotification,
    getAccountNotificationsEnabled,
    listAccountNotifications,
} from "@/server/account-notifications";
import {
    markAccountNotificationRead,
    markAllAccountNotificationsRead,
    setAccountNotificationsEnabled,
} from "@/server/actions/account-notification-actions";

const mockedSession = getPublicSession as unknown as ReturnType<typeof vi.fn>;
const mockedRateLimit = rateLimit as unknown as ReturnType<typeof vi.fn>;

const baseInput = {
    userId: "user-1",
    type: NotificationType.SYSTEM_INFO,
    title: "Réponse à ton signalement",
    message: "Le God a répondu à ton signalement.",
    link: "/espace-visiteur/general",
} as const;

beforeEach(() => {
    vi.clearAllMocks();
    mockedSession.mockResolvedValue({ userId: "user-1" });
    mockedRateLimit.mockResolvedValue({
        success: true,
        remaining: 59,
        reset: Date.now() + 60_000,
    });
    mockDb.user.findUnique.mockResolvedValue({ accountNotificationsEnabled: true });
    mockDb.user.update.mockResolvedValue({});
    mockDb.notification.create.mockResolvedValue({ id: "notif-1" });
    mockDb.notification.findMany.mockResolvedValue([]);
    mockDb.notification.count.mockResolvedValue(0);
    mockDb.notification.updateMany.mockResolvedValue({ count: 1 });
});

describe("écriture : une notification de compte est explicitement sans guilde", () => {
    it("écrit `guildId: null` et la catégorie par défaut", async () => {
        const result = await createAccountNotification(baseInput);

        expect(result).toEqual({ success: true, id: "notif-1" });
        const data = mockDb.notification.create.mock.calls[0][0].data;
        expect(data.guildId).toBeNull();
        expect(data.userId).toBe("user-1");
        expect(data.category).toBe(NotificationCategory.SYSTEM);
    });

    it("assainit un asset hors application au lieu de le stocker", async () => {
        await createAccountNotification({
            ...baseInput,
            imageUrl: "https://exemple.test/image.png",
            imageKind: "INCONNU",
        });

        const data = mockDb.notification.create.mock.calls[0][0].data;
        expect(data.imageUrl).toBeNull();
        expect(data.imageKind).toBeNull();
    });

    it("refuse un titre hors bornes", async () => {
        const result = await createAccountNotification({
            ...baseInput,
            title: "x".repeat(161),
        });

        expect(result.success).toBe(false);
        expect(mockDb.notification.create).not.toHaveBeenCalled();
    });

    it("refuse un lien externe", async () => {
        const result = await createAccountNotification({
            ...baseInput,
            link: "https://exemple.test/signalement",
        });

        expect(result.success).toBe(false);
        expect(mockDb.notification.create).not.toHaveBeenCalled();
    });
});

describe("opt-out : le compte peut couper ses notifications", () => {
    it("n'écrit rien quand la préférence est désactivée", async () => {
        mockDb.user.findUnique.mockResolvedValue({ accountNotificationsEnabled: false });

        const result = await createAccountNotification(baseInput);

        expect(result).toEqual({ success: true, skipped: true });
        expect(mockDb.notification.create).not.toHaveBeenCalled();
    });

    it("annule l'envoi si la préférence est illisible (fail-closed)", async () => {
        mockDb.user.findUnique.mockRejectedValue(new Error("db down"));

        const result = await createAccountNotification(baseInput);

        expect(result.success).toBe(false);
        expect(mockDb.notification.create).not.toHaveBeenCalled();
    });

    it("lit la préférence du compte", async () => {
        mockDb.user.findUnique.mockResolvedValue({ accountNotificationsEnabled: false });

        await expect(getAccountNotificationsEnabled("user-1")).resolves.toBe(false);
    });

    it("enregistre le choix avec le userId de session", async () => {
        const result = await setAccountNotificationsEnabled(false);

        expect(result).toEqual({ success: true });
        expect(mockDb.user.update).toHaveBeenCalledWith({
            where: { id: "user-1" },
            data: { accountNotificationsEnabled: false },
        });
    });

    it("refuse le choix sans session", async () => {
        mockedSession.mockResolvedValue(null);

        const result = await setAccountNotificationsEnabled(true);

        expect(result.success).toBe(false);
        expect(mockDb.user.update).not.toHaveBeenCalled();
    });

    it("refuse le choix quand le rate limit est atteint", async () => {
        mockedRateLimit.mockResolvedValue({ success: false, remaining: 0, reset: 0 });

        const result = await setAccountNotificationsEnabled(true);

        expect(result.success).toBe(false);
        expect(mockDb.user.update).not.toHaveBeenCalled();
    });
});

describe("lecture : uniquement la boîte du propriétaire, bornée", () => {
    it("borne `take` à 50 et ne demande que `userId` + `guildId: null`", async () => {
        mockDb.notification.findMany.mockResolvedValue([
            {
                id: "n1",
                userId: "user-1",
                guildId: null,
                title: "Titre",
                message: "Message",
                type: "SYSTEM_INFO",
                category: "SYSTEM",
                read: false,
                link: null,
                createdAt: new Date("2026-11-15T10:00:00Z"),
                imageUrl: null,
                imageKind: null,
                user: { image: null },
            },
        ]);
        mockDb.notification.count.mockImplementation((args: { where: { read?: boolean } }) =>
            Promise.resolve(args.where.read === false ? 3 : 12)
        );

        const page = await listAccountNotifications("user-1", { take: 500, skip: -10 });

        const args = mockDb.notification.findMany.mock.calls[0][0];
        expect(args.where).toEqual({ userId: "user-1", guildId: null });
        expect(args.take).toBe(ACCOUNT_NOTIFICATION_MAX_TAKE);
        expect(args.skip).toBe(0);
        expect(args.orderBy).toEqual({ createdAt: "desc" });
        expect(page.total).toBe(12);
        expect(page.unread).toBe(3);
        expect(page.items[0]?.actorImage).toBeNull();
    });

    it("compte les non-lues de la seule boîte compte", async () => {
        mockDb.notification.count.mockResolvedValue(4);

        const unread = await countUnreadAccountNotifications("user-1");

        expect(unread).toBe(4);
        expect(mockDb.notification.count).toHaveBeenCalledWith({
            where: { userId: "user-1", guildId: null, read: false },
        });
    });
});

describe("marquage : le propriétaire seulement, jamais une guilde", () => {
    it("refuse sans session visiteur", async () => {
        mockedSession.mockResolvedValue(null);

        const result = await markAccountNotificationRead("n1");

        expect(result.success).toBe(false);
        expect(mockDb.notification.updateMany).not.toHaveBeenCalled();
    });

    it("refuse quand le rate limit est atteint", async () => {
        mockedRateLimit.mockResolvedValue({
            success: false,
            remaining: 0,
            reset: Date.now() + 60_000,
        });

        const result = await markAccountNotificationRead("n1");

        expect(result.success).toBe(false);
        expect(mockDb.notification.updateMany).not.toHaveBeenCalled();
    });

    it("refuse un identifiant vide ou hors bornes", async () => {
        const empty = await markAccountNotificationRead("");
        const tooLong = await markAccountNotificationRead("x".repeat(65));

        expect(empty.success).toBe(false);
        expect(tooLong.success).toBe(false);
        expect(mockDb.notification.updateMany).not.toHaveBeenCalled();
    });

    it("marque avec `userId` de session + `guildId: null`", async () => {
        const result = await markAccountNotificationRead("n1");

        expect(result.success).toBe(true);
        expect(mockDb.notification.updateMany).toHaveBeenCalledWith({
            where: { id: "n1", userId: "user-1", guildId: null },
            data: { read: true },
        });
    });

    it("dit introuvable quand la notification n'appartient pas au compte", async () => {
        mockDb.notification.updateMany.mockResolvedValue({ count: 0 });

        const result = await markAccountNotificationRead("n1");

        expect(result.success).toBe(false);
        expect(result.error).toContain("introuvable");
    });

    it("marque tout lu dans la seule boîte compte", async () => {
        mockDb.notification.updateMany.mockResolvedValue({ count: 4 });

        const result = await markAllAccountNotificationsRead();

        expect(result).toEqual({ success: true, count: 4 });
        expect(mockDb.notification.updateMany).toHaveBeenCalledWith({
            where: { userId: "user-1", guildId: null, read: false },
            data: { read: true },
        });
    });
});

describe("cloisonnement : la boîte compte ne rouvre pas le filtre de guilde", () => {
    const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

    /** Retire les commentaires : la doc du lot **cite** les symboles interdits. */
    function codeOnly(source: string): string {
        return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    }

    it("le module compte écrit `guildId: null` sans passer par createNotification", () => {
        const code = codeOnly(read("src/server/account-notifications.ts"));

        expect(code).toContain("guildId: null");
        expect(code).not.toContain("buildGuildScopeFilter");
        expect(code).not.toContain("createNotification");
        expect(code).not.toContain("notification-actions");
    });

    it("notification-actions.ts n'a toujours aucune branche `guildId: null`", () => {
        const code = codeOnly(read("src/server/actions/notification-actions.ts"));

        expect(code).not.toContain("{ guildId: null }");
    });
});
