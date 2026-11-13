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
        expect(shouldBlindAutoClose({ type: "RAID_OFFICIAL", endDate: new Date(NOW.getTime() - 24 * HOUR), now: NOW })).toBe(false);
        expect(shouldBlindAutoClose({ type: "RAID_OFFICIAL", endDate: new Date(NOW.getTime() - 47 * HOUR), now: NOW })).toBe(false);
    });

    it("un raid terminé depuis plus de 48 h est clôturé (filet de sécurité : il ne restera pas ouvert à vie)", () => {
        expect(shouldBlindAutoClose({ type: "RAID_OFFICIAL", endDate: new Date(NOW.getTime() - 49 * HOUR), now: NOW })).toBe(true);
        expect(shouldBlindAutoClose({ type: "RAID_OFFICIAL", endDate: new Date(NOW.getTime() - 72 * HOUR), now: NOW })).toBe(true);
        expect(RAID_AUTO_CLOSE_DELAY_MS).toBe(48 * HOUR);
    });

    it("les autres types restent clôturés dès la fin (comportement historique)", () => {
        expect(shouldBlindAutoClose({ type: "EVENT_GUILD", endDate: new Date(NOW.getTime() - HOUR), now: NOW })).toBe(true);
        expect(shouldBlindAutoClose({ type: "SESSION_MISSIONS", endDate: new Date(NOW.getTime() - HOUR), now: NOW })).toBe(true);
        expect(shouldBlindAutoClose({ type: "SONGES_RUN", endDate: new Date(NOW.getTime() - 1), now: NOW })).toBe(true);
    });

    it("sans date exploitable : jamais de clôture", () => {
        expect(shouldBlindAutoClose({ type: "EVENT_GUILD", endDate: null, now: NOW })).toBe(false);
        expect(shouldBlindAutoClose({ type: "RAID_OFFICIAL", endDate: undefined, now: NOW })).toBe(false);
        expect(shouldBlindAutoClose({ type: "EVENT_GUILD", endDate: "pas-une-date", now: NOW })).toBe(false);
    });

    it("un miroir agenda DJ/Songes n'est jamais clôturé : la copie suit son post d'origine", () => {
        for (const type of ["DUNGEON_FARM", "SONGES_RUN"] as const) {
            expect(
                shouldBlindAutoClose({ type, endDate: new Date(NOW.getTime() - 72 * HOUR), now: NOW, isMirror: true })
            ).toBe(false);
        }
        // Sans le marqueur de miroir, la même ligne suit la règle commune.
        expect(shouldBlindAutoClose({ type: "DUNGEON_FARM", endDate: new Date(NOW.getTime() - HOUR), now: NOW })).toBe(true);
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

    it("`null` ⇒ toutes les guildes (pré-filtre de la passe de fond, qui écarte les miroirs en JS)", () => {
        const where = blindAutoCloseWhere(null, NOW);
        expect("guildId" in where).toBe(false);
        expect(where.status).toBe("PUBLISHED");
    });

    it("les bornes du filtre SQL et de la règle JS coïncident (même seuil, même type)", () => {
        const where = blindAutoCloseWhere("guild-1", NOW);
        const justBeforeRaidCutoff = new Date(NOW.getTime() - RAID_AUTO_CLOSE_DELAY_MS + 1);
        const justAfterRaidCutoff = new Date(NOW.getTime() - RAID_AUTO_CLOSE_DELAY_MS - 1);
        expect(shouldBlindAutoClose({ type: "RAID_OFFICIAL", endDate: justBeforeRaidCutoff, now: NOW })).toBe(false);
        expect(shouldBlindAutoClose({ type: "RAID_OFFICIAL", endDate: justAfterRaidCutoff, now: NOW })).toBe(true);
        expect(where.OR[0].type).toBe("RAID_OFFICIAL");
    });
});

describe("Les chemins de lecture n'écrivent plus jamais de statut", () => {
    it("plus aucune clôture d'office dans les server actions (la passe de fond est seule)", () => {
        expect(ACTIONS_CODE, "la fonction morte `autoCloseExpiredEvents` a disparu").not.toMatch(/autoCloseExpiredEvents/);
        expect(ACTIONS_CODE, "aucune écriture en lot de statut à la lecture").not.toMatch(/guildEvent\.updateMany/);
    });

    it("les deux lectures dérivent l'affichage avec la règle unique, miroirs compris", () => {
        expect(ACTIONS_CODE.match(/shouldBlindAutoClose\(\{/g)?.length).toBe(2);
        expect(ACTIONS_CODE.match(/isMirror: isAgendaMirror\(event\.metadata\)/g)?.length).toBe(2);
    });

    it("plus aucun `endDate: { lt: now }` écrit à la main dans la clôture d'office", () => {
        expect(ACTIONS_CODE).not.toMatch(/endDate: \{ lt: now \}/);
    });
});
