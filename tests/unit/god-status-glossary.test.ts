/**
 * God — **glossaire des statuts** (G1, lot D5).
 *
 * 🎯 Douleur mesurée : « c'est quoi autonome / pré-approuvé / à surveiller /
 * gelée-off » n'était expliqué nulle part dans l'écran ; pire, « À surveiller »
 * ressemblait à une sanction alors que c'est un **radar** (≤ 3 profils).
 *
 * Ce verrou protège trois choses :
 *  ① la règle pure (`src/lib/god-status-glossary.ts`) porte **une définition
 *    par statut** et les deux libellés ambigus ont été renommés ;
 *  ② la console God **consomme** cette règle (légende dépliable + `title` sur
 *    chaque badge) et n'affiche plus « À surveiller » nu ;
 *  ③ la fiche guilde dit l'**origine en une phrase datée**, pas un badge nu.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    GOD_STATUS_GLOSSARY,
    godStatusLabel,
    godStatusTitle,
} from "@/lib/god-status-glossary";

describe("glossaire God — une définition par statut", () => {
    it("chaque statut porte un libellé et une définition humaine", () => {
        expect(GOD_STATUS_GLOSSARY.length).toBeGreaterThanOrEqual(6);
        for (const entry of GOD_STATUS_GLOSSARY) {
            expect(entry.label.trim().length, `libellé vide pour ${entry.id}`).toBeGreaterThan(2);
            expect(entry.description.trim().length, `définition vide pour ${entry.id}`).toBeGreaterThan(20);
        }
    });

    it("les deux libellés ambigus sont renommés", () => {
        expect(godStatusLabel("PEU_DE_MEMBRES")).toBe("Peu de membres — à vérifier");
        expect(godStatusLabel("PEU_DE_MEMBRES")).not.toContain("À surveiller");
        expect(godStatusLabel("PRE_APPROUVEE")).not.toContain("(God)");
    });

    it("l'infobulle reprend le libellé et la définition, mot pour mot", () => {
        expect(godStatusTitle("GELEE")).toBe(
            `${godStatusLabel("GELEE")} — Accès coupé : la guilde n'est plus proposée et ses membres sont bloqués.`,
        );
    });

    it("le radar « peu de membres » n'est pas une sanction", () => {
        const entry = GOD_STATUS_GLOSSARY.find((item) => item.id === "PEU_DE_MEMBRES");
        expect(entry?.description).toContain("Ce n'est pas une sanction");
    });
});

describe("console God — le glossaire est branché dans l'écran", () => {
    const TABLE = readFileSync("src/app/god/components/guild-table.tsx", "utf8");
    const DETAIL = readFileSync("src/app/god/guilds/[id]/page.tsx", "utf8");

    it("la légende dépliable existe et affiche le glossaire", () => {
        expect(TABLE).toContain("Comprendre les statuts");
        expect(TABLE).toContain("GOD_STATUS_GLOSSARY.map");
        expect(TABLE).toContain("aria-expanded={open}");
    });

    it("chaque badge de statut porte son infobulle et « À surveiller » a disparu", () => {
        const titles = TABLE.match(/godStatusTitle\(/g) ?? [];
        expect(titles.length, "des badges de statut sont affichés sans infobulle").toBeGreaterThanOrEqual(5);
        expect(TABLE).not.toContain("À surveiller");
        expect(TABLE).toContain("Peu de membres — à vérifier");
    });

    it("la fiche guilde dit l'origine en une phrase datée", () => {
        expect(DETAIL).toContain("godStatusTitle(");
        expect(DETAIL).toMatch(/Installée en autonomie le \$\{createdAtLabel\}/);
        expect(DETAIL).toMatch(/Pré-approuvée par le staff le \$\{createdAtLabel\}/);
        expect(DETAIL).not.toContain("Créée le {new Date(guild.createdAt)");
    });
});
