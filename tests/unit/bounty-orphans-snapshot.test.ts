/**
 * Instantané « avis orphelins » (`get/setBountyOrphansSnapshot`, 09/10/2026).
 *
 * Écrit par les passes COMPLETES d'avis (cron phase 4, worker BOUNTIES), lu par God
 * pour la revue + exclusion en masse. Fail-open : Redis indisponible ⇒ absent, jamais
 * d'exception. Redis est mocké en mémoire : aucun réseau, aucun serveur.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mem, mockGet, mockSet } = vi.hoisted(() => {
    const mem = new Map<string, string>();
    const mockGet = vi.fn(async (k: string) => mem.get(k) ?? null);
    const mockSet = vi.fn(async (k: string, v: string) => {
        mem.set(k, v);
        return "OK";
    });
    return { mem, mockGet, mockSet };
});

vi.mock("@/lib/redis", () => ({
    redis: {
        get: (...args: unknown[]) => (mockGet as (...a: string[]) => Promise<string | null>)(...(args as string[])),
        set: (...args: unknown[]) =>
            (mockSet as (...a: string[]) => Promise<unknown>)(...(args as string[])),
        mget: async (...keys: string[]) => keys.map((k) => mem.get(k) ?? null),
    },
}));

import {
    getBountyOrphansSnapshot,
    setBountyOrphansSnapshot,
} from "@/server/game-data-sync-state-store";

beforeEach(() => {
    mem.clear();
    vi.clearAllMocks();
});

describe("instantané orphelins — persistance God", () => {
    it("absent tant qu'aucune passe complète ne l'a écrit", async () => {
        await expect(getBountyOrphansSnapshot()).resolves.toBeNull();
    });

    it("aller-retour : écrit puis relu à l'identique, avec date ISO et TTL 7 j", async () => {
        await setBountyOrphansSnapshot(
            [{ id: "junk-1", dofusdbId: 99999, name: "Faux Avis", slug: "faux-avis" }],
            2,
        );

        expect(mockSet).toHaveBeenCalledTimes(1);
        const [key, , mode, ttl] = mockSet.mock.calls[0] as unknown[];
        expect(key).toBe("game-data:bounties:orphans");
        expect(mode).toBe("EX");
        expect(ttl).toBe(7 * 24 * 3600);

        await expect(getBountyOrphansSnapshot()).resolves.toMatchObject({
            total: 2,
            orphans: [{ id: "junk-1", dofusdbId: 99999, name: "Faux Avis", slug: "faux-avis" }],
        });
        const snap = await getBountyOrphansSnapshot();
        expect(snap?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("fail-open et tolérant : JSON corrompu ⇒ null, entrées invalides filtrées", async () => {
        mem.set("game-data:bounties:orphans", "{ pas du json");
        await expect(getBountyOrphansSnapshot()).resolves.toBeNull();

        await setBountyOrphansSnapshot(
            [
                { id: "", dofusdbId: 1, name: "Sans id", slug: "x" },
                { id: "ok-1", dofusdbId: null, name: "  ", slug: "y" },
                { id: "ok-2", dofusdbId: null, name: "Vieux Dopeul", slug: "" },
            ],
            -5,
        );
        const snap = await getBountyOrphansSnapshot();
        expect(snap?.orphans).toEqual([{ id: "ok-2", dofusdbId: null, name: "Vieux Dopeul", slug: "" }]);
        expect(snap?.total).toBe(0);
    });
});
