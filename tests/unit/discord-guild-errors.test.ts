import { describe, it, expect } from "vitest";
import { isGuildUnavailableError } from "@/lib/discord-guild-errors";

describe("isGuildUnavailableError", () => {
    it("classifie 404 (bot kické / guilde supprimée) en fail-soft", () => {
        expect(isGuildUnavailableError(new Error("Discord API error: 404 (Not Found)"))).toBe(true);
        expect(isGuildUnavailableError(new Error("1545599253949325322: Discord API error: 404 (Not Found)"))).toBe(true);
    });

    it("classifie 403 (intent coupé) en fail-soft", () => {
        expect(
            isGuildUnavailableError(
                new Error("Discord API Forbidden (403): Le bot n'a probablement pas l'intent 'Server Members' activé.")
            )
        ).toBe(true);
    });

    it("laisse les erreurs transitoires en échec (fail-closed)", () => {
        expect(isGuildUnavailableError(new Error("Discord API error: 500 (Internal Server Error)"))).toBe(false);
        expect(isGuildUnavailableError(new Error("Discord API error: 429 (Too Many Requests)"))).toBe(false);
        expect(isGuildUnavailableError(new Error("fetch failed"))).toBe(false);
        expect(isGuildUnavailableError(new Error("DISCORD_BOT_TOKEN not configured"))).toBe(false);
        expect(isGuildUnavailableError(undefined)).toBe(false);
    });
});
