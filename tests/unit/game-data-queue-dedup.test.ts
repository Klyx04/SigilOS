/**
 * Idempotence de la file game-data — incident « ça tourne dans le vide » (24/09/2026).
 *
 * Mesure : avec un `jobId` **fixe**, BullMQ **n'ajoute rien** quand un job du même id existe
 * encore — même **échoué** (`removeOnFail` 24 h) — et rend l'id existant **sans erreur**.
 * Reproduit localement : 2ᵉ enfilage ⇒ `JOB_ENFILE: game-data-ITEMS` rendu… et **aucune ligne
 * du worker**. Résultat en bêta : le Tableau affichait « En cours / il y a 36 min » alors
 * qu'aucun job ne tournait, même après redéploiement.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isJobInFlight } from "@/lib/queue/game-data-queue-policy";
import { isStaleRun } from "@/lib/game-data-sync-state";

const read = (p: string) => readFileSync(p, "utf8");

describe("file game-data — un job vivant n'est jamais doublé, un job mort ne bloque plus", () => {
    it("un job vivant est « en vol » (actif, en file, différé, priorisé, attente d'enfants)", () => {
        for (const state of ["active", "waiting", "delayed", "prioritized", "waiting-children"]) {
            expect(isJobInFlight(state), state).toBe(true);
        }
    });

    it("un job terminé ou échoué ne bloque plus l'idempotence", () => {
        for (const state of ["completed", "failed", "unknown", null, undefined]) {
            expect(isJobInFlight(state), String(state)).toBe(false);
        }
    });

    it("l'enfileur libère l'id d'un job terminé/échoué avant d'ajouter", () => {
        const queue = read("src/lib/queue/game-data-queue.ts");
        expect(queue).toContain("const existing = await gameDataQueue.getJob(jobId)");
        expect(queue).toContain("if (isJobInFlight(state))");
        expect(queue).toContain('return { jobId, outcome: "already-running" }');
        expect(queue).toContain("await existing.remove()");
        // Borné : jamais de hang dans un cron.
        expect(queue).toContain("ENQUEUE_TIMEOUT_MS");
    });

    it("l'action ne prétend plus « En cours » quand rien n'a été mis en file", () => {
        const action = read("src/server/actions/game-data-sync-actions.ts");
        expect(action).toContain('outcome === "already-running"');
        expect(action).toContain("Un siphon tourne déjà pour ce dataset");
        // L'état RUNNING n'est écrit qu'après une mise en file réelle : le garde précède
        // l'appel `beginGameDataRun` de CETTE action (le fichier en contient un autre,
        // dans `beginGameDataSync` — d'où le `lastIndexOf`).
        const guardIdx = action.indexOf('outcome === "already-running"');
        const beginIdx = action.lastIndexOf("await beginGameDataRun(dataset");
        expect(guardIdx).toBeGreaterThan(-1);
        expect(beginIdx).toBeGreaterThan(guardIdx);
    });

    it("le Tableau s'auto-répare : un « En cours » trop vieux sans job est déclaré interrompu", () => {
        const action = read("src/server/actions/game-data-sync-actions.ts");
        expect(action).toContain("isStaleRun(state)");
        expect(action).toContain("markGameDataRunStale(state.dataset)");
        expect(action).toContain("if (inFlight) return state");
        // Les datasets lancés « dans l'onglet » (pas de file) ne sont jamais contredits.
        expect(action).toContain("!isBackgroundDataset(state.dataset)");
    });

    it("le seuil de péremption est mesuré par dataset (jamais un seuil unique arbitraire)", () => {
        const now = Date.parse("2026-09-24T10:00:00.000Z");
        const at = (minutes: number, dataset: "ITEMS" | "REFERENTIALS") => ({
            dataset,
            status: "RUNNING" as const,
            startedAt: new Date(now - minutes * 60_000).toISOString(),
        });
        // ITEMS : une passe complète dure 10-20 min ⇒ fraîche à 30 min, périmée à 60.
        expect(isStaleRun(at(30, "ITEMS"), now)).toBe(false);
        expect(isStaleRun(at(60, "ITEMS"), now)).toBe(true);
        // Un dataset rapide (référentiels) est périmé bien plus tôt.
        expect(isStaleRun(at(20, "REFERENTIALS"), now)).toBe(true);
        expect(isStaleRun(at(5, "REFERENTIALS"), now)).toBe(false);
        // Un run terminé ou jamais démarré n'est jamais « périmé ».
        expect(isStaleRun({ dataset: "ITEMS", status: "OK", startedAt: at(600, "ITEMS").startedAt }, now)).toBe(false);
        expect(isStaleRun({ dataset: "ITEMS", status: "RUNNING", startedAt: null }, now)).toBe(false);
    });
});
