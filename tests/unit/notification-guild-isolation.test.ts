/**
 * Notifications — **cloisonnement par guilde, verrouillé par le comportement**.
 *
 * 🛡️ Ce que ce test protège (audit du 15/10/2026, mesuré en base bêta) :
 *
 * ① **aucune notification ne naît sans guilde.** Avant, une guilde non résolue produisait une
 *    ligne `guildId: null` **et sautait le contrôle de préférences** (il était niché dans le
 *    `if (internalGuildId)`) : une annonce impossible à couper, visible dans **toutes** les
 *    guildes du destinataire. Mesure : 7 340 lignes sans guilde sur 11 722 (63 %) — **toutes
 *    antérieures au 03/08/2026** (commit `0b1c592d`, qui a introduit l'isolation) ;
 * ② **la lecture ne mélange plus les guildes** : la branche `guildId: null` du filtre de scope
 *    (« notifications globales, rétrocompatibilité ») est retirée — c'était le **seul** chemin
 *    par lequel une notification d'une guilde pouvait s'afficher dans une autre, et sur ce chemin
 *    le garde RBAC des `ADMIN_ALERT` était évalué avec le contexte de la guilde **consultée** ;
 * ③ **une lecture ou une écriture sans guilde est refusée** (fail-closed), au lieu de retomber
 *    silencieusement sur « toutes les guildes de la personne ».
 *
 * Exposition mesurée avant correctif : **0 destinataire multi-guilde sur 81** ⇒ pas de fuite
 * effective ; le correctif ferme la porte **avant** le premier membre multi-guilde.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/server/actions/user-actions", () => ({ getUserContext: vi.fn() }));
vi.mock("@/lib/redis", () => ({
    redis: {
        del: vi.fn().mockResolvedValue(1),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
    },
}));

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        guildConfig: { findUnique: vi.fn() },
        userProfile: { findUnique: vi.fn() },
        notification: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    },
}));

vi.mock("@/lib/prisma", () => ({ db: mockDb }));

import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { getUserContext } from "@/server/actions/user-actions";
import {
    createNotification,
    getUnreadNotifications,
    markAllAsRead,
} from "@/server/actions/notification-actions";

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedCtx = getUserContext as unknown as ReturnType<typeof vi.fn>;
const mockedWarn = logger.warn as unknown as ReturnType<typeof vi.fn>;

/** Id Discord (long) que `resolveInternalGuildId` tente de résoudre, sans succès ici. */
const UNRESOLVABLE_DISCORD_ID = "1468401079120171069";

describe("écriture : aucune notification sans guilde", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
        mockedCtx.mockResolvedValue({ isMember: true, isAdmin: true });
        mockDb.guildConfig.findUnique.mockResolvedValue(null);
        mockDb.userProfile.findUnique.mockResolvedValue(null);
        mockDb.notification.create.mockResolvedValue({ id: "n1" });
    });

    it("REFUSE d'écrire quand l'identifiant Discord n'existe pas dans GuildConfig", async () => {
        // `resolveInternalGuildId` rend l'entrée **telle quelle** quand la recherche échoue : un
        // snowflake long inchangé n'est pas un id interne. Avant ce correctif, Prisma rejetait la
        // clé étrangère et l'annonce disparaissait dans un `logger.error` générique.
        mockDb.guildConfig.findUnique.mockResolvedValue(null);

        await createNotification(
            "user-1",
            "SYSTEM_INFO",
            "Titre",
            "Message",
            "/dashboard/x",
            UNRESOLVABLE_DISCORD_ID
        );

        expect(mockDb.notification.create).not.toHaveBeenCalled();
        expect(mockedWarn).toHaveBeenCalled();
    });

    it("convertit un snowflake Discord en identifiant interne quand la guilde existe", async () => {
        mockDb.guildConfig.findUnique.mockResolvedValue({ id: "internal-guild-1" });

        await createNotification(
            "user-1",
            "SYSTEM_INFO",
            "Titre",
            "Message",
            "/dashboard/x",
            UNRESOLVABLE_DISCORD_ID
        );

        const data = mockDb.notification.create.mock.calls[0][0].data;
        expect(data.guildId).toBe("internal-guild-1");
        expect(data.guildId).not.toBe(UNRESOLVABLE_DISCORD_ID);
    });

    it("REFUSE d'écrire quand aucune guilde n'est fournie", async () => {
        await createNotification("user-1", "SYSTEM_INFO", "Titre", "Message");

        expect(mockDb.notification.create).not.toHaveBeenCalled();
    });

    it("écrit avec la guilde interne quand elle est résolue (id interne court)", async () => {
        await createNotification("user-1", "SYSTEM_INFO", "Titre", "Message", "/lien", "guild-1");

        expect(mockDb.notification.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ guildId: "guild-1", userId: "user-1" }),
            })
        );
        const data = mockDb.notification.create.mock.calls[0][0].data;
        expect(data.guildId).toBe("guild-1");
    });

    it("le contrôle de PRÉFÉRENCES s'applique désormais aussi (il était contourné sans guilde)", async () => {
        mockDb.userProfile.findUnique.mockResolvedValue({ notificationPrefs: { donjons: false } });

        await createNotification("user-1", "SYSTEM_INFO", "Groupe", "Message", "/lien", "guild-1", "DONJONS");

        expect(mockDb.notification.create).not.toHaveBeenCalled();
    });
});


describe("lecture : strictement la guilde consultée", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
        mockedCtx.mockResolvedValue({ isMember: true, isAdmin: false });
        mockDb.guildConfig.findUnique.mockResolvedValue(null);
        mockDb.notification.findMany.mockResolvedValue([]);
        mockDb.notification.updateMany.mockResolvedValue({ count: 0 });
    });

    it("refuse la lecture sans guilde (au lieu de tout renvoyer)", async () => {
        const res = await getUnreadNotifications(undefined);

        expect(res.success).toBe(false);
        expect(mockDb.notification.findMany).not.toHaveBeenCalled();
    });

    it("ne demande JAMAIS les lignes sans guilde (plus de branche de rétrocompatibilité)", async () => {
        await getUnreadNotifications("guild-1");

        const where = mockDb.notification.findMany.mock.calls[0][0].where;
        expect(where.guildId).toBe("guild-1");
        expect(where).not.toHaveProperty("OR");
        expect(JSON.stringify(where)).not.toContain("null");
    });

    it("refuse de tout marquer comme lu sans guilde", async () => {
        await markAllAsRead(undefined);

        expect(mockDb.notification.updateMany).not.toHaveBeenCalled();
    });
});

describe("aucun émetteur ne passe une guilde nulle", () => {
    const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

    it("les 3 sites corrigés passent la guilde résolue ou n'écrivent rien", () => {
        // `|| null` / `|| ""` sur un identifiant de guilde = le trou refermé par accident.
        expect(read("src/server/actions/geoguesser-multi-actions.ts")).not.toMatch(
            /guildId:\s*guildConfig\?\.id\s*\|\|\s*null/
        );
        expect(read("src/workers/metamob-worker.ts")).not.toMatch(/guildId:\s*guild\?\.id\s*\|\|\s*null/);
        expect(read("src/server/actions/dungeon-finder-actions.ts")).not.toContain('joinGuildId || ""');
    });

    it("le filtre de scope ne contient plus la branche de rétrocompatibilité", () => {
        const source = read("src/server/actions/notification-actions.ts");
        // Le commentaire du lot **cite** `guildId: null` : on lit le code sans ses commentaires.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        expect(code).not.toContain("{ guildId: null }");
    });
});
