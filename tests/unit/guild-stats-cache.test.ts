/**
 * `guild-stats-cache` — clé cloisonnée par guilde et TTL borné (2–5 min).
 *
 * Les statistiques de guilde sont des agrégats (`count`/`aggregate`) : elles peuvent
 * être servies 3 min sans retarder une donnée personnelle. Le TTL reste une constante
 * unique, et la clé ne doit jamais perdre le `guildId` (isolation multi-tenant).
 */
import { describe, expect, it } from "vitest";

import { GUILD_STATS_CACHE_TTL_SECONDS, guildStatsCacheKey } from "@/lib/guild-stats-cache";

describe("cache des statistiques de guilde", () => {
    it("garde un TTL entre 2 et 5 minutes", () => {
        expect(GUILD_STATS_CACHE_TTL_SECONDS).toBeGreaterThanOrEqual(120);
        expect(GUILD_STATS_CACHE_TTL_SECONDS).toBeLessThanOrEqual(300);
    });

    it("cloisonne la clé par guilde", () => {
        expect(guildStatsCacheKey("guild-a")).toBe("guild:stats:guild-a");
        expect(guildStatsCacheKey("guild-a")).not.toBe(guildStatsCacheKey("guild-b"));
    });
});
