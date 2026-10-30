/**
 * Garde — PARITÉ du bloc de caractéristiques d'un monstre entre les trois surfaces d'une fiche
 * boss : publique (`/boss/<slug>`), interne du module Succès et fiche Titan.
 *
 * Défaut mesuré (30/10/2026) : la fiche Titan portait **sa** version du bloc — pictos
 * `/assets/module-succes/*`, cinq couleurs d'accent, pastilles « Butin 4..8 » et rayons 16 px —
 * là où les deux fiches boss utilisaient déjà `/assets/dofus/stats/*` et des valeurs neutres.
 * Trois implémentations pour la même donnée ⇒ le Titan ne ressemblait pas à une fiche boss et
 * le sélecteur « Butin » mentait sur son sens (c'est un **rang** de monstre).
 *
 * 🛡️ Une seule définition désormais : `@/components/succes/MonsterStatsSummary`. Ce test verrouille
 * la règle de contenu (rendu) **et** le câblage (aucune surface ne réimplémente les cartes).
 *
 * Lecture seule : aucune base, aucun navigateur.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
    MonsterStatsSummary,
    type MonsterStatsGradeView,
} from "@/components/succes/MonsterStatsSummary";

const PUBLIC_FICHE = "src/app/boss/[dungeonId]/_components/PublicBossDetailClient.tsx";
const INTERNAL_GUIDE = "src/components/succes/SuccesBossGuide.tsx";
const TITAN_TAB = "src/components/succes/SuccesTitanTab.tsx";
const OVERLAY = "src/components/boss-overlay/BossOverlayClient.tsx";
const COMPONENT = "src/components/succes/MonsterStatsSummary.tsx";

const read = (path: string) => readFileSync(path, "utf8");

/** Code seul : les commentaires citent des chemins d'assets (ils ne les rendent pas). */
const codeOf = (path: string) =>
    read(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Un grade conforme à ce que produit notre base (mesuré : `MonsterStat.stats.grades[]`). */
const grade = (overrides: Partial<MonsterStatsGradeView> = {}): MonsterStatsGradeView => ({
    level: 200,
    lifePoints: 6000,
    actionPoints: 12,
    movementPoints: 5,
    resists: { neutral: 21, earth: 6, fire: -14, water: 36, air: 11 },
    carac: { agility: 600 },
    ...overrides,
});

const html = (
    grades: MonsterStatsGradeView[],
    activeGradeIndex: number | null = null,
    locale: "fr" | "en" = "fr",
) =>
    renderToStaticMarkup(
        React.createElement(MonsterStatsSummary, {
            grades,
            activeGradeIndex,
            onGradeChange: () => {},
            locale,
        }),
    );

describe("bloc de stats partagé — câblage des trois surfaces", () => {
    for (const [surface, path] of [
        ["fiche publique", PUBLIC_FICHE],
        ["fiche interne", INTERNAL_GUIDE],
        ["fiche Titan", TITAN_TAB],
    ] as const) {
        it(`${surface} consomme le composant partagé (aucun recodage local)`, () => {
            const code = read(path);
            expect(code, surface).toMatch(
                /import \{[^}]*MonsterStatsSummary[^}]*\} from "(@\/components\/succes|\.)\/MonsterStatsSummary"/,
            );
            expect(code, surface).toMatch(/<MonsterStatsSummary/);
            // Les 3 cartes PV/PA/PM ne vivent plus que dans le composant partagé.
            expect(code, surface).not.toContain("/assets/dofus/stats/pv.png");
        });
    }

    it("la fiche Titan ne parle plus de « Butin » et n'utilise plus les pictos module-succes", () => {
        const code = read(TITAN_TAB);
        expect(code).not.toContain("/assets/module-succes/");
        // « Butin 4..8 » : le sélecteur prétendait choisir une tranche de butin, c'est un rang.
        expect(code).not.toMatch(/Butin \$\{4 \+ idx\}/);
        expect(code).not.toMatch(/Butin \{4 \+ idx\}/);
        expect(code).not.toContain("Butin");
    });

    it("l'overlay n'est pas refondu mais garde les mêmes assets (décision du 30/10/2026)", () => {
        const code = read(OVERLAY);
        expect(code).toContain("/assets/dofus/stats/pv.png");
        expect(code).toContain("/assets/dofus/stats/resNeutre.png");
    });

    it("le composant n'utilise que les pictogrammes Dofus officiels", () => {
        const assets = codeOf(COMPONENT).match(/\/assets\/[^"]+/g) ?? [];
        expect(assets.length).toBeGreaterThan(0);
        for (const asset of assets) expect(asset.startsWith("/assets/dofus/stats/"), asset).toBe(true);
    });

    it("règles UI : rayons ≤ 12 px, aucun accent décoratif, aucun font-black", () => {
        const code = read(COMPONENT);
        expect(code).not.toContain("font-black");
        expect(code).not.toMatch(/rounded-(?:2xl|3xl|full|\[1[3-9]px\]|\[2\dpx\])/);
        expect(code).not.toMatch(/bg-(?:warning|danger|info|success)/);
        // Seule une valeur négative porte la teinte d'alerte, et l'état actif reste neutre.
        expect(code).toContain("text-danger");
        expect(code).toContain("bg-foreground");
        expect(code).toContain("text-background");
    });
});

describe("bloc de stats partagé — contenu rendu (aucun navigateur)", () => {
    it("sans caractéristiques : « — » partout, jamais un 0 % inventé", () => {
        const out = html([{ level: 200 }]);
        expect(out).toContain("—");
        expect(out).not.toContain("0%");
    });

    it("une résistance négative est la SEULE à porter la teinte d'alerte", () => {
        const out = html([grade()], 0);
        expect(out).toContain("-14%");
        expect(out.match(/text-danger/g) ?? []).toHaveLength(1);
    });

    it("tacle/fuite dérivés de l'agilité quand le grade ne les publie pas", () => {
        // `carac.agility = 600` ⇒ floor(600 / 10) = 60 : la règle du jeu, jamais une valeur inventée.
        const out = html([grade()], 0);
        expect(out).toMatch(/>60</);
    });

    it("dit « Rang », jamais « Butin », et ne marque qu'un rang actif", () => {
        const out = html([grade({ lifePoints: 1000 }), grade({ lifePoints: 2000 })], 99);
        expect(out).toContain("Rang :");
        expect(out).not.toContain("Butin");
        // Index hors bornes (liste rechargée) ⇒ le dernier grade, comme les fiches boss.
        expect(out.match(/aria-pressed="true"/g) ?? []).toHaveLength(1);
        expect(out).toMatch(/aria-pressed="true"[^>]*>2<\/button>/);
    });

    it("état de chargement : le libellé dit ce qu'il charge", () => {
        const out = renderToStaticMarkup(
            React.createElement(MonsterStatsSummary, {
                grades: [],
                activeGradeIndex: null,
                loading: true,
                loadingLabel: "Chargement des caractéristiques de X…",
            }),
        );
        expect(out).toContain("Chargement des caractéristiques de X…");
        expect(out).toContain("animate-spin");
    });

    it("bascule FR/EN sans changer d'assets (une seule présentation)", () => {
        const out = html([grade()], 0, "en");
        expect(out).toContain("Resistances");
        expect(out).toContain(">Lock<");
        expect(out).toContain("/assets/dofus/stats/resNeutre.png");
    });
});
