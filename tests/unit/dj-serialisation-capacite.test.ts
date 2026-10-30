/**
 * Concurrence du Dungeon Finder — deux inscriptions simultanées sur la dernière place.
 *
 * Mesure du 30/10/2026 (PostgreSQL local, Prisma 7 + `@prisma/adapter-pg`, deux
 * transactions concurrentes qui lisent puis écrivent) :
 *  - opérations **de modèle** ⇒ `PrismaClientKnownRequestError` **P2034** ;
 *  - opérations **brutes** ⇒ **P2010** dont le message porte « Code: `40001` » ;
 *  - la perdante est bien annulée (une seule ligne écrite), donc rejouable sans doublon.
 *
 * Ce fichier verrouille : ① le rejeu est **borné** et ne s'applique qu'aux conflits
 * d'écriture (jamais à une erreur métier), ② les quatre chemins qui écrivent la capacité
 * passent par `withDjSerializableTransaction`, ③ aucun `$transaction` parallèle ne
 * contourne le helper.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
    isWriteConflict,
    retryOnWriteConflict,
    WRITE_CONFLICT_ATTEMPTS,
} from "@/lib/retry-write-conflict";

const ACTIONS = "src/server/actions/dungeon-finder-actions.ts";
const HELPER = "src/server/dj-join-transaction.ts";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ACTIONS_CODE = codeOnly(readFileSync(ACTIONS, "utf8"));
const HELPER_CODE = codeOnly(readFileSync(HELPER, "utf8"));

/** Erreur typée comme celles que remonte Prisma / l'adaptateur `pg`. */
function dbError(code: string, message = `erreur ${code}`): Error & { code: string } {
    return Object.assign(new Error(message), { code });
}

const CONFLICT_CASES: [string, unknown][] = [
    ["P2034 — conflit d'écriture Prisma (opérations de modèle)", dbError("P2034")],
    ["SQLSTATE 40001 — échec de sérialisation", dbError("40001")],
    ["SQLSTATE 40P01 — deadlock", dbError("40P01")],
    [
        "P2010 — requête brute dont le message porte le SQLSTATE",
        dbError(
            "P2010",
            "Raw query failed. Code: `40001`. Message: `could not serialize access due to read/write dependencies among transactions`"
        ),
    ],
];

describe("isWriteConflict — seuls les conflits rejouables sont reconnus", () => {
    it.each(CONFLICT_CASES)("%s", (_label, error) => {
        expect(isWriteConflict(error)).toBe(true);
    });

    it("une erreur métier ou inconnue n'est jamais rejouée", () => {
        expect(isWriteConflict(dbError("P2025", "Post introuvable"))).toBe(false);
        expect(isWriteConflict(dbError("P2002", "Unique constraint failed"))).toBe(false);
        expect(isWriteConflict(new Error("Accès refusé"))).toBe(false);
        expect(isWriteConflict(null)).toBe(false);
        expect(isWriteConflict(undefined)).toBe(false);
    });
});

describe("retryOnWriteConflict — rejeu borné, jamais aveugle", () => {
    it("une exécution sans conflit n'est pas rejouée", async () => {
        const run = vi.fn().mockResolvedValue("ok");
        await expect(
            retryOnWriteConflict(run, { attempts: 3, waitBeforeRetry: async () => {} })
        ).resolves.toBe("ok");
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("un conflit est rejoué : la seconde tentative aboutit", async () => {
        const run = vi.fn()
            .mockRejectedValueOnce(dbError("P2034"))
            .mockResolvedValueOnce("ok");
        const waits: number[] = [];
        await expect(
            retryOnWriteConflict(run, { attempts: 3, waitBeforeRetry: async (attempt) => { waits.push(attempt); } })
        ).resolves.toBe("ok");
        expect(run).toHaveBeenCalledTimes(2);
        expect(waits).toEqual([1]);
    });

    it("une erreur non rejouable remonte immédiatement, sans attente", async () => {
        const run = vi.fn().mockRejectedValueOnce(new Error("Accès refusé"));
        const wait = vi.fn(async () => {});
        await expect(
            retryOnWriteConflict(run, { attempts: 3, waitBeforeRetry: wait })
        ).rejects.toThrow("Accès refusé");
        expect(run).toHaveBeenCalledTimes(1);
        expect(wait).not.toHaveBeenCalled();
    });

    it("les tentatives sont bornées : la dernière erreur remonte telle quelle", async () => {
        const run = vi.fn().mockRejectedValue(dbError("40001"));
        await expect(
            retryOnWriteConflict(run, { attempts: 3, waitBeforeRetry: async () => {} })
        ).rejects.toMatchObject({ code: "40001" });
        expect(run).toHaveBeenCalledTimes(3);
    });

    it("sans option, le rejeu reste borné au nombre de tentatives du module", async () => {
        const run = vi.fn().mockRejectedValue(dbError("P2034"));
        await expect(
            retryOnWriteConflict(run, { waitBeforeRetry: async () => {} })
        ).rejects.toBeDefined();
        expect(run).toHaveBeenCalledTimes(WRITE_CONFLICT_ATTEMPTS);
    });
});

describe("câblage — la capacité s'écrit sous transaction sérialisable", () => {
    it("le helper demande l'isolation `Serializable` et rejoue sur conflit", () => {
        expect(HELPER_CODE).toContain('isolationLevel: "Serializable"');
        expect(HELPER_CODE).toContain("retryOnWriteConflict(");
    });

    it("les quatre chemins qui écrivent la capacité y passent (dashboard, Discord, acceptation, départ)", () => {
        const calls = ACTIONS_CODE.match(/withDjSerializableTransaction\(/g) ?? [];
        expect(calls.length).toBeGreaterThanOrEqual(4);
        expect(ACTIONS_CODE).toContain('from "@/server/dj-join-transaction"');
    });

    it("aucune transaction parallèle ne contourne le helper", () => {
        expect(ACTIONS_CODE).not.toContain("$transaction");
    });
});
