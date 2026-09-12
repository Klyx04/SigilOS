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

import { getMultiDungeons, getDjPostTitle, getDjPostSubtitle } from "@/lib/dungeon-finder-utils";

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
