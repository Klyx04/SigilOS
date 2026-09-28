/**
 * Garde de câblage (lecture source) — **`OverviewTabs` rend ses quatre sections**.
 *
 * Régression d'origine (`fbbbc8a8` → corrigée le 28/09/2026, chantier D-2) : les props
 * `stats` et `chart` étaient **déclarées, reçues, passées… et jamais rendues** — l'écran God
 * affichait « 0 » sans qu'aucun test ni aucune erreur ne le signale.
 *
 * Ici on verrouille la **donnée**, pas le style : chaque prop déclarée doit être rendue
 * **une fois et une seule**, et `god/page.tsx` doit continuer à les passer toutes les quatre.
 * Un composant qui « avale » une section casse ce test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const COMPONENT = "src/app/god/components/overview-tabs.tsx";
const PAGE = "src/app/god/page.tsx";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const COMPONENT_CODE = codeOnly(readFileSync(COMPONENT, "utf8"));
const PAGE_CODE = codeOnly(readFileSync(PAGE, "utf8"));

/** Props déclarées dans `interface OverviewTabsProps`, dans l'ordre du fichier. */
function declaredProps(source: string): string[] {
    const body = /interface OverviewTabsProps\s*\{([\s\S]*?)\}/.exec(source)?.[1] ?? "";
    return [...body.matchAll(/(\w+)\s*:\s*React\.ReactNode/g)].map((match) => match[1]);
}

describe("OverviewTabs — une prop reçue est une prop rendue", () => {
    const props = declaredProps(COMPONENT_CODE);

    it("déclare les quatre sections attendues", () => {
        expect(props).toEqual(["stats", "chart", "communication", "worker"]);
    });

    it("rend chaque prop exactement une fois", () => {
        for (const prop of props) {
            const rendered = COMPONENT_CODE.match(new RegExp(`\\{${prop}\\}`, "g")) ?? [];
            expect(rendered.length, `« ${prop} » est déclarée mais jamais rendue (ou rendue deux fois)`).toBe(1);
        }
    });

    it("l'écran God passe bien les quatre props", () => {
        const call = /<OverviewTabs([\s\S]*?)\n\s*\/>/.exec(PAGE_CODE)?.[1] ?? "";
        expect(call, "`<OverviewTabs>` introuvable dans `god/page.tsx`").not.toBe("");

        for (const prop of props) {
            expect(call, `<OverviewTabs> ne reçoit plus « ${prop} »`).toMatch(new RegExp(`\\b${prop}=\\{`));
        }
    });
});
