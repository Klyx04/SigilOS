/**
 * Repérage d'un message Discord par ses composants (`@/lib/discord-components`).
 *
 * Cas réel (bêta, 19/09/2026) : l'embed d'un raid portait
 * `GuildEvent.discordMessageId = outbox:<jobId>` (ID de file jamais converti) :
 * impossible de le PATCHer. Retrouver le message dans le salon par son bouton
 * `calendar:join:<eventId>` est le seul moyen de réparer le lien — d'où ce
 * module pur, borné et tolérant aux structures incomplètes (données Discord).
 */

import { describe, it, expect } from "vitest";
import { componentCustomIds, messageHasCustomId } from "@/lib/discord-components";

/** Composants d'un embed de raid : 2 boutons + 1 menu classe. */
const RAID_COMPONENTS = [
    {
        type: 1,
        components: [
            { type: 2, custom_id: "calendar:join:evt1" },
            { type: 2, custom_id: "calendar:leave:evt1" },
        ],
    },
    {
        type: 1,
        components: [{ type: 3, custom_id: "calendar:class:evt1" }],
    },
];

describe("componentCustomIds", () => {
    it("liste les custom_id de toutes les rangées", () => {
        expect(componentCustomIds(RAID_COMPONENTS)).toEqual([
            "calendar:join:evt1",
            "calendar:leave:evt1",
            "calendar:class:evt1",
        ]);
    });

    it("tolère les structures incomplètes ou hostiles (données Discord)", () => {
        expect(componentCustomIds(undefined)).toEqual([]);
        expect(componentCustomIds(null)).toEqual([]);
        expect(componentCustomIds("nope")).toEqual([]);
        expect(componentCustomIds([{ type: 1 }, { type: 1, components: "x" }])).toEqual([]);
        expect(componentCustomIds([{ components: [{ custom_id: 42 }, { custom_id: "" }] }])).toEqual([]);
        expect(componentCustomIds([null, undefined, { components: [null, { custom_id: "ok" }] }])).toEqual(["ok"]);
    });
});

describe("messageHasCustomId", () => {
    it("reconnaît le marqueur d'un événement donné", () => {
        expect(messageHasCustomId(RAID_COMPONENTS, "calendar:join:evt1")).toBe(true);
        expect(messageHasCustomId(RAID_COMPONENTS, "calendar:class:evt1")).toBe(true);
    });

    it("ne confond jamais deux événements (aucun faux repérage)", () => {
        expect(messageHasCustomId(RAID_COMPONENTS, "calendar:join:evt2")).toBe(false);
        expect(messageHasCustomId([], "calendar:join:evt1")).toBe(false);
        expect(messageHasCustomId(undefined, "calendar:join:evt1")).toBe(false);
    });
});
