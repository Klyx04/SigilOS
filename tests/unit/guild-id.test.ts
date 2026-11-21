/**
 * `guild-id` — résolution unique de l'id interne d'une guilde.
 *
 * La page d'accueil du dashboard lisait `GuildConfig` 5 à 6 fois pour le même `id`.
 * Ce verrou garantit : une seule lecture par guilde (cache mémoire 5 min) et **aucune**
 * mémorisation d'un `null` (une guilde créée après le premier appel doit être résolue).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: {
            findUnique: (...args: unknown[]) => findUniqueMock(...args),
        },
    },
}));

import { getInternalGuildId } from "@/server/guild-id";

describe("getInternalGuildId", () => {
    beforeEach(() => {
        findUniqueMock.mockReset();
    });

    it("résout l'id une seule fois pour une même guilde", async () => {
        findUniqueMock.mockResolvedValue({ id: "internal-1" });

        const first = await getInternalGuildId("discord-cache-1");
        const second = await getInternalGuildId("discord-cache-1");

        expect(first).toBe("internal-1");
        expect(second).toBe("internal-1");
        expect(findUniqueMock).toHaveBeenCalledTimes(1);
    });

    it("ne mémorise pas un null : la guilde créée ensuite est résolue", async () => {
        findUniqueMock
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "internal-2" });

        expect(await getInternalGuildId("discord-cache-2")).toBeNull();
        expect(await getInternalGuildId("discord-cache-2")).toBe("internal-2");
        expect(findUniqueMock).toHaveBeenCalledTimes(2);
    });
});
