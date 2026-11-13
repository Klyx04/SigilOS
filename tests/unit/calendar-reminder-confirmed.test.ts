/**
 * Rappel manuel depuis la modale calendrier — même population que le rappel automatique.
 *
 * Deux défauts mesurés le 25/10/2026 :
 *  ① la requête ne chargeait que `REGISTERED` + `RESERVE`, alors que le filtre de
 *    mentions accepte `CONFIRMED` : un inscrit confirmé n'était **ni notifié ni pingé**
 *    manuellement, alors que le cron H-1 le pingue (`raid-reminder-service`) ;
 *  ② `lastRemindedAt` était posé **même quand rien n'était parti** (Discord refusé,
 *    aucun compte lié) → les rappels automatiques se taisaient 30 min pour rien.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ACTIONS = codeOnly(readFileSync("src/server/actions/calendar-actions.ts", "utf8"));

describe("sendEventReminder — qui est pingé", () => {
    it("charge les inscrits CONFIRMED comme les rappels automatiques", () => {
        expect(ACTIONS).toMatch(/where: \{ status: \{ in: \["REGISTERED", "CONFIRMED", "RESERVE"\] \} \}/);
    });

    it("le silence de 30 min n'est posé que si un envoi a réellement eu lieu", () => {
        expect(ACTIONS).toMatch(/if \(discordSent \|\| sentCount > 0\) \{/);
    });
});
