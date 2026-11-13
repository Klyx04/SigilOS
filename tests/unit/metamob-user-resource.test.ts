import { describe, expect, it } from "vitest";
import { isUserResourceFromUrl } from "@/lib/metamob-client";

describe("Metamob — une ressource privée ne partage jamais le cache", () => {
    it("classe /v1/quests (la liste) comme privée — correctif du 11/11/2026", () => {
        expect(isUserResourceFromUrl("/v1/quests")).toBe(true);
        expect(isUserResourceFromUrl("/v1/quests/abc/matches?limit=50")).toBe(true);
    });

    it("garde /v1/me, /users/ et les conversations privés", () => {
        expect(isUserResourceFromUrl("/v1/me")).toBe(true);
        expect(isUserResourceFromUrl("/v1/users/Wylaen/quests")).toBe(true);
        expect(isUserResourceFromUrl("/v1/conversations")).toBe(true);
    });

    it("laisse publics les référentiels qui commencent pareil", () => {
        expect(isUserResourceFromUrl("/v1/quest-types")).toBe(false);
        expect(isUserResourceFromUrl("/v1/quest-templates/1")).toBe(false);
        expect(isUserResourceFromUrl("/v1/monsters")).toBe(false);
        expect(isUserResourceFromUrl("/v1/servers")).toBe(false);
    });
});
