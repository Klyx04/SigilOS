/**
 * Rail de veille DofusDB — brique pure (`src/lib/dofusdb-veille.ts`) + première verticale
 * (fiches monstres, `src/lib/monsters-veille-siphon.ts`).
 *
 * Mesures du 27/09/2026 qui fondent ces règles : `id[$gt]` + `$sort=id` fonctionnent sur
 * `/monsters` ; `$skip` y est fiable ; `updatedAt[$gte]` sur 30 jours renvoie **0 entité**
 * (catalogue figé depuis le 23/06/2026) ; une date invalide fait répondre **HTTP 500** à DofusDB.
 */
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

import {
    buildVeilleQuery,
    closeVeillePass,
    coverageGauge,
    isIsoDate,
    isValidIdCursor,
    nextCursor,
    EMPTY_VEILLE_STATE,
    type VeilleSpec,
} from "@/lib/dofusdb-veille";
import { MONSTER_FICHES_SPEC, runMonsterFichesPass } from "@/lib/monsters-veille-siphon";

const SPEC: VeilleSpec = { id: "T", endpoint: "/monsters", cursor: "id", limit: 3 };

describe("rail de veille — requête, filigrane, jauge", () => {
    it("première passe : aucun filtre (backfill) et budget respecté", () => {
        expect(buildVeilleQuery(SPEC, { cursor: null })).toBe("$limit=3&$sort=id");
    });

    it("passes suivantes : reprise EXACTE au filigrane d'id", () => {
        expect(buildVeilleQuery(SPEC, { cursor: "31" })).toBe("$limit=3&$sort=id&id[$gt]=31");
    });

    it("refuse d'appeler l'API sans filigrane exploitable (DofusDB répond 500, mesuré)", () => {
        expect(buildVeilleQuery(SPEC, { cursor: "pas-un-id" })).toBeNull();
        expect(buildVeilleQuery({ ...SPEC, limit: 0 }, { cursor: null })).toBeNull();
        expect(buildVeilleQuery({ ...SPEC, cursor: "updatedAt" }, { cursor: "pas-une-date" })).toBeNull();
        expect(buildVeilleQuery({ ...SPEC, cursor: "updatedAt" }, { cursor: "2026-09-01" })).toBe(
            "$limit=3&$sort=id&updatedAt[$gte]=2026-09-01"
        );
    });

    it("le filigrane ne recule JAMAIS", () => {
        expect(nextCursor(SPEC, "100", [34, 36, 42])).toBe("100");
        expect(nextCursor(SPEC, "31", [34, 36, 42])).toBe("42");
        expect(nextCursor(SPEC, "31", [])).toBe("31");
        expect(nextCursor({ cursor: "updatedAt" }, "2026-09-01", ["2026-08-01T00:00:00.000Z"])).toBe("2026-09-01");
        expect(nextCursor({ cursor: "updatedAt" }, "2026-09-01", ["2026-09-20T00:00:00.000Z"])).toBe(
            "2026-09-20T00:00:00.000Z"
        );
    });

    it("clôture de passe : restant chiffré, fin détectée", () => {
        expect(closeVeillePass(SPEC, null, [31, 34, 36], 5135)).toEqual({
            processed: 3,
            cursor: "36",
            remaining: 5132,
            done: false,
        });
        expect(closeVeillePass(SPEC, "36", [], 0)).toEqual({ processed: 0, cursor: "36", remaining: 0, done: true });
    });

    it("jauges : jamais « à jour » sans mesure", () => {
        expect(coverageGauge(258, 5135)).toMatchObject({ percent: 5 });
        expect(coverageGauge(258, 5135).label).toContain("veille en cours");
        expect(coverageGauge(5135, 5135).label).toContain("complet");
        expect(coverageGauge(10, null).percent).toBeNull();
        expect(isIsoDate("2026-09-01") && isIsoDate("2026-09-01T00:00:00.000Z")).toBe(true);
        expect(isIsoDate("2026")).toBe(false); // « 2026 » passe Date.parse mais pas DofusDB
        expect(isValidIdCursor(0)).toBe(false);
        expect(EMPTY_VEILLE_STATE.cursor).toBeNull();
    });
});


describe("fiches monstres — une passe bornée, reprenable, jamais destructive", () => {
    it("persiste le lot et avance le filigrane", async () => {
        const persistFiche = vi.fn().mockResolvedValue(true);
        const res = await runMonsterFichesPass({
            state: { cursor: "31", remaining: 5134, lastPassAt: null },
            limit: 3,
            fetchPage: vi.fn().mockResolvedValue({
                rows: [
                    { id: 34, name: "Larve Verte" },
                    { id: 36, name: "Bouftou" },
                    { id: 42, name: "La Surpuissante" },
                ],
                total: 5134,
            }),
            persistFiche,
        });
        expect(persistFiche).toHaveBeenCalledTimes(3);
        expect(res).toMatchObject({ processed: 3, persisted: 3, cursor: "42", remaining: 5131, done: false });
    });

    it("panne de la source : filigrane INTACT (aucune avance sur une réponse absente)", async () => {
        const res = await runMonsterFichesPass({
            state: { cursor: "31", remaining: 5134, lastPassAt: "2026-09-27T00:00:00.000Z" },
            fetchPage: vi.fn().mockRejectedValue(new Error("DofusDB 503")),
            persistFiche: vi.fn(),
        });
        expect(res.cursor).toBe("31");
        expect(res.processed).toBe(0);
        expect(res.errors[0]).toContain("503");
    });

    it("filigrane invalide : passe annulée AVANT tout appel réseau", async () => {
        const fetchPage = vi.fn();
        const res = await runMonsterFichesPass({
            state: { cursor: "oups", remaining: null, lastPassAt: null },
            fetchPage,
            persistFiche: vi.fn(),
        });
        expect(fetchPage).not.toHaveBeenCalled();
        expect(res.errors[0]).toContain("Filigrane invalide");
    });

    it("une fiche en échec n'arrête pas le lot (fail-soft unitaire)", async () => {
        const persistFiche = vi
            .fn()
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce(true);
        const res = await runMonsterFichesPass({
            state: { cursor: null, remaining: null, lastPassAt: null },
            limit: 3,
            fetchPage: vi.fn().mockResolvedValue({
                rows: [
                    { id: 31, name: "Larve Bleue" },
                    { id: 34, name: "Larve Verte" },
                    { id: 36, name: "Bouftou" },
                ],
                total: 5135,
            }),
            persistFiche,
        });
        expect(res.persisted).toBe(2);
        expect(res.errors).toHaveLength(1);
        expect(res.cursor).toBe("36");
    });

    it("le contrat du dataset est déclaré, jamais deviné", () => {
        expect(MONSTER_FICHES_SPEC).toMatchObject({ id: "MONSTER_FICHES", endpoint: "/monsters", cursor: "id" });
    });
});

describe("câblage — le rail tourne dans le cron, jamais pendant les tests", () => {
    it("le cron exécute une passe bornée par passage, avec filigrane persistant", () => {
        const src = readSource("src/app/api/cron/sync-monster-stats/route.ts");
        expect(src).toContain("runMonsterFichesPass(");
        expect(src).toContain("getGameDataVeilleState(MONSTER_FICHES_SPEC.id)");
        expect(src).toContain("setGameDataVeilleState(MONSTER_FICHES_SPEC.id");
        expect(src).toContain("limit: 60");
    });

    it("l'étage est COUPÉ sous Vitest (aucun appel réseau pendant les tests)", () => {
        expect(readSource("src/app/api/cron/sync-monster-stats/route.ts")).toContain(
            'process.env.VITEST === "true"'
        );
    });

    it("le filigrane vit dans le magasin d'état existant, sans TTL (le perdre = backfill)", () => {
        const store = readSource("src/server/game-data-sync-state-store.ts");
        expect(store).toContain("game-data:veille:");
        expect(store).toContain("getGameDataVeilleState");
        expect(store).toContain("setGameDataVeilleState");
    });
});
