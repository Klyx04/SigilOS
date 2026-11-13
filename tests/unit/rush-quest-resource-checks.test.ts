/**
 * Gardes — coches de ressources liées à la validation d'une quête.
 *
 * 🎯 Demande user (02/11/2026) : « permettre aux gens de cocher les ressources
 * demandées dans chaque quête dans la vue détaillée · une fois la quête validée ça
 * override et valide tout · quête invalidée > décocher tout · overlay, guide interne,
 * guide public ».
 *
 * 🛡️ Ce que ce test verrouille (règle pure) :
 *  · les clés sont celles de `rushResourceKey`, dédupliquées, avec les mêmes
 *    exclusions que l'agrégation (phrases d'action, donjons déguisés) ;
 *  · valider ajoute les clés de la quête sans toucher aux autres ;
 *  · invalider retire exactement ces clés ;
 *  · aucune mutation de l'ensemble d'entrée.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyQuestResourceChecks, resourceKeysForTags } from "@/lib/rush-resource-checks";
import { rushResourceKey } from "@/lib/rush-guide-utils";
import { QuestItemResourceGrid } from "@/components/dofus-quests/rush/QuestItemResourceGrid";

const key = (id: string, name: string) => rushResourceKey({ id, name });

describe("resourceKeysForTags — une seule lecture des tags", () => {
    it("normalise et déduplique les ressources de la quête", () => {
        const keys = resourceKeysForTags([
            { type: "item", id: "1", name: "Eau Potable" },
            { type: "item", id: "1", name: "  EAU   POTABLE " },
            { type: "item", id: "2", name: "Bois de Frêne" },
        ]);
        expect(keys).toEqual([key("1", "Eau Potable"), key("2", "Bois de Frêne")]);
    });

    it("ignore tout ce qui n'est pas une ressource (mêmes exclusions que l'agrégation)", () => {
        const keys = resourceKeysForTags([
            { type: "prereq_text", name: "Quête X" },
            { type: "item", name: "" },
            { type: "item", kind: "instruction", name: "Parler à X" },
            { type: "item", kind: "unresolved", name: "Donjon avec altération Idole de X" },
            { type: "item", id: "3", name: "Or" },
        ]);
        expect(keys).toEqual([key("3", "Or")]);
    });
});

describe("applyQuestResourceChecks — valider coche, invalider décoche", () => {
    const tags = [
        { type: "item", id: "1", name: "Eau Potable" },
        { type: "item", id: "2", name: "Bois de Frêne" },
    ];

    it("valider une quête ajoute toutes ses ressources, sans toucher aux autres", () => {
        const before = new Set([key("9", "Autre")]);
        const after = applyQuestResourceChecks(before, tags, true);
        expect([...after].sort()).toEqual(
            [key("9", "Autre"), key("1", "Eau Potable"), key("2", "Bois de Frêne")].sort()
        );
        // Aucune mutation de l'entrée.
        expect([...before]).toEqual([key("9", "Autre")]);
    });

    it("invalider une quête retire exactement ses ressources", () => {
        const before = new Set([key("9", "Autre"), key("1", "Eau Potable"), key("2", "Bois de Frêne")]);
        const after = applyQuestResourceChecks(before, tags, false);
        expect([...after]).toEqual([key("9", "Autre")]);
    });

    it("une quête sans ressource ne change rien", () => {
        const before = new Set([key("9", "Autre")]);
        expect([...applyQuestResourceChecks(before, [], true)]).toEqual([key("9", "Autre")]);
        expect([...applyQuestResourceChecks(before, null, false)]).toEqual([key("9", "Autre")]);
    });
});

describe("QuestItemResourceGrid — la fiche rend une case par ressource", () => {
    const items = [
        { type: "item", id: "1", name: "Eau Potable", count: 2 },
        { type: "item", id: "2", name: "Bois de Frêne", count: 3 },
    ] as never;

    it("coche la ressource déjà préparée et laisse l'autre décochée", () => {
        const out = renderToStaticMarkup(
            React.createElement(QuestItemResourceGrid, {
                items,
                showHeaderMeta: false,
                checkedKeys: new Set([key("1", "Eau Potable")]),
                onToggleCheck: () => {},
            } as never)
        );
        expect(out.match(/aria-pressed="true"/g)?.length).toBe(1);
        expect(out.match(/aria-pressed="false"/g)?.length).toBe(1);
        expect(out).toContain("Déjà préparé — cliquer pour décocher");
        expect(out).toContain("J&#x27;ai déjà préparé cet objet");
    });

    it("sans handler, aucune case n'est rendue (lecture seule)", () => {
        const out = renderToStaticMarkup(
            React.createElement(QuestItemResourceGrid, { items, showHeaderMeta: false } as never)
        );
        expect(out).not.toContain("aria-pressed=");
    });
});
