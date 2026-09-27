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
 *    donc jamais désynchronisés du site) ;
 *  · chaque PNG de `public/game-data/achievements/` a son emoji (anti-dérive : un
 *    succès ajouté côté site ne doit pas disparaître silencieusement des embeds).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import {
    DISCORD_EMOJIS,
    DISCORD_EMOJI_LIST,
    CLASS_EMOJI_PREFIX,
    ACHIEVEMENT_EMOJI_PREFIX,
    classEmojiName,
    achievementEmojiName,
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
        const sections = DISCORD_EMOJI_LIST.filter(
            (e) => !e.name.startsWith(CLASS_EMOJI_PREFIX) && !e.name.startsWith(ACHIEVEMENT_EMOJI_PREFIX)
        );
        expect(sections.length).toBeGreaterThan(20);
        expect(sections.filter((e) => !e.fallback).map((e) => e.name)).toEqual([]);
    });

    it("les 27 succès visés ont leur picto, repli « • » (puce historique)", () => {
        const achievements = DISCORD_EMOJI_LIST.filter((e) => e.name.startsWith(ACHIEVEMENT_EMOJI_PREFIX));
        expect(achievements).toHaveLength(27);
        expect(achievements.every((e) => e.fallback === "•")).toBe(true);
        // Deux règles Discord : nom ≤ 32 caractères, minuscules/chiffres/`_` uniquement.
        const invalid = achievements
            .filter((e) => !/^[a-z0-9_]+$/.test(e.name) || e.name.length > 32)
            .map((e) => e.name);
        expect(invalid, `noms refusés par Discord : ${invalid.join(", ")}`).toEqual([]);
    });

    it("chaque PNG de game-data/achievements a son emoji (anti-dérive)", () => {
        const dir = path.join(process.cwd(), "public", "game-data", "achievements");
        const assets = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".png"));
        expect(assets.length).toBeGreaterThan(20);
        // « spécial.png » et « special.png » sont le MÊME fichier (MD5 identique) : la clé
        // normalise les accents, donc les deux pointent `dofus_success_special`.
        const orphans = assets.filter((f) => !achievementEmojiName(`/game-data/achievements/${f}`));
        expect(orphans, `succès sans emoji : ${orphans.join(", ")}`).toEqual([]);
    });

    it("achievementEmojiName clé = nom de fichier (accents, tirets, inconnu)", () => {
        expect(achievementEmojiName("/game-data/achievements/duo.png")).toBe(`${ACHIEVEMENT_EMOJI_PREFIX}duo`);
        expect(achievementEmojiName("/game-data/achievements/spécial.png")).toBe(`${ACHIEVEMENT_EMOJI_PREFIX}special`);
        expect(achievementEmojiName("/game-data/achievements/en-ligne-de-mire.png")).toBe(`${ACHIEVEMENT_EMOJI_PREFIX}en_ligne_de_mire`);
        // Succès sans asset local (URL d'API) ou donnée absente → puce historique.
        expect(achievementEmojiName("https://api.dofusdb.fr/img/challenges/42.png")).toBeNull();
        expect(achievementEmojiName("/game-data/achievements/inexistant.png")).toBeNull();
        expect(achievementEmojiName(null)).toBeNull();
        expect(achievementEmojiName("")).toBeNull();
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
