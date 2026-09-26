/**
 * Dungeon Finder — normalisation multi-donjons (#26).
 *
 * Régression verrouillée : `dungeonsJson` n'est PAS toujours un tableau.
 * Les sauvegardes/rappels Discord l'écrivent sous forme d'enveloppe
 * (`{ _items: [...], _autoReminderCount: n }`) ou de chaîne JSON.
 * L'ancien code lisait `(post.dungeonsJson as any[]).length` → `undefined`,
 * d'où les titres « Multi-donjons — undefined » et les images manquantes.
 */

import { describe, it, expect } from "vitest";

import {
    getMultiDungeons,
    getDjPostTitle,
    getDjPostSubtitle,
    getDjDateParts,
    hasExplicitTime,
    formatDjDateLabel,
    formatDiscordDateStamp,
    mergeMultiDungeonTargetDates,
} from "@/lib/dungeon-finder-utils";
import { toLocalDateTimeInput } from "@/lib/date-utils";

const dj = (name: string, level: number) => ({
    dungeonId: `id-${name}`,
    name,
    bossName: `Boss ${name}`,
    level,
    imageUrl: `/img/${name}.png`,
});

describe("getMultiDungeons", () => {
    it("valeurs vides → tableau vide", () => {
        expect(getMultiDungeons(null)).toEqual([]);
        expect(getMultiDungeons(undefined)).toEqual([]);
        expect(getMultiDungeons([])).toEqual([]);
        expect(getMultiDungeons("")).toEqual([]);
        expect(getMultiDungeons(42)).toEqual([]);
    });

    it("tableau direct (cas normal du client)", () => {
        const list = [dj("Kraken", 100), dj("Minotoror", 120)];
        expect(getMultiDungeons(list)).toHaveLength(2);
        expect(getMultiDungeons(list)[0].name).toBe("Kraken");
    });

    it("enveloppe de sauvegarde { _items: [...] } (cause du bug)", () => {
        const envelope = { _items: [dj("Kraken", 100), dj("Minotoror", 120)], _autoReminderCount: 2 };
        const out = getMultiDungeons(envelope);
        expect(out).toHaveLength(2);
        expect(out.map((d) => d.name)).toEqual(["Kraken", "Minotoror"]);
    });

    it("accepte aussi { items } et { posts }", () => {
        expect(getMultiDungeons({ items: [dj("A", 1)] })).toHaveLength(1);
        expect(getMultiDungeons({ posts: [dj("A", 1), dj("B", 2)] })).toHaveLength(2);
    });

    it("chaîne JSON : tableau ou enveloppe", () => {
        expect(getMultiDungeons(JSON.stringify([dj("A", 1)]))).toHaveLength(1);
        expect(getMultiDungeons(JSON.stringify({ _items: [dj("A", 1)] }))).toHaveLength(1);
    });

    it("chaîne invalide ou objet sans liste → tableau vide (jamais de throw)", () => {
        expect(getMultiDungeons("{oops")).toEqual([]);
        expect(getMultiDungeons({ foo: "bar" })).toEqual([]);
    });
});

describe("getDjPostTitle", () => {
    it("1 ou 2 donjons → noms joints, jamais 'undefined'", () => {
        expect(getDjPostTitle({ dungeonsJson: [dj("Kraken", 100)] })).toBe("Kraken");
        expect(getDjPostTitle({ dungeonsJson: [dj("Kraken", 100), dj("Minotoror", 120)] })).toBe("Kraken + Minotoror");
    });

    it("3 donjons et plus → compteur (pas de titre illisible)", () => {
        const three = [dj("A", 1), dj("B", 2), dj("C", 3)];
        expect(getDjPostTitle({ dungeonsJson: three })).toBe("Multi-donjons (3)");
    });

    it("régression : enveloppe { _items } → titre lisible, pas 'Multi-donjons — undefined'", () => {
        const envelope = { _items: [dj("Kraken", 100), dj("Minotoror", 120)] };
        const title = getDjPostTitle({ dungeonsJson: envelope });
        expect(title).toBe("Kraken + Minotoror");
        expect(title).not.toContain("undefined");
    });

    it("le multi-donjons prime sur le mode", () => {
        expect(getDjPostTitle({ mode: "DONJON", dungeon: { name: "Oubli" }, dungeonsJson: [dj("Kraken", 100)] })).toBe("Kraken");
    });

    it("mode simple : donjon / défi / titan / quête", () => {
        expect(getDjPostTitle({ mode: "DONJON", dungeon: { name: "Oubli" } })).toBe("Oubli");
        expect(getDjPostTitle({ mode: "DONJON" })).toBe("Donjon");
        expect(getDjPostTitle({ mode: "DEFI", defiName: "Guerre" })).toBe("Guerre");
        expect(getDjPostTitle({ mode: "DEFI" })).toBe("Défi");
        expect(getDjPostTitle({ mode: "TITAN", titanName: "Grozilla" })).toBe("Grozilla");
        expect(getDjPostTitle({ mode: "TITAN" })).toBe("Titan");
        expect(getDjPostTitle({ questName: "Pourpre" })).toBe("Pourpre");
        expect(getDjPostTitle({})).toBe("Quête");
    });
});

describe("getDjPostSubtitle", () => {
    it("multi-donjons : fourchette de niveaux + compteur", () => {
        expect(getDjPostSubtitle({ dungeonsJson: [dj("A", 100), dj("B", 120)] })).toBe("Niv. 100 à 120 · 2 donjons");
        expect(getDjPostSubtitle({ dungeonsJson: [dj("A", 100), dj("B", 100)] })).toBe("Niv. 100 · 2 donjons");
    });

    it("multi-donjons sans niveau → libellé de secours", () => {
        const noLevel = [
            { dungeonId: "1", name: "A", bossName: "B", level: undefined as unknown as number, imageUrl: null },
            { dungeonId: "2", name: "C", bossName: "D", level: undefined as unknown as number, imageUrl: null },
        ];
        expect(getDjPostSubtitle({ dungeonsJson: noLevel })).toBe("Session de 2 donjons");
    });

    it("mode donjon : boss + niveau, puis replis progressifs", () => {
        expect(getDjPostSubtitle({ mode: "DONJON", dungeon: { bossName: "Dragon", level: 200 } })).toBe("Niv. 200 — Dragon");
        expect(getDjPostSubtitle({ mode: "DONJON", dungeon: { level: 200 } })).toBe("Niv. 200");
        expect(getDjPostSubtitle({ mode: "DONJON", dungeon: { bossName: "Dragon" } })).toBe("Dragon");
        expect(getDjPostSubtitle({ mode: "DONJON", dungeon: {} })).toBe("Donjon");
    });

    it("modes défi / titan / quête", () => {
        expect(getDjPostSubtitle({ mode: "DEFI", defiName: "Guerre" })).toBe("Guerre");
        expect(getDjPostSubtitle({ mode: "DEFI" })).toBe("Événement Défi");
        expect(getDjPostSubtitle({ mode: "TITAN", titanName: "Grozilla" })).toBe("Grozilla");
        expect(getDjPostSubtitle({ mode: "TITAN" })).toBe("Mode Titan");
        expect(getDjPostSubtitle({})).toBe("Mode Quête");
    });
});

/**
 * Date & heure optionnelles — la date est posée à minuit quand le membre choisit
 * « Sans heure » : on lit alors une DATE SEULE, jamais « 00:00 ».
 * Le calcul doit être identique côté serveur (embed) et côté navigateur (carte) :
 * il est donc fait en heure civile Europe/Paris, quel que soit le fuseau du
 * runtime. C'était la cause du « jour et heure figés à minuit ».
 */
describe("date prévue (optionnelle)", () => {
    // 20/09/2026 16:00 UTC = 18:00 à Paris (CEST).
    const withTime = new Date("2026-09-20T16:00:00.000Z");
    // 19/09/2026 22:00 UTC = 20/09/2026 00:00 à Paris → « Sans heure ».
    const dateOnly = new Date("2026-09-19T22:00:00.000Z");

    it("getDjDateParts lit l'heure civile Paris (pas le fuseau du runtime)", () => {
        const parts = getDjDateParts(withTime);
        expect(parts).not.toBeNull();
        expect([parts!.year, parts!.month, parts!.day]).toEqual([2026, 9, 20]);
        expect([parts!.hours, parts!.minutes]).toEqual([18, 0]);
        expect(parts!.explicitTime).toBe(true);
    });

    it("minuit Paris = « date seule » (le runtime UTC ne doit pas dire 22:00)", () => {
        const parts = getDjDateParts(dateOnly);
        expect([parts!.year, parts!.month, parts!.day]).toEqual([2026, 9, 20]);
        expect([parts!.hours, parts!.minutes]).toEqual([0, 0]);
        expect(parts!.explicitTime).toBe(false);
        expect(hasExplicitTime(dateOnly)).toBe(false);
    });

    it("absente / invalide → null et jamais d'exception", () => {
        expect(getDjDateParts(null)).toBeNull();
        expect(getDjDateParts(undefined)).toBeNull();
        expect(getDjDateParts("")).toBeNull();
        expect(getDjDateParts("pas-une-date")).toBeNull();
        expect(hasExplicitTime(null)).toBe(false);
        expect(formatDjDateLabel(null)).toBeNull();
        expect(formatDiscordDateStamp(undefined)).toBeNull();
    });

    it("formatDjDateLabel : date + heure, ou date seule si « Sans heure »", () => {
        expect(formatDjDateLabel(withTime)).toBe("dimanche 20 septembre 2026 à 18:00");
        const only = formatDjDateLabel(dateOnly);
        expect(only).toBe("dimanche 20 septembre 2026");
        expect(only).not.toContain("00:00");
        expect(formatDjDateLabel(withTime, { shortWeekday: true, shortMonth: true })).toContain("à 18:00");
    });

    it("formatDiscordDateStamp : <t:F> avec heure, <t:D> sans heure", () => {
        expect(formatDiscordDateStamp(withTime)).toMatch(/^<t:\d+:F>$/);
        expect(formatDiscordDateStamp(dateOnly)).toMatch(/^<t:\d+:D>$/);
        // Même instant → même timestamp, seule l'annotation d'affichage change.
        const tsOf = (s: string) => s.match(/^<t:(\d+):/)?.[1];
        expect(tsOf(formatDiscordDateStamp(dateOnly)!)).toBe(tsOf(formatDiscordDateStamp(new Date(dateOnly))!));
    });

    it("toLocalDateTimeInput : heure LOCALE (jamais le décalage UTC de toISOString)", () => {
        // 18:00 Paris (CEST) = 16:00 UTC → le champ doit afficher 18:00, pas 16:00.
        expect(toLocalDateTimeInput(withTime)).toBe("2026-09-20T18:00");
        // Et l'ancien code (toISOString) produisait bien un décalage → régression verrouillée.
        expect(toLocalDateTimeInput(withTime)).not.toBe(withTime.toISOString().slice(0, 16));
        expect(toLocalDateTimeInput(null)).toBe("");
        expect(toLocalDateTimeInput("pas-une-date")).toBe("");
    });

    it("mergeMultiDungeonTargetDates : ne touche que targetDate et garde l'enveloppe", () => {
        type Enveloppe = { _items: { name?: string; targetDate?: Date | null }[]; _autoReminderCount?: number };
        const items = [dj("Kraken", 100), dj("Minotoror", 120)];
        const envelope = { _items: items, _autoReminderCount: 3 };
        const merged = mergeMultiDungeonTargetDates(envelope, [{ targetDate: new Date("2026-09-20T18:00:00.000Z") }]) as Enveloppe;
        expect(merged._autoReminderCount).toBe(3); // compteur de rappels préservé
        expect(merged._items[0].targetDate).toBeInstanceOf(Date);
        expect(merged._items[0].name).toBe("Kraken"); // données intactes
        expect(merged._items[1].targetDate).toBeUndefined(); // donjon non touché
    });

    it("mergeMultiDungeonTargetDates : tableau direct, et date retirée (null)", () => {
        const items = [{ ...dj("A", 1), targetDate: new Date("2026-09-20T18:00:00.000Z") }];
        const merged = mergeMultiDungeonTargetDates(items, [{ targetDate: null }]) as { targetDate: Date | null }[];
        expect(Array.isArray(merged)).toBe(true);
        expect(merged[0].targetDate).toBeNull();
        // Aucun donjon multi → on rend l'entrée telle quelle (pas de destruction).
        expect(mergeMultiDungeonTargetDates(null, [{ targetDate: null }])).toBeNull();
    });
});
