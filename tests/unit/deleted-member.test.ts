/**
 * Compte technique « Ancien membre » (option C, 30/10/2026) — cas **réels** sur base mockée.
 *
 * Ce que ces cas verrouillent :
 *  ① on supprime le compte **sans perdre** les événements de la guilde ;
 *  ② un événement encore ouvert est **annulé** au passage (pas de raid vivant sans pilote) ;
 *  ③ un **miroir** agenda n'est jamais annulé ici (il suit sa source) mais il est bien recopié ;
 *  ④ le nom du capitaine (`metadata.raidCaptain`) disparaît aussi, sinon une fiche raid
 *    réafficherait l'identité purgée ;
 *  ⑤ le compte technique est **protégé** de la purge (sinon la cascade emporterait tout).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    db: {
        user: { upsert: vi.fn() },
        guildEvent: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    },
}));

import { db } from "@/lib/prisma";
import {
    DELETED_MEMBER_NAME,
    DELETED_MEMBER_USER_ID,
    ensureDeletedMemberUser,
    isDeletedMemberUser,
    reattributeGuildEvents,
} from "@/server/deleted-member";

const dbMock = db as unknown as {
    user: { upsert: ReturnType<typeof vi.fn> };
    guildEvent: {
        findMany: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };
};

const MIRROR = { source: { kind: "DJ", djPostId: "post-1", mode: "DONJON" } };
const RAID = { raidCaptain: "Jean", raidCaptainId: "usr_jean", raidType: "gigalodon" };

beforeEach(() => {
    vi.clearAllMocks();
    dbMock.user.upsert.mockResolvedValue({ id: DELETED_MEMBER_USER_ID });
    dbMock.guildEvent.updateMany.mockResolvedValue({ count: 1 });
    dbMock.guildEvent.update.mockResolvedValue({});
});

describe("Compte technique « Ancien membre »", () => {
    it("l'identifiant est fixe et la comparaison est stricte", () => {
        expect(DELETED_MEMBER_USER_ID).toBe("system-deleted-member");
        expect(DELETED_MEMBER_NAME).toBe("Ancien membre");
        expect(isDeletedMemberUser(DELETED_MEMBER_USER_ID)).toBe(true);
        expect(isDeletedMemberUser("system-deleted-member ")).toBe(false);
        expect(isDeletedMemberUser("usr_abc")).toBe(false);
        expect(isDeletedMemberUser(null)).toBe(false);
        expect(isDeletedMemberUser(undefined)).toBe(false);
    });

    it("est créé de façon idempotente, sans e-mail ni compte OAuth", async () => {
        await ensureDeletedMemberUser();
        const args = dbMock.user.upsert.mock.calls[0][0];
        expect(args.where).toEqual({ id: DELETED_MEMBER_USER_ID });
        expect(args.create).toEqual({ id: DELETED_MEMBER_USER_ID, name: DELETED_MEMBER_NAME });
        // Le nom est réaffirmé : un renommage manuel ne doit pas réafficher un pseudo.
        expect(args.update).toEqual({ name: DELETED_MEMBER_NAME });
        expect(args.create.email).toBeUndefined();
        expect(args.create.accounts).toBeUndefined();
    });
});

describe("reattributeGuildEvents — la guilde garde l'événement, pas l'identité", () => {
    it("annule les events ouverts du membre, jamais un miroir, puis recopie tout", async () => {
        dbMock.guildEvent.findMany.mockResolvedValue([
            { id: "ev-live", status: "PUBLISHED", metadata: null },
            { id: "ev-draft", status: "DRAFT", metadata: null },
            { id: "ev-mirror", status: "PUBLISHED", metadata: MIRROR },
            { id: "ev-done", status: "COMPLETED", metadata: null },
        ]);

        const result = await reattributeGuildEvents("usr_partant");

        // ① Annulation : uniquement les deux events **directs** ouverts.
        const cancelCall = dbMock.guildEvent.updateMany.mock.calls[0][0];
        expect(cancelCall.where).toEqual({ id: { in: ["ev-live", "ev-draft"] }, status: { in: ["DRAFT", "PUBLISHED"] } });
        expect(cancelCall.data).toEqual({ status: "CANCELLED" });

        // ② Recopie : TOUS les events du compte, miroir compris (l'historique reste).
        const moveCall = dbMock.guildEvent.updateMany.mock.calls[1][0];
        expect(moveCall.where).toEqual({ creatorId: "usr_partant" });
        expect(moveCall.data).toEqual({ creatorId: DELETED_MEMBER_USER_ID });

        // L'annulation précède la recopie (sinon on déplacerait un event encore vivant).
        expect(dbMock.guildEvent.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
            dbMock.guildEvent.updateMany.mock.invocationCallOrder[1]
        );

        expect(result).toEqual({ moved: 1, cancelled: 1, captainScrubbed: 0 });
    });

    it("remplace le nom du capitaine dans le JSON quand il y est", async () => {
        dbMock.guildEvent.findMany.mockResolvedValue([{ id: "ev-raid", status: "COMPLETED", metadata: RAID }]);

        const result = await reattributeGuildEvents("usr_partant");

        expect(dbMock.guildEvent.update).toHaveBeenCalledWith({
            where: { id: "ev-raid" },
            data: { metadata: { raidCaptain: DELETED_MEMBER_NAME, raidCaptainId: null, raidType: "gigalodon" } },
        });
        expect(result.captainScrubbed).toBe(1);
    });

    it("ne touche pas aux events sans nom de capitaine", async () => {
        dbMock.guildEvent.findMany.mockResolvedValue([
            { id: "ev-simple", status: "COMPLETED", metadata: { missionIds: [] } },
            { id: "ev-null", status: "COMPLETED", metadata: null },
        ]);

        const result = await reattributeGuildEvents("usr_partant");

        expect(dbMock.guildEvent.update).not.toHaveBeenCalled();
        expect(result.captainScrubbed).toBe(0);
    });
});
