/**
 * Chantier **N**, lot **N-1** — règles pures de l'activité de guilde et de ses annonces.
 *
 * 🛡️ Ce que ce test protège :
 * ① les **paliers de points de succès** (fixes, tous les 1 000) : on ne fête que les
 *    **franchissements**, jamais une **baisse** (le ladder recalcule), un rattrapage est **borné**,
 *    et `successPoints` **null ⇒ 0** (fail-closed) ;
 * ② l'**entrée** dans le top du ladder succès : annoncée **une seule fois**, jamais un maintien ni
 *    une sortie ;
 * ③ les **préférences** : défaut **ON**, **seul un `false` explicite** coupe, JSON corrompu ⇒ ON ;
 * ④ la **copie** : elle nomme le membre, reste du texte borné, jamais du HTML interprété.
 */

import { describe, expect, it } from "vitest";
import {
    GUILD_ACTIVITY_KINDS,
    GUILD_ACTIVITY_MODULE_BY_KIND,
    GUILD_ACTIVITY_PREF_COUNT,
    GUILD_ACTIVITY_PREF_KEYS,
    GUILD_ACTIVITY_PREF_LABELS,
    LADDER_TOP_SIZE,
    SUCCESS_POINTS_MAX,
    SUCCESS_POINTS_MAX_MILESTONES_PER_JUMP,
    buildGuildActivityCopy,
    formatSuccessPoints,
    normalizeSuccessPoints,
    resolveGuildActivityKind,
    resolveHighestSuccessPointsMilestone,
    resolveLadderTopEntry,
    resolveSuccessPointsMilestones,
    sanitizeGuildActivityName,
    shouldNotifyGuildActivity,
} from "@/lib/guild-activity";

describe("paliers de points de succès", () => {
    it("ne fête rien avant le premier palier", () => {
        expect(resolveSuccessPointsMilestones(0, 999)).toEqual([]);
    });

    it("fête le palier atteint (bord exact)", () => {
        expect(resolveSuccessPointsMilestones(999, 1000)).toEqual([1000]);
        expect(resolveSuccessPointsMilestones(1000, 1000)).toEqual([]);
    });

    it("fête chaque palier franchi d'un saut", () => {
        expect(resolveSuccessPointsMilestones(1900, 3100)).toEqual([2000, 3000]);
    });

    it("ne fête rien quand les points baissent (recalcul du ladder)", () => {
        expect(resolveSuccessPointsMilestones(1500, 900)).toEqual([]);
    });

    it("traite un score inconnu (null) comme 0 — jamais comme « un palier atteint »", () => {
        expect(normalizeSuccessPoints(null)).toBe(0);
        expect(resolveSuccessPointsMilestones(null, 1000)).toEqual([1000]);
        expect(resolveSuccessPointsMilestones(1000, null)).toEqual([]);
        expect(resolveSuccessPointsMilestones(null, null)).toEqual([]);
    });

    it("borne un rattrapage aux paliers les plus récents", () => {
        const milestones = resolveSuccessPointsMilestones(0, 30_000);
        expect(milestones).toHaveLength(SUCCESS_POINTS_MAX_MILESTONES_PER_JUMP);
        expect(milestones[milestones.length - 1]).toBe(30_000);
    });

    it("le plus haut palier franchi est celui annoncé", () => {
        expect(resolveHighestSuccessPointsMilestone(1900, 3100)).toBe(3000);
        expect(resolveHighestSuccessPointsMilestone(100, 200)).toBeNull();
    });
});

describe("normalizeSuccessPoints", () => {
    it("refuse tout ce qui n'est pas un entier positif fini", () => {
        for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -5, "abc", "", {}, []]) {
            expect(normalizeSuccessPoints(value)).toBe(0);
        }
    });

    it("accepte une chaîne d'entiers (valeur relue d'un JSON) et borne le plafond", () => {
        expect(normalizeSuccessPoints("1500")).toBe(1500);
        expect(normalizeSuccessPoints(SUCCESS_POINTS_MAX + 10)).toBe(SUCCESS_POINTS_MAX);
    });
});

describe("entrée dans le top du ladder succès", () => {
    it("annonce l'entrée dans le top", () => {
        expect(resolveLadderTopEntry({ previousRank: 5, currentRank: 3 })).toBe(3);
        expect(resolveLadderTopEntry({ previousRank: null, currentRank: 1 })).toBe(1);
    });

    it("n'annonce rien quand on y était déjà, qu'on progresse dedans ou qu'on en sort", () => {
        expect(resolveLadderTopEntry({ previousRank: 3, currentRank: 2 })).toBeNull();
        expect(resolveLadderTopEntry({ previousRank: 4, currentRank: 5 })).toBeNull();
        expect(resolveLadderTopEntry({ previousRank: 2, currentRank: 7 })).toBeNull();
        expect(resolveLadderTopEntry({ previousRank: null, currentRank: LADDER_TOP_SIZE + 1 })).toBeNull();
    });
});

describe("préférences du membre", () => {
    it("par défaut tout est activé, même sans préférences", () => {
        expect(shouldNotifyGuildActivity({ kind: "missions", prefs: undefined })).toBe(true);
        expect(shouldNotifyGuildActivity({ kind: "paliers", prefs: {} })).toBe(true);
    });

    it("seul un false explicite coupe, et seulement la clé concernée", () => {
        const prefs = { missions: false };
        expect(shouldNotifyGuildActivity({ kind: "missions", prefs })).toBe(false);
        expect(shouldNotifyGuildActivity({ kind: "donjons", prefs })).toBe(true);
        expect(shouldNotifyGuildActivity({ kind: "missions", prefs: { missions: "false" } })).toBe(true);
    });

    it("un JSON corrompu n'accorde ni ne coupe : il retombe sur le défaut", () => {
        for (const prefs of [null, "x", 12, [], true]) {
            expect(shouldNotifyGuildActivity({ kind: "dofus", prefs })).toBe(true);
        }
    });

    it("chaque type a sa clé, son libellé, et réutilise les clés déjà connues du profil", () => {
        expect(GUILD_ACTIVITY_KINDS).toHaveLength(GUILD_ACTIVITY_PREF_COUNT);
        for (const kind of GUILD_ACTIVITY_KINDS) {
            expect(GUILD_ACTIVITY_PREF_KEYS[kind]).toBe(kind);
            expect(GUILD_ACTIVITY_PREF_LABELS[kind].label.length).toBeGreaterThan(0);
        }
        // Clés **déjà** écrites par `user-settings.tsx:115-127` ⇒ aucune migration nécessaire.
        for (const existing of ["missions", "songes", "donjons", "events", "ladder", "ocre"] as const) {
            expect(GUILD_ACTIVITY_PREF_KEYS[existing]).toBe(existing);
        }
    });
});

describe("lien avec le flux (N-2)", () => {
    it("chaque type a UN module, et le relire redonne le même type (écriture et lecture ne divergent pas)", () => {
        for (const kind of GUILD_ACTIVITY_KINDS) {
            const module = GUILD_ACTIVITY_MODULE_BY_KIND[kind];
            expect(typeof module).toBe("string");
            expect(resolveGuildActivityKind(module)).toBe(kind);
        }
    });

    it("relit aussi les types historiques du flux (sinon ils échapperaient au filtre de préférences)", () => {
        expect(resolveGuildActivityKind("MISSION_VALIDATED")).toBe("missions");
        expect(resolveGuildActivityKind("OCRE_TRADE")).toBe("ocre");
    });

    it("fail-closed : un module inconnu ne devient pas une activité de guilde", () => {
        expect(resolveGuildActivityKind("SERVICE")).toBeNull();
        expect(resolveGuildActivityKind("VAULT")).toBeNull();
        expect(resolveGuildActivityKind(null)).toBeNull();
        expect(resolveGuildActivityKind(42)).toBeNull();
    });

    it("les modules sont uniques (deux types ne peuvent pas se confondre dans le flux)", () => {
        const modules = GUILD_ACTIVITY_KINDS.map((kind) => GUILD_ACTIVITY_MODULE_BY_KIND[kind]);
        expect(new Set(modules).size).toBe(modules.length);
    });
});

describe("copie de l'annonce", () => {
    it("nomme le membre et dit ce qui s'est passé", () => {
        expect(buildGuildActivityCopy({ kind: "dofus", memberName: "wylan", detail: "Dofus Émeraude" })).toEqual({
            title: "Dofus validé",
            message: "wylan valide le Dofus Émeraude !",
        });
        expect(buildGuildActivityCopy({ kind: "paliers", memberName: "wylan", points: 1000 }).message).toMatch(/1\s?000/);
        expect(buildGuildActivityCopy({ kind: "ladder", memberName: "wylan" }).message).toContain(
            `${LADDER_TOP_SIZE} premiers`,
        );
    });

    it("ne casse pas sur un membre inconnu et borne son nom", () => {
        expect(sanitizeGuildActivityName(null)).toBe("Un membre");
        expect(sanitizeGuildActivityName("   ")).toBe("Un membre");
        expect(sanitizeGuildActivityName("a".repeat(200)).length).toBeLessThanOrEqual(40);
        expect(sanitizeGuildActivityName("wylan\u0007")).toBe("wylan");
    });

    it("reste du texte : un pseudo HTML n'est jamais interprété", () => {
        const copy = buildGuildActivityCopy({ kind: "missions", memberName: "<img src=x onerror=1>" });
        expect(copy.message).toContain("<img src=x onerror=1>");
        expect(typeof copy.message).toBe("string");
    });

    it("affiche les points au format français", () => {
        expect(formatSuccessPoints(1000)).toMatch(/^1\s?000$/);
        expect(formatSuccessPoints(null)).toBe("0");
    });
});
