/**
 * Tests unitaires — Chantier Inter-Guilde (19/08)
 * `src/lib/inter-guild.ts` (logique pure, partagée client/serveur).
 * Sécurité (fail-closed) :
 *  - Le scope effectif = le PLUS RESTRICTIF entre guilde et God.
 *  - Un override God "OFF" coupe le module partout, même si la guilde a ouvert.
 *  - Un scope invalide (JSON corrompu / clé inconnue) → OFF.
 *  - Par défaut : SERVER pour les modules de guilde, GLOBAL pour gallery/minigames.
 */

import { describe, it, expect } from "vitest";
import {
    resolveInterGuildScope,
    restrictScope,
    parseScope,
    isScopeOpen,
    INTER_GUILD_DEFAULTS,
    INTER_GUILD_MODULES,
    scopeRank,
} from "@/lib/inter-guild";

describe("inter-guild — scopes par défaut", () => {
    it("welcome/members/calendar/… sont SERVER par défaut", () => {
        expect(INTER_GUILD_DEFAULTS.welcome).toBe("SERVER");
        expect(INTER_GUILD_DEFAULTS.members).toBe("SERVER");
        expect(INTER_GUILD_DEFAULTS.calendar).toBe("SERVER");
        expect(INTER_GUILD_DEFAULTS.ocre).toBe("SERVER");
        expect(INTER_GUILD_DEFAULTS.quests).toBe("SERVER");
    });

    it("gallery et minigames sont GLOBAL par défaut", () => {
        expect(INTER_GUILD_DEFAULTS.gallery).toBe("GLOBAL");
        expect(INTER_GUILD_DEFAULTS.minigames).toBe("GLOBAL");
    });

    it("tous les modules éligibles ont un défaut défini", () => {
        for (const m of INTER_GUILD_MODULES) {
            expect(INTER_GUILD_DEFAULTS[m]).toBeDefined();
        }
    });
});

describe("inter-guild — résolution du scope (fail-closed)", () => {
    it("aucune surcharge → défaut du module", () => {
        expect(resolveInterGuildScope("welcome", null, null)).toBe("SERVER");
        expect(resolveInterGuildScope("gallery", {}, {})).toBe("GLOBAL");
    });

    it("module non éligible → OFF", () => {
        expect(resolveInterGuildScope("missions", null, null)).toBe("OFF");
        expect(resolveInterGuildScope("sondages", null, null)).toBe("OFF");
    });

    it("surcharge guilde appliquée", () => {
        expect(resolveInterGuildScope("welcome", { welcome: "OFF" }, null)).toBe("OFF");
        expect(resolveInterGuildScope("welcome", { welcome: "GLOBAL" }, null)).toBe("GLOBAL");
    });

    it("surcharge guilde seule s'applique sans override God (absent ≠ OFF)", () => {
        expect(resolveInterGuildScope("welcome", { welcome: "GLOBAL" }, {})).toBe("GLOBAL");
        expect(resolveInterGuildScope("gallery", { gallery: "SERVER" }, null)).toBe("SERVER");
    });

    it("une surcharge God seule restreint mais n'élargit jamais", () => {
        expect(resolveInterGuildScope("welcome", null, { welcome: "OFF" })).toBe("OFF");
        // God GLOBAL ne peut pas élargir au-delà du défaut (SERVER) du module.
        expect(resolveInterGuildScope("welcome", null, { welcome: "GLOBAL" })).toBe("SERVER");
        expect(resolveInterGuildScope("gallery", null, { gallery: "OFF" })).toBe("OFF");
    });

    it("override God OFF coupe même si la guilde a ouvert (fail-closed prioritaire)", () => {
        expect(resolveInterGuildScope("welcome", { welcome: "GLOBAL" }, { welcome: "OFF" })).toBe("OFF");
        expect(resolveInterGuildScope("gallery", { gallery: "GLOBAL" }, { gallery: "OFF" })).toBe("OFF");
    });

    it("God SERVER restreint un GLOBAL guilde (le plus restrictif gagne)", () => {
        expect(resolveInterGuildScope("gallery", { gallery: "GLOBAL" }, { gallery: "SERVER" })).toBe("SERVER");
    });

    it("God GLOBAL n'élargit pas un SERVER guilde (le plus restrictif gagne)", () => {
        expect(resolveInterGuildScope("welcome", { welcome: "SERVER" }, { welcome: "GLOBAL" })).toBe("SERVER");
    });

    it("valeur de scope invalide → OFF (JSON corrompu ou clé inconnue)", () => {
        // Valeur guilde présente mais invalide → fail-closed OFF.
        expect(resolveInterGuildScope("welcome", { welcome: "PIRATE" }, null)).toBe("OFF");
        expect(resolveInterGuildScope("welcome", { welcome: null }, null)).toBe("SERVER"); // null = absent → défaut
        // Valeur God présente mais invalide → fail-closed OFF.
        expect(resolveInterGuildScope("gallery", { gallery: "GLOBAL" }, { gallery: "PIRATE" })).toBe("OFF");
        expect(parseScope("n'importe quoi")).toBe("OFF");
        expect(parseScope(42)).toBe("OFF");
    });
});

describe("inter-guild — helpers de scope", () => {
    it("restrictScope choisit toujours le plus restrictif", () => {
        expect(restrictScope("GLOBAL", "SERVER")).toBe("SERVER");
        expect(restrictScope("SERVER", "OFF")).toBe("OFF");
        expect(restrictScope("SERVER", "SERVER")).toBe("SERVER");
    });

    it("scopeRank ordonne OFF < SERVER < GLOBAL", () => {
        expect(scopeRank("OFF")).toBeLessThan(scopeRank("SERVER"));
        expect(scopeRank("SERVER")).toBeLessThan(scopeRank("GLOBAL"));
    });

    it("isScopeOpen est vrai uniquement pour un scope ouvert", () => {
        expect(isScopeOpen("SERVER")).toBe(true);
        expect(isScopeOpen("GLOBAL")).toBe(true);
        expect(isScopeOpen("OFF")).toBe(false);
        expect(isScopeOpen(null)).toBe(false);
        expect(isScopeOpen(undefined)).toBe(false);
    });
});
