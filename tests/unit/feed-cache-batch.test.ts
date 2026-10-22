/**
 * Cache du feed agrégé — purge et écriture doivent viser **les mêmes lignes**.
 *
 * Défaut mesuré le 22/10/2026 (Sentry `JAVASCRIPT-NEXTJS-24`, « N+1 Query ») : la purge
 * ne couvrait pas YouTube, donc chaque vidéo devait être réécrite par un `upsert`
 * individuel (`Promise.all`, une requête par contenu). Ces tests verrouillent la règle
 * qui permet une écriture **en lot** sans perdre de famille au passage.
 */

import { describe, it, expect } from "vitest";
import {
    FEED_CACHE_OWNED_CREATORS,
    FEED_CACHE_OWNED_TYPES,
    FEED_CACHE_PURGE_WHERE,
    dedupeFeedCacheRows,
    feedCacheKey,
    isFeedCacheRowOwned,
} from "@/lib/feed-cache";

type Row = { type: string; creatorId: string; url: string };

/** Évalue le filtre Prisma de purge sur une ligne — même sémantique qu'un `OR`. */
function matchesPurgeWhere(row: Row): boolean {
    return FEED_CACHE_PURGE_WHERE.OR.some((clause) => {
        if ("type" in clause) return clause.type.in.includes(row.type);
        return clause.creatorId.in.includes(row.creatorId);
    });
}

describe("isFeedCacheRowOwned", () => {
    it("couvre Twitch et YouTube quel que soit le créateur", () => {
        expect(isFeedCacheRowOwned("TWITCH", "huzounet")).toBe(true);
        expect(isFeedCacheRowOwned("YOUTUBE", "Huzounet")).toBe(true);
    });

    it("couvre les actualités des créateurs agrégés, quel que soit le type", () => {
        expect(isFeedCacheRowOwned("NEWS", "Ankama")).toBe(true);
        expect(isFeedCacheRowOwned("NEWS", "DPLN")).toBe(true);
    });

    it("laisse vivre le cache de changelog (30 min, hors feed)", () => {
        expect(isFeedCacheRowOwned("NEWS", "Dofus-Changelog")).toBe(false);
    });

    it("ne réclame aucun créateur de guilde ou de joueur", () => {
        expect(isFeedCacheRowOwned("NEWS", "Guild-42")).toBe(false);
        expect(isFeedCacheRowOwned("TWITCH", "Ankama")).toBe(true); // par le type
    });

    it("ne purge pas une famille inconnue", () => {
        expect(isFeedCacheRowOwned("PODCAST", "inconnu")).toBe(false);
    });
});

describe("FEED_CACHE_PURGE_WHERE", () => {
    it("purge exactement ce que la règle pure annonce", () => {
        const rows: Row[] = [
            { type: "TWITCH", creatorId: "huzounet", url: "u1" },
            { type: "YOUTUBE", creatorId: "Huzounet", url: "u2" },
            { type: "NEWS", creatorId: "Ankama", url: "u3" },
            { type: "NEWS", creatorId: "DPLN", url: "u4" },
            { type: "NEWS", creatorId: "Dofus-Changelog", url: "u5" },
            { type: "PODCAST", creatorId: "inconnu", url: "u6" },
        ];

        for (const row of rows) {
            expect(matchesPurgeWhere(row), `${row.type}/${row.creatorId}`).toBe(
                isFeedCacheRowOwned(row.type, row.creatorId)
            );
        }
    });

    it("ne cite que les familles déclarées", () => {
        expect(FEED_CACHE_PURGE_WHERE.OR).toHaveLength(2);
        expect(FEED_CACHE_OWNED_TYPES).toEqual(["TWITCH", "YOUTUBE"]);
        expect(FEED_CACHE_OWNED_CREATORS).toEqual(["Ankama", "DPLN"]);
    });
});

describe("dedupeFeedCacheRows", () => {
    it("ne garde qu'une ligne par clé type/creatorId/url", () => {
        const rows: Row[] = [
            { type: "YOUTUBE", creatorId: "Huzounet", url: "https://youtu.be/abc" },
            { type: "YOUTUBE", creatorId: "Huzounet", url: "https://youtu.be/abc" },
            { type: "YOUTUBE", creatorId: "Huzounet", url: "https://youtu.be/def" },
        ];

        expect(dedupeFeedCacheRows(rows)).toHaveLength(2);
    });

    it("garde la dernière occurrence (la plus fraîche)", () => {
        const rows = [
            { type: "TWITCH", creatorId: "huzounet", url: "u", title: "ancien" },
            { type: "TWITCH", creatorId: "huzounet", url: "u", title: "récent" },
        ];

        expect(dedupeFeedCacheRows(rows)[0].title).toBe("récent");
    });

    it("ne confond pas deux créateurs qui partagent une URL", () => {
        const rows: Row[] = [
            { type: "NEWS", creatorId: "Ankama", url: "https://dofus.com/x" },
            { type: "NEWS", creatorId: "DPLN", url: "https://dofus.com/x" },
        ];

        expect(dedupeFeedCacheRows(rows)).toHaveLength(2);
    });

    it("conserve l'ordre d'apparition des clés", () => {
        const rows: Row[] = [
            { type: "TWITCH", creatorId: "a", url: "1" },
            { type: "TWITCH", creatorId: "b", url: "2" },
        ];

        expect(dedupeFeedCacheRows(rows).map((row) => row.creatorId)).toEqual(["a", "b"]);
    });

    it("ne modifie pas le lot reçu", () => {
        const rows: Row[] = [{ type: "TWITCH", creatorId: "a", url: "1" }];
        dedupeFeedCacheRows(rows);
        expect(rows).toHaveLength(1);
    });
});

describe("feedCacheKey", () => {
    it("sépare les trois segments par un caractère absent des identifiants", () => {
        expect(feedCacheKey({ type: "TWITCH", creatorId: "a", url: "u" })).toContain("\u0000");
    });
});
