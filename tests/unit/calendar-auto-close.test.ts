/**
 * Clôture d'office des événements terminés — règle **unique**
 * (`@/lib/calendar-auto-close`).
 *
 * Constat du 30/09/2026 : trois endroits basculaient TOUT événement `PUBLISHED` en
 * `COMPLETED` dès la fin de sa date (`getCalendarEvents`, `autoCloseExpiredEvents`,
 * `getCalendarEventDetails`) — et l'embed Discord était supprimé au passage. À J+1, un
 * raid terminé n'était donc plus « à clôturer » nulle part : le rappel de clôture
 * (24 h après la fin) ne pouvait pas partir.
 *
 * Ces tests verrouillent la règle retenue : un RAID n'est clôturé d'office qu'à +48 h,
 * tous les autres types gardent le comportement historique (dès la fin), et les trois
 * appels passent bien par la même source (aucune comparaison réécrite à la main).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    RAID_AUTO_CLOSE_DELAY_MS,
    blindAutoCloseWhere,
    shouldBlindAutoClose,
} from "@/lib/calendar-auto-close";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-01T12:00:00.000Z");
const ACTIONS_CODE = codeOnly(readFileSync("src/server/actions/calendar-actions.ts", "utf8"));

describe("shouldBlindAutoClose — un raid attend 48 h, le reste non", () => {
    it("un raid terminé depuis 24 h n'est PAS clôturé (le rappel doit pouvoir partir)", () => {
        expect(shouldBlindAutoClose("RAID_OFFICIAL", new Date(NOW.getTime() - 24 * HOUR), NOW)).toBe(false);
        expect(shouldBlindAutoClose("RAID_OFFICIAL", new Date(NOW.getTime() - 47 * HOUR), NOW)).toBe(false);
    });

    it("un raid terminé depuis plus de 48 h est clôturé (un raid oublié finit par se ranger)", () => {
        expect(shouldBlindAutoClose("RAID_OFFICIAL", new Date(NOW.getTime() - 49 * HOUR), NOW)).toBe(true);
        expect(shouldBlindAutoClose("RAID_OFFICIAL", new Date(NOW.getTime() - 72 * HOUR), NOW)).toBe(true);
        expect(RAID_AUTO_CLOSE_DELAY_MS).toBe(48 * HOUR);
    });

    it("les autres types restent clôturés dès la fin (comportement historique)", () => {
        expect(shouldBlindAutoClose("EVENT_GUILD", new Date(NOW.getTime() - HOUR), NOW)).toBe(true);
        expect(shouldBlindAutoClose("SESSION_MISSIONS", new Date(NOW.getTime() - HOUR), NOW)).toBe(true);
        expect(shouldBlindAutoClose("SONGES_RUN", new Date(NOW.getTime() - 1), NOW)).toBe(true);
    });

    it("sans date exploitable : jamais de clôture", () => {
        expect(shouldBlindAutoClose("EVENT_GUILD", null, NOW)).toBe(false);
        expect(shouldBlindAutoClose("RAID_OFFICIAL", undefined, NOW)).toBe(false);
        expect(shouldBlindAutoClose("EVENT_GUILD", "pas-une-date", NOW)).toBe(false);
    });
});

describe("blindAutoCloseWhere — miroir SQL de la même règle", () => {
    it("deux branches disjointes : raid après 48 h, tout le reste dès la fin", () => {
        const where = blindAutoCloseWhere("guild-1", NOW);
        expect(where.guildId).toBe("guild-1");
        expect(where.status).toBe("PUBLISHED");
        expect(where.OR).toHaveLength(2);

        const [raid, others] = where.OR;
        expect(raid.type).toBe("RAID_OFFICIAL");
        expect(raid.endDate.lt.getTime()).toBe(NOW.getTime() - RAID_AUTO_CLOSE_DELAY_MS);
        expect(others.type).toEqual({ not: "RAID_OFFICIAL" });
        expect(others.endDate.lt.getTime()).toBe(NOW.getTime());
    });

    it("les bornes du filtre SQL et de la règle JS coïncident (même seuil, même type)", () => {
        const where = blindAutoCloseWhere("guild-1", NOW);
        const justBeforeRaidCutoff = new Date(NOW.getTime() - RAID_AUTO_CLOSE_DELAY_MS + 1);
        const justAfterRaidCutoff = new Date(NOW.getTime() - RAID_AUTO_CLOSE_DELAY_MS - 1);
        expect(shouldBlindAutoClose("RAID_OFFICIAL", justBeforeRaidCutoff, NOW)).toBe(false);
        expect(shouldBlindAutoClose("RAID_OFFICIAL", justAfterRaidCutoff, NOW)).toBe(true);
        expect(where.OR[0].type).toBe("RAID_OFFICIAL");
    });
});

describe("Les passes de clôture d'office passent toutes par la règle partagée", () => {
    it("deux requêtes en base utilisent `blindAutoCloseWhere`", () => {
        expect(ACTIONS_CODE.match(/blindAutoCloseWhere\(guildConfig\.id, now\)/g)?.length).toBe(2);
    });

    it("la fiche d'événement utilise `shouldBlindAutoClose` (plus de comparaison brute)", () => {
        expect(ACTIONS_CODE).toMatch(/const isPast = shouldBlindAutoClose\(event\.type, event\.endDate, now\)/);
        expect(ACTIONS_CODE, "l'ancienne comparaison réécrite a disparu").not.toMatch(
            /new Date\(event\.endDate\) < now/
        );
    });

    it("plus aucun `endDate: { lt: now }` écrit à la main dans la clôture d'office", () => {
        expect(ACTIONS_CODE).not.toMatch(/endDate: \{ lt: now \}/);
    });
});
