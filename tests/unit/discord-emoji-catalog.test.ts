/**
 * Catalogue des emojis Discord (pictos Dofus des embeds).
 *
 * Verrous :
 *  · chaque entrée pointe un **asset local qui existe** (un chemin fautif ne se
 *    verrait qu'en production, au moment du rendu de l'embed) ;
 *  · chaque entrée a un **nom unique** (les noms sont la clé de résolution par nom,
 *    les ids étant propres à chaque application Discord) ;
 *  · chaque entrée de SECTION a un **repli unicode non vide** : sans repli, l'embed
 *    perdrait son picto si la synchro n'est pas jouée ou si Discord tombe ;
 *  · les 19 classes Dofus produisent bien 19 emojis (générés depuis `DOFUS_CLASSES`,
 *    donc jamais désynchronisés du site).
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import {
    DISCORD_EMOJIS,
    DISCORD_EMOJI_LIST,
    CLASS_EMOJI_PREFIX,
    classEmojiName,
} from "@/lib/discord-emoji-catalog";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";

describe("catalogue des emojis Discord", () => {
    it("chaque entrée pointe un asset local existant sous public/", () => {
        const missing = DISCORD_EMOJI_LIST
            .map((e) => e.file)
            .filter((file) => !existsSync(path.join(process.cwd(), "public", file)));
        expect(missing, `assets introuvables : ${missing.join(", ")}`).toEqual([]);
    });

    it("les noms sont uniques (clé de résolution par nom)", () => {
        const names = DISCORD_EMOJI_LIST.map((e) => e.name);
        expect(new Set(names).size).toBe(names.length);
        expect(Object.keys(DISCORD_EMOJIS).length).toBe(DISCORD_EMOJI_LIST.length);
    });

    it("les pictos de section gardent un repli unicode (jamais nu)", () => {
        const sections = DISCORD_EMOJI_LIST.filter((e) => !e.name.startsWith(CLASS_EMOJI_PREFIX));
        expect(sections.length).toBeGreaterThan(20);
        expect(sections.filter((e) => !e.fallback).map((e) => e.name)).toEqual([]);
    });

    it("les 19 classes produisent un emoji chacune, repli vide (comportement actuel)", () => {
        const classes = DISCORD_EMOJI_LIST.filter((e) => e.name.startsWith(CLASS_EMOJI_PREFIX));
        expect(classes).toHaveLength(DOFUS_CLASSES.length);
        expect(classes.every((e) => e.file.endsWith(".png"))).toBe(true);
        expect(classes.every((e) => e.fallback === "")).toBe(true);
    });

    it("classEmojiName accepte l'id comme le nom, en ignorant casse/espaces", () => {
        expect(classEmojiName("cra")).toBe(`${CLASS_EMOJI_PREFIX}cra`);
        expect(classEmojiName("Cra")).toBe(`${CLASS_EMOJI_PREFIX}cra`);
        expect(classEmojiName("  Féca ")).toBe(`${CLASS_EMOJI_PREFIX}feca`);
        expect(classEmojiName("Sans classe")).toBeNull();
        expect(classEmojiName(null)).toBeNull();
        expect(classEmojiName("")).toBeNull();
    });
});
