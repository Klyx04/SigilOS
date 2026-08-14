import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/redis", () => ({
    redis: {
        publish: vi.fn(),
    },
}));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { redis } from "@/lib/redis";
import { dofusChannel, publishDofusEvent } from "@/lib/dofus-realtime";

describe("dofus-realtime (#37 — page par-Dofus)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(redis.publish).mockResolvedValue(1);
    });

    afterEach(() => vi.restoreAllMocks());

    it("dofusChannel concatène guildId + slug", () => {
        expect(dofusChannel("1290442961380835451", "ocre")).toBe("dofus:1290442961380835451:ocre");
        expect(dofusChannel("g1", "rush-sylvestre")).toBe("dofus:g1:rush-sylvestre");
    });

    it("publishDofusEvent publie sur le canal dofus:<guildId>:<slug>", async () => {
        const payload = {
            type: "quest:status" as const,
            profileId: "p1",
            userName: "Klyx",
            questId: "q1",
            status: "COMPLETED",
        };

        const ok = await publishDofusEvent("1290442961380835451", "ocre", payload);

        expect(ok).toBe(true);
        expect(redis.publish).toHaveBeenCalledWith("dofus:1290442961380835451:ocre", JSON.stringify(payload));
    });

    it("publishDofusEvent ne lève JAMAIS quand Redis échoue (fail-closed)", async () => {
        vi.mocked(redis.publish).mockRejectedValue(new Error("redis down"));

        const ok = await publishDofusEvent("g1", "s", {
            type: "quest:status",
            profileId: "p1",
            userName: "Membre",
            questId: "q1",
            status: "IN_PROGRESS",
        });

        expect(ok).toBe(false);
    });
});
