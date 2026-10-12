/**
 * Module « Marché » — tests des **tags de forum** (D20 / S3.13, §9.4).
 *
 * Ce que ces tests verrouillent :
 *   1. **aucun tag inventé** — seules des clés connues et des ids bornés sont
 *      conservés (`normalizeMarketForumTags`) ; un id **absent** du salon est
 *      écarté (`restrictMarketForumTags`, fail-closed) ;
 *   2. **famille + statut** résolus pour un état donné, dédoublonnés et bornés à
 *      **5 tags** (limite Discord) ;
 *   3. **mapping vide / état non couvert ⇒ `[]`** : publication normale, sans
 *      tag et sans erreur (§9.4).
 */

import { describe, it, expect } from "vitest";
import {
    MARKET_FORUM_TAG_KEYS,
    MARKET_FORUM_TAG_LABELS,
    MARKET_FORUM_TAGS_MAX,
    isMarketForumTagKey,
    normalizeMarketForumTags,
    resolveMarketForumTags,
    restrictMarketForumTags,
} from "@/lib/market/forum-tags";

describe("market forum tags — normalisation (jamais de valeur libre)", () => {
    it("ne conserve que les clés connues et les ids exploitables", () => {
        const result = normalizeMarketForumTags({
            EQUIPMENT: "111111111111111111",
            ACTIVE: "222222222222222222",
            INCONNU: "333333333333333333",
            RESERVED: 42,
            SOLD: "",
            WITHDRAWN: "   ",
        });

        expect(result).toEqual({
            EQUIPMENT: "111111111111111111",
            ACTIVE: "222222222222222222",
        });
    });

    it("ignore une valeur inexploitable sans lever (fail-soft)", () => {
        expect(normalizeMarketForumTags(null)).toEqual({});
        expect(normalizeMarketForumTags("EQUIPMENT")).toEqual({});
        expect(normalizeMarketForumTags([])).toEqual({});
        expect(normalizeMarketForumTags(undefined)).toEqual({});
    });

    it("dédoublonne un id appliqué à deux clés et borne sa longueur", () => {
        const result = normalizeMarketForumTags({
            EQUIPMENT: "444444444444444444",
            RESOURCE: "444444444444444444",
            ACTIVE: "5".repeat(80),
        });

        expect(result.EQUIPMENT).toBe("444444444444444444");
        expect(result.RESOURCE).toBeUndefined();
        expect((result.ACTIVE ?? "").length).toBeLessThanOrEqual(32);
    });

    it("expose des libellés FR pour chaque clé (union fermée)", () => {
        expect(Object.keys(MARKET_FORUM_TAG_LABELS).sort()).toEqual([...MARKET_FORUM_TAG_KEYS].sort());
        expect(isMarketForumTagKey("ACTIVE")).toBe(true);
        expect(isMarketForumTagKey("DRAFT")).toBe(false);
    });
});

describe("market forum tags — restriction aux tags du salon (fail-closed)", () => {
    it("écarte un id qui n'existe pas dans `available_tags`", () => {
        const result = restrictMarketForumTags(
            { EQUIPMENT: "111111111111111111", ACTIVE: "999999999999999999" },
            ["111111111111111111"]
        );

        expect(result).toEqual({ EQUIPMENT: "111111111111111111" });
    });

    it("renvoie un mapping vide quand le salon n'a aucun tag", () => {
        expect(restrictMarketForumTags({ ACTIVE: "111111111111111111" }, [])).toEqual({});
    });
});

describe("market forum tags — résolution pour un état d'annonce", () => {
    const mapping = {
        EQUIPMENT: "111111111111111111",
        RESOURCE: "222222222222222222",
        ACTIVE: "333333333333333333",
        RESERVED: "444444444444444444",
        SOLD: "555555555555555555",
    };

    it("applique la famille puis le statut", () => {
        expect(resolveMarketForumTags(mapping, { type: "EQUIPMENT", status: "RESERVED" })).toEqual([
            "111111111111111111",
            "444444444444444444",
        ]);
        expect(resolveMarketForumTags(mapping, { type: "RESOURCE", status: "ACTIVE" })).toEqual([
            "222222222222222222",
            "333333333333333333",
        ]);
    });

    it("suit le changement de statut (le tag applicatif est recalculé en entier)", () => {
        const sold = resolveMarketForumTags(mapping, { type: "EQUIPMENT", status: "SOLD" });
        expect(sold).toEqual(["111111111111111111", "555555555555555555"]);
        // L'ancien tag de statut n'est **plus** dans l'ensemble envoyé à Discord.
        expect(sold).not.toContain("333333333333333333");
    });

    it("ne renvoie rien pour un état non couvert par le mapping (publication normale)", () => {
        expect(resolveMarketForumTags(mapping, { type: "EQUIPMENT", status: "WITHDRAWN" })).toEqual([
            "111111111111111111",
        ]);
        expect(resolveMarketForumTags({}, { type: "EQUIPMENT", status: "ACTIVE" })).toEqual([]);
        expect(resolveMarketForumTags(null, { type: "EQUIPMENT", status: "ACTIVE" })).toEqual([]);
        expect(resolveMarketForumTags(mapping, { type: "SERVICE", status: "DRAFT" })).toEqual([]);
    });

    it("dédoublonne et borne à 5 tags (limite Discord)", () => {
        const duplicated = resolveMarketForumTags(
            { EQUIPMENT: "111111111111111111", ACTIVE: "111111111111111111" },
            { type: "EQUIPMENT", status: "ACTIVE" }
        );
        expect(duplicated).toEqual(["111111111111111111"]);

        expect(MARKET_FORUM_TAGS_MAX).toBe(5);
    });
});
