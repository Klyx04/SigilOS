import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Verrou — **une seule formulation de refus, par cause**, et le bouton Postuler ne
 * s'ouvre plus sur une run close.
 *
 * Incident du 05/11/2026 : sur un post Discord orphelin (run archivée), « Postuler »
 * ouvrait la modale, puis la soumission répondait « Cette run n'accepte plus de
 * candidatures » — message identique à une run simplement fermée, et jamais le mot
 * « archivée ». Le même texte était recopié dans trois actions.
 *
 * Ce fichier verrouille : ① aucune copie du message générique dans les actions ;
 * ② les trois chemins passent par `runJoinRefusal` / `runInteractionRefusal` ;
 * ③ la route Discord lit le statut **avant** d'ouvrir la modale `songes:apply`.
 *
 * Lecture seule.
 */

const read = (path: string) => readFileSync(path, "utf8");
const codeOnly = (path: string) =>
    read(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const SERVICE = "src/server/songes-service.ts";
const ACTIONS = "src/server/actions/songes/dream-run-actions.ts";
const ROUTE = "src/app/api/discord/interactions/route.ts";

describe("refus d'une run Songes — une cause, un message", () => {
    it("le message générique n'est plus recopié dans les actions", () => {
        expect(codeOnly(SERVICE)).not.toContain("Cette run n'accepte plus de candidatures");
        expect(codeOnly(ACTIONS)).not.toContain("Cette run n'accepte plus de candidatures");
    });

    it("le service Discord et le dashboard appellent la règle partagée", () => {
        const service = codeOnly(SERVICE);
        // Deux refus de candidature : processRunJoin + updateRunCandidateClass.
        expect(service.match(/runJoinRefusal\(run\.status\)/g)?.length).toBe(2);
        // Un refus d'interaction : un membre ne quitte pas une run close.
        expect(service).toContain("runInteractionRefusal(run.status)");
        expect(codeOnly(ACTIONS)).toContain("runJoinRefusal(run.status)");
    });

    it("le bouton Postuler lit le statut AVANT d'ouvrir la modale", () => {
        const route = codeOnly(ROUTE);
        const refusalAt = route.lastIndexOf("runInteractionRefusal(run.status)");
        const modalAt = route.indexOf("custom_id: `songes:apply:");
        expect(refusalAt).toBeGreaterThan(-1);
        expect(modalAt).toBeGreaterThan(-1);
        expect(refusalAt).toBeLessThan(modalAt);
        // Plus de liste de statuts recopiée dans le handler stand-by.
        expect(route).not.toMatch(/\["COMPLETED",\s*"FAILED",\s*"ABANDONED"\]\.includes\(run\.status\)/);
    });
});
