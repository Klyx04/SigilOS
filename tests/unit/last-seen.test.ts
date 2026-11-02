/**
 * `touchLastSeen` — mesure d'activité **réelle** (D-A, décision du 02/11/2026).
 *
 * Ce que ce verrou protège :
 * 1. **au plus une écriture par heure** et par personne (throttle Redis `SET NX EX`) ;
 * 2. un échec d'écriture **libère la clé** : la prochaine requête réessaie ;
 * 3. Redis indisponible ⇒ on n'écrit pas (jamais de martèlement de la base).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ db: { user: { updateMany: vi.fn() } } }));
vi.mock("@/lib/redis", () => ({ redis: { set: vi.fn(), del: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { touchLastSeen } from "@/server/last-seen";

const mockDb = db as any;
const mockRedis = redis as any;
const NOW = new Date("2026-11-02T10:00:00.000Z");

beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.del.mockResolvedValue(1);
    mockDb.user.updateMany.mockResolvedValue({ count: 1 });
});

describe("touchLastSeen", () => {
    it("écrit la date une fois, avec un throttle d'une heure", async () => {
        const written = await touchLastSeen("user-1", NOW);

        expect(written).toBe(true);
        expect(mockRedis.set).toHaveBeenCalledWith("last-seen:user-1", "1", "EX", 3600, "NX");
        expect(mockDb.user.updateMany).toHaveBeenCalledWith({
            where: { id: "user-1" },
            data: { lastSeenAt: NOW },
        });
    });

    it("clé déjà posée ⇒ aucune écriture en base", async () => {
        mockRedis.set.mockResolvedValue(null);

        const written = await touchLastSeen("user-1", NOW);

        expect(written).toBe(false);
        expect(mockDb.user.updateMany).not.toHaveBeenCalled();
    });

    it("écriture impossible ⇒ la clé est libérée pour réessayer", async () => {
        mockDb.user.updateMany.mockRejectedValue(new Error("db down"));

        const written = await touchLastSeen("user-1", NOW);

        expect(written).toBe(false);
        expect(mockRedis.del).toHaveBeenCalledWith("last-seen:user-1");
    });

    it("Redis indisponible ⇒ on n'écrit pas et on ne jette pas", async () => {
        mockRedis.set.mockRejectedValue(new Error("redis down"));

        await expect(touchLastSeen("user-1", NOW)).resolves.toBe(false);
        expect(mockDb.user.updateMany).not.toHaveBeenCalled();
    });

    it("un identifiant vide ne touche à rien", async () => {
        await expect(touchLastSeen("", NOW)).resolves.toBe(false);
        expect(mockRedis.set).not.toHaveBeenCalled();
    });
});

describe("rétention des comptes — l'inactivité prime sur l'âge", () => {
    it("la sélection exige `lastSeenAt` nul ou plus vieux que la rétention", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const source = fs.readFileSync(
            path.resolve(__dirname, "../../src/server/account-retention-core.ts"),
            "utf8",
        );

        expect(source).toContain("OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }]");
        // La garde vit dans le WHERE, jamais dans une boucle après coup.
        const where = source.indexOf("lastSeenAt: { lt: cutoff }");
        const deleteCall = source.indexOf("db.user.delete(");
        expect(where).toBeGreaterThan(-1);
        expect(deleteCall).toBeGreaterThan(where);
    });
});
