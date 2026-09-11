/**
 * Module « Marché » — tests du **compteur public** d'offres (S4.7).
 *
 * Contrat vérifié :
 *   1. seules les offres `PENDING` comptent (`ACCEPTED` / `DECLINED` /
 *      `CANCELLED` / `EXPIRED` sont hors négociation, §11.4) ;
 *   2. la requête ne lit **rien** d'autre qu'un `count` filtré sur l'annonce et
 *      le statut : ni montant, ni troc, ni note, ni pseudo (§13.7) ;
 *   3. un échec BDD renvoie `0` et trace, sans jamais jeter (S3.6) — l'embed de
 *      l'annonce n'est jamais perdu à cause du compteur.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
    db: { marketOffer: { count: vi.fn() } },
}));

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { countPendingMarketOffers } from "@/server/market/counters";

const LISTING_ID = "cm5marketlisting0001";
const countMock = db.marketOffer.count as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    countMock.mockResolvedValue(0);
});

describe("market compteur public d'offres (S4.7)", () => {
    it("compte uniquement les offres PENDING de l'annonce demandée", async () => {
        countMock.mockResolvedValue(3);

        const result = await countPendingMarketOffers(LISTING_ID);

        expect(result).toBe(3);
        expect(countMock).toHaveBeenCalledTimes(1);
        expect(countMock).toHaveBeenCalledWith({ where: { listingId: LISTING_ID, status: "PENDING" } });
    });

    it("ne lit jamais montant, troc, note ni pseudo d'acheteur (§13.7)", async () => {
        await countPendingMarketOffers(LISTING_ID);

        const args = countMock.mock.calls[0][0] as Record<string, unknown>;

        // Un `count` sans `select`/`include` : rien d'autre que le nombre ne peut sortir.
        expect(Object.keys(args)).toEqual(["where"]);
        expect(args).not.toHaveProperty("select");
        expect(args).not.toHaveProperty("include");

        const where = args.where as Record<string, unknown>;
        expect(Object.keys(where).sort()).toEqual(["listingId", "status"]);
        // Aucun filtre ni champ privé dans la requête.
        for (const forbidden of [
            "offeredKamas",
            "tradeDescription",
            "note",
            "buyerProfileId",
            "buyerUserId",
        ]) {
            expect(where).not.toHaveProperty(forbidden);
            expect(args).not.toHaveProperty(forbidden);
        }
    });

    it("exclut tout statut terminal du compteur (jamais de filtre élargi)", async () => {
        await countPendingMarketOffers(LISTING_ID);

        const where = countMock.mock.calls[0][0].where as { status: unknown };
        expect(where.status).toBe("PENDING");
        // Les statuts terminaux ne sont donc **jamais** admis dans le compteur.
        for (const terminal of ["ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED"]) {
            expect(where.status).not.toBe(terminal);
        }
    });

    it("retombe sur 0 (et trace) si la BDD échoue — l'annonce reste affichable (S3.6)", async () => {
        countMock.mockRejectedValue(new Error("db down"));

        const result = await countPendingMarketOffers(LISTING_ID);

        expect(result).toBe(0);
        expect(logger.warn).toHaveBeenCalled();
    });
});
