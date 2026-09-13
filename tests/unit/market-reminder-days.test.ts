/**
 * Module « Marché » — **paliers de rappel** (T4 / D-B).
 *
 * Le même champ était saisi par **deux** panneaux (God et guilde) avec deux jeux
 * de règles différents : bornes 1–59 codées en dur d'un côté, aucune borne de
 * l'autre, et un tableau vide pouvait être écrit en base. Ce test verrouille le
 * helper partagé (`src/lib/market/reminder-days.ts`) : bornes issues de
 * `MARKET_SETTINGS_BOUNDS`, dédoublonnage, tri, max 3 valeurs, et **refus**
 * (`null`) d'une saisie inexploitable — jamais une valeur inventée.
 */

import { describe, it, expect } from "vitest";
import { formatReminderDays, parseReminderDays } from "@/lib/market/reminder-days";
import { MARKET_SETTINGS_BOUNDS } from "@/server/actions/market-constants";

describe("parseReminderDays — saisie des paliers de rappel", () => {
    it("lit une liste simple et la trie", () => {
        expect(parseReminderDays("15, 7")).toEqual([7, 15]);
        expect(parseReminderDays("7,15")).toEqual([7, 15]);
        expect(parseReminderDays(" 7 ")).toEqual([7]);
    });

    it("dédoublonne et borne la longueur à 3 valeurs", () => {
        expect(parseReminderDays("7, 7, 7")).toEqual([7]);
        expect(parseReminderDays("1, 2, 3, 4")).toEqual([1, 2, 3]);
    });

    it("ignore les valeurs hors bornes (jamais de valeur inventée)", () => {
        expect(parseReminderDays("0, 7")).toEqual([7]);
        expect(parseReminderDays("7, 9999")).toEqual([7]);
        expect(parseReminderDays("abc, 15")).toEqual([15]);
    });

    it("renvoie `null` quand rien d'exploitable n'est saisi (fail-closed)", () => {
        expect(parseReminderDays("")).toBeNull();
        expect(parseReminderDays("   ")).toBeNull();
        expect(parseReminderDays("abc")).toBeNull();
        expect(parseReminderDays("0, -3, 9999")).toBeNull();
    });

    it("respecte les bornes du référentiel partagé", () => {
        const { min, max } = MARKET_SETTINGS_BOUNDS.marketReminderDays;
        expect(parseReminderDays(String(min))).toEqual([min]);
        expect(parseReminderDays(String(max))).toEqual([max]);
        expect(parseReminderDays(String(max + 1))).toBeNull();
    });
});

describe("formatReminderDays — affichage des valeurs en base", () => {
    it("affiche une liste triée, jamais un tableau vide ou `null`", () => {
        expect(formatReminderDays([15, 7])).toBe("7, 15");
        expect(formatReminderDays([])).toBe("");
        expect(formatReminderDays(null)).toBe("");
        expect(formatReminderDays(undefined)).toBe("");
    });
});
