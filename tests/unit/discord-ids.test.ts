/**
 * Règle partagée « identifiant de message Discord » (`@/lib/discord-ids`).
 *
 * Elle a coûté deux pannes en bêta, d'où ce verrou :
 *  - Status Discord (17/09/2026) : un `outbox:<jobId>` rejoué comme ID de message ;
 *  - Raids du calendrier (19/09/2026) : `GuildEvent.discordMessageId` valait
 *    `outbox:<jobId>` ⇒ chaque inscription PATCHait un message inexistant (404) et
 *    l'embed restait figé (compteur + inscrits) pendant que les joueurs s'inscrivaient.
 */

import { describe, it, expect } from "vitest";
import { discordIdKind, isDiscordSnowflake, isOutboxMessageId } from "@/lib/discord-ids";

describe("isDiscordSnowflake", () => {
    it("accepte les snowflakes Discord (15-21 chiffres)", () => {
        expect(isDiscordSnowflake("1468401237136707588")).toBe(true);
        expect(isDiscordSnowflake("1550539923084546179")).toBe(true);
        expect(isDiscordSnowflake("123456789012345")).toBe(true);
        expect(isDiscordSnowflake("123456789012345678901")).toBe(true);
    });

    it("rejette les IDs d'outbox, les valeurs vides et les non-chaînes", () => {
        expect(isDiscordSnowflake("outbox:abc123")).toBe(false);
        expect(isDiscordSnowflake(null)).toBe(false);
        expect(isDiscordSnowflake(undefined)).toBe(false);
        expect(isDiscordSnowflake("")).toBe(false);
        expect(isDiscordSnowflake("12345")).toBe(false);
        expect(isDiscordSnowflake(1550539923084546179)).toBe(false);
        expect(isDiscordSnowflake(" 1550539923084546179 ")).toBe(false);
    });
});

describe("isOutboxMessageId", () => {
    it("reconnaît un ID différé de la file d'écritures", () => {
        expect(isOutboxMessageId("outbox:12ab34")).toBe(true);
        expect(isOutboxMessageId("outbox:")).toBe(true);
    });

    it("ne confond jamais un snowflake avec un ID d'outbox", () => {
        expect(isOutboxMessageId("1550539923084546179")).toBe(false);
        expect(isOutboxMessageId(null)).toBe(false);
        expect(isOutboxMessageId(42)).toBe(false);
    });
});

describe("discordIdKind", () => {
    it("classe les valeurs stockées en base (pour les logs et les gardes)", () => {
        expect(discordIdKind("1550539923084546179")).toBe("snowflake");
        expect(discordIdKind("outbox:job-1")).toBe("outbox");
        expect(discordIdKind(null)).toBe("invalid");
        expect(discordIdKind("")).toBe("invalid");
    });
});
