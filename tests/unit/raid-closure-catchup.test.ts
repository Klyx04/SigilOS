/**
 * Raid clôturé **d'office** : le capitaine peut encore saisir présents + score.
 *
 * Décision user du 25/10/2026 : passé **48 h** sans clôture (le rappel de +24 h est
 * parti), le raid est clôturé d'office — sinon il ne serait jamais rangé. Mais cette
 * clôture ne doit **jamais** être définitive : elle est sans points, et le capitaine
 * (ou un admin) peut la compléter ou l'annuler pendant 24 h.
 *
 * Discriminant (aucune migration) : `metadata.completedAt` = clôture **humaine**.
 * Absent = clôture d'office (y compris les raids déjà bloqués avant ce correctif).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ACTIONS = codeOnly(readFileSync("src/server/actions/calendar-actions.ts", "utf8"));

/** Portion source d'une fonction, jusqu'à la suivante (les gardes se ressemblent d'une action à l'autre). */
function functionBody(source: string, name: string, next: string): string {
    const start = source.indexOf(`export async function ${name}`);
    const end = source.indexOf(`export async function ${next}`);
    expect(start, `${name} introuvable`).toBeGreaterThan(-1);
    expect(end, `${next} introuvable`).toBeGreaterThan(start);
    return source.slice(start, end);
}

const RAID_COMPLETE = functionBody(ACTIONS, "completeRaidEvent", "undoCompleteRaidEvent");
const RAID_UNDO = functionBody(ACTIONS, "undoCompleteRaidEvent", "transferRaidLead");

describe("completeRaidEvent — la clôture d'office est rattrapable", () => {
    it("refuse seulement une clôture déjà faite par le capitaine", () => {
        expect(RAID_COMPLETE).toMatch(/if \(existingMeta\.completedAt\) \{/);
        expect(RAID_COMPLETE).toMatch(/Déjà clôturé par le capitaine/);
        expect(RAID_COMPLETE, "l'ancien refus sec sur le statut a disparu").not.toMatch(
            /if \(event\.status === "COMPLETED"\) return \{ success: false, error: "Déjà terminé" \}/
        );
    });

    it("efface les marqueurs de clôture système quand le capitaine reprend la main", () => {
        expect(RAID_COMPLETE).toMatch(/\.\.\.stripSystemClosure\(existingMeta\)/);
        expect(RAID_COMPLETE).toMatch(/completedAt: new Date\(\)\.toISOString\(\)/);
    });
});

describe("undoCompleteRaidEvent — annuler une clôture d'office", () => {
    it("la fenêtre de 24 h s'appuie sur `completedAt` OU `systemClosedAt`", () => {
        expect(RAID_UNDO).toMatch(/meta\.completedAt/);
        expect(RAID_UNDO).toMatch(/meta\.systemClosedAt \? new Date\(meta\.systemClosedAt\) : null/);
    });

    it("la remise en `PUBLISHED` nettoie aussi les marqueurs système", () => {
        expect(RAID_UNDO).toMatch(/closedBySystem: null/);
        expect(RAID_UNDO).toMatch(/systemClosedAt: null/);
    });
});
