/**
 * Succès de donjon du guide — **règles pures**.
 *
 * Ce que ces verrous tiennent :
 *  · le `+` n'est proposé que pour un donjon requis et résolu en base ;
 *  · le faux « Donjon validé » n'est jamais listé dans le panneau ;
 *  · le compteur ne compte que la liste filtrée ;
 *  · le personnage visiteur est rapproché par pseudo, sinon lecture seule.
 */

import { describe, it, expect } from "vitest";
import {
    achievementPanelMode,
    achievementPanelSummary,
    canOpenDungeonAchievements,
    listableDungeonAchievements,
    resolveVisitorAchievementSlot,
} from "@/lib/rush-dungeon-achievements";

describe("mode du panneau", () => {
    it("un membre de guilde (guildId réel, pas invité) est en mode member", () => {
        expect(
            achievementPanelMode({ guildId: "123", isGuest: false, feedbackSignedIn: true })
        ).toBe("member");
    });

    it("le guide public connecté (isGuest=true + session) est en mode visitor", () => {
        expect(
            achievementPanelMode({ guildId: "public", isGuest: true, feedbackSignedIn: true })
        ).toBe("visitor");
    });

    it("sans session, le guide public est en mode guest", () => {
        expect(
            achievementPanelMode({ guildId: "public", isGuest: true, feedbackSignedIn: false })
        ).toBe("guest");
    });
});

describe("ouverture du panneau", () => {
    it("ouvre un donjon requis et résolu par son id", () => {
        expect(canOpenDungeonAchievements({ id: "d1", isOptional: false })).toBe(true);
    });

    it("ouvre un donjon résolu par son slug", () => {
        expect(canOpenDungeonAchievements({ slug: "kankreblath" })).toBe(true);
    });

    it("n'ouvre pas un donjon optionnel", () => {
        expect(canOpenDungeonAchievements({ id: "d1", isOptional: true })).toBe(false);
    });

    it("n'ouvre pas un nom non résolu en base (aucune fiche, aucun succès)", () => {
        expect(canOpenDungeonAchievements({ id: null, slug: null })).toBe(false);
    });
});

describe("liste des succès", () => {
    it("écarte toujours le faux « Donjon validé »", () => {
        const list = listableDungeonAchievements([
            { id: "a", slug: "donjon-valide" },
            { id: "b", slug: "sans-mort" },
        ]);
        expect(list.map((achievement) => achievement.id)).toEqual(["b"]);
    });

    it("garde les vrais succès et leur ordre", () => {
        const list = listableDungeonAchievements([
            { id: "a", slug: "sans-mort" },
            { id: "b", slug: "rapide" },
        ]);
        expect(list.map((achievement) => achievement.id)).toEqual(["a", "b"]);
    });
});

describe("compteur du panneau", () => {
    it("compte les succès cochés sur la liste filtrée", () => {
        expect(achievementPanelSummary([{ id: "a" }, { id: "b" }], ["a"])).toEqual({
            total: 2,
            done: 1,
            allDone: false,
            isEmpty: false,
        });
    });

    it("dit l'état vide sans inventer de succès", () => {
        expect(achievementPanelSummary([], [])).toEqual({
            total: 0,
            done: 0,
            allDone: false,
            isEmpty: true,
        });
    });

    it("dit tout validé quand toutes les coches sont là", () => {
        expect(achievementPanelSummary([{ id: "a" }], ["a"]).allDone).toBe(true);
    });
});

describe("personnage visiteur", () => {
    const characters = [
        { slot: "PRINCIPAL", name: "MonIop", isMain: true },
        { slot: "Mule", name: "MaMule", isMain: false },
    ];

    it("sans pseudo invité, utilise le personnage principal", () => {
        expect(resolveVisitorAchievementSlot(null, characters)).toBe("PRINCIPAL");
    });

    it("rapproche le pseudo principal sans tenir compte de la casse", () => {
        expect(resolveVisitorAchievementSlot("moniop", characters)).toBe("PRINCIPAL");
    });

    it("rapproche une mule déclarée", () => {
        expect(resolveVisitorAchievementSlot("mamule", characters)).toBe("Mule");
    });

    it("un pseudo non déclaré reste non résolu (lecture seule, sélecteur)", () => {
        expect(resolveVisitorAchievementSlot("Inconnu", characters)).toBeNull();
    });
});
