/**
 * God — fiche guilde : résolution du propriétaire (règles pures).
 * `ownerId` peut être un snowflake Discord **ou** un UUID interne : l'écran ne devine pas.
 */

import { describe, it, expect } from "vitest";
import {
    buildAnkamaLadderUrl,
    isDiscordSnowflake,
    resolveGuildOwnerLookup,
} from "@/lib/god-guild-owner";

describe("isDiscordSnowflake", () => {
    it("reconnaît un snowflake de 17 à 20 chiffres", () => {
        expect(isDiscordSnowflake("12345678901234567")).toBe(true);
        expect(isDiscordSnowflake("12345678901234567890")).toBe(true);
    });

    it("refuse un UUID, un texte ou un snowflake trop court", () => {
        expect(isDiscordSnowflake("cmtqbvuyi001wswogpl3be0jp")).toBe(false);
        expect(isDiscordSnowflake("1234")).toBe(false);
        expect(isDiscordSnowflake("")).toBe(false);
        expect(isDiscordSnowflake(null)).toBe(false);
    });
});

describe("resolveGuildOwnerLookup", () => {
    it("cherche par ID Discord quand c'est un snowflake", () => {
        expect(resolveGuildOwnerLookup("12345678901234567890")).toEqual({
            by: "discord",
            value: "12345678901234567890",
        });
    });

    it("cherche par User.id quand c'est un UUID/cuid", () => {
        expect(resolveGuildOwnerLookup("cmtqbvuyi001wswogpl3be0jp")).toEqual({
            by: "user",
            value: "cmtqbvuyi001wswogpl3be0jp",
        });
    });

    it("refuse une valeur vide", () => {
        expect(resolveGuildOwnerLookup("   ")).toBeNull();
        expect(resolveGuildOwnerLookup(null)).toBeNull();
    });
});

describe("buildAnkamaLadderUrl", () => {
    it("construit l'URL avec serveur et pseudo encodé", () => {
        expect(buildAnkamaLadderUrl("Wyla", 295)).toBe(
            "https://www.dofus.com/fr/mmorpg/communaute/ladder/succes?server=295&name=Wyla",
        );
        expect(buildAnkamaLadderUrl("Nom & co", 295)).toContain("name=Nom%20%26%20co");
    });

    it("ne construit rien sans pseudo ou serveur exploitable", () => {
        expect(buildAnkamaLadderUrl(null, 295)).toBeNull();
        expect(buildAnkamaLadderUrl("   ", 295)).toBeNull();
        expect(buildAnkamaLadderUrl("Wyla", null)).toBeNull();
        expect(buildAnkamaLadderUrl("Wyla", 0)).toBeNull();
        expect(buildAnkamaLadderUrl("Wyla", 295.5)).toBeNull();
    });
});
