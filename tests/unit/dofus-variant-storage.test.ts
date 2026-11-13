/**
 * Brouillon **local** d'une variante (localStorage) — persistance avant publication.
 *
 * 🎯 Constat user du 23/10/2026 : « dès qu'on quitte la modale on perd la variante ».
 * Le brouillon couvre les trois cas : auteur hors ligne / action refusée / simple membre qui
 * teste une variante sans pouvoir la publier.
 *
 * 🔒 Entrée non fiable : une valeur corrompue est ignorée (jamais propagée à l'affichage).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    clearLocalVariant,
    readLocalVariant,
    variantStorageKey,
    writeLocalVariant,
} from "@/lib/dofus-variant-storage";

const store = new Map<string, string>();

beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
        localStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => store.delete(key),
        },
    });
});

const variant = {
    d1: {
        id: 5952,
        name: "Dofus Turquoise",
        picture: 5952,
        official: 5952,
        level: 200,
        typeName: "Dofus",
        effects: [{ code: "cc", min: 10, max: 10, value: 10 }],
    },
};

describe("brouillon local d'une variante", () => {
    it("relit ce qui a été écrit, objet par objet", () => {
        writeLocalVariant("build-1", variant);

        const read = readLocalVariant("build-1");
        expect(read.d1).toMatchObject({ id: 5952, name: "Dofus Turquoise", level: 200 });
        expect(read.d1.effects?.[0]).toEqual({ code: "cc", min: 10, max: 10, value: 10 });
    });

    it("isole les builds (aucun mélange entre deux cartes)", () => {
        writeLocalVariant("build-1", variant);
        expect(readLocalVariant("build-2")).toEqual({});
    });

    it("écrire une variante vide supprime le brouillon", () => {
        writeLocalVariant("build-1", variant);
        writeLocalVariant("build-1", {});

        expect(readLocalVariant("build-1")).toEqual({});
        expect(store.has(variantStorageKey("build-1"))).toBe(false);
    });

    it("ignore une entrée corrompue ou un slot inconnu", () => {
        store.set(variantStorageKey("build-1"), "{ pas du json");
        expect(readLocalVariant("build-1")).toEqual({});

        store.set(variantStorageKey("build-1"), JSON.stringify({ slotInconnu: variant.d1 }));
        expect(readLocalVariant("build-1")).toEqual({});
    });

    it("supporte l'absence de build ou de stockage", () => {
        expect(readLocalVariant(null)).toEqual({});
        expect(readLocalVariant("build-x")).toEqual({});

        vi.stubGlobal("window", undefined);
        expect(readLocalVariant("build-1")).toEqual({});
        expect(() => writeLocalVariant("build-1", variant)).not.toThrow();
        expect(() => clearLocalVariant("build-1")).not.toThrow();
    });

    it("clear supprime le brouillon", () => {
        writeLocalVariant("build-1", variant);
        clearLocalVariant("build-1");
        expect(readLocalVariant("build-1")).toEqual({});
    });
});
