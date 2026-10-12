import { describe, expect, it } from "vitest";

import { extractNpcRef, npcPortraitUrl } from "@/lib/npc-portrait";

describe("npc-portrait — portraits PNJ par convention", () => {
    it("construit le chemin statique du portrait", () => {
        expect(npcPortraitUrl(2205)).toBe("/game-data/npcs/2205.png");
        expect(npcPortraitUrl("389")).toBe("/game-data/npcs/389.png");
    });

    it("refuse les ids inexploitables (jamais d'image cassée)", () => {
        expect(npcPortraitUrl(null)).toBeNull();
        expect(npcPortraitUrl(undefined)).toBeNull();
        expect(npcPortraitUrl(0)).toBeNull();
        expect(npcPortraitUrl(-5)).toBeNull();
        expect(npcPortraitUrl(NaN)).toBeNull();
        expect(npcPortraitUrl("Mériana")).toBeNull();
    });

    it("extrait la référence PNJ d'une entrée (nom + npcId + image de requirements)", () => {
        expect(extractNpcRef({ npcName: "Mériana", requirements: { npcId: 2205 } })).toEqual({
            id: 2205,
            name: "Mériana",
            imageUrl: null,
        });
        expect(extractNpcRef({ npcName: "  Mama Ayuto  ", requirements: {} })).toEqual({
            id: null,
            name: "Mama Ayuto",
            imageUrl: null,
        });
        expect(
            extractNpcRef({ npcName: "Otomaï", requirements: { npcId: 914, npcImageUrl: "/uploads/guides/a.webp" } }),
        ).toEqual({ id: 914, name: "Otomaï", imageUrl: "/uploads/guides/a.webp" });
        expect(extractNpcRef(null)).toEqual({ id: null, name: null, imageUrl: null });
        expect(extractNpcRef({})).toEqual({ id: null, name: null, imageUrl: null });
    });

    it("replie sur requirements.npc (saisies historiques sans colonne npcName)", () => {
        expect(extractNpcRef({ requirements: { npc: "Mérina", npcId: 2205 } })).toEqual({
            id: 2205,
            name: "Mérina",
            imageUrl: null,
        });
        expect(extractNpcRef({ npcName: "", requirements: { npc: "  Mériana  " } })).toEqual({
            id: null,
            name: "Mériana",
            imageUrl: null,
        });
    });
});
