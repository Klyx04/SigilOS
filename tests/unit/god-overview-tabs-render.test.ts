/**
 * Garde de câblage (lecture source) — **`OverviewTabs` rend ses deux sections**.
 *
 * Depuis le lot C (16/11/2026), les sections « Indicateurs plateforme » et « Activité de
 * la plateforme » sont **supprimées** : le contrat ne porte plus que `communication` et
 * `worker`. La garde d'origine (`fbbbc8a8`, corrigée le 28/09/2026) reste utile : une prop
 * déclarée doit être rendue **une fois et une seule**.
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

    it("déclare les deux sections attendues", () => {
        expect(props).toEqual(["communication", "worker"]);
    });

    it("rend chaque prop exactement une fois", () => {
        for (const prop of props) {
            const rendered = COMPONENT_CODE.match(new RegExp(`\\{${prop}\\}`, "g")) ?? [];
            expect(rendered.length, `« ${prop} » est déclarée mais jamais rendue (ou rendue deux fois)`).toBe(1);
        }
    });

    it("l'écran God passe bien les deux props", () => {
        const call = /<OverviewTabs([\s\S]*?)\n\s*\/>/.exec(PAGE_CODE)?.[1] ?? "";
        expect(call, "`<OverviewTabs>` introuvable dans `god/page.tsx`").not.toBe("");

        for (const prop of props) {
            expect(call, `<OverviewTabs> ne reçoit plus « ${prop} »`).toMatch(new RegExp(`\\b${prop}=\\{`));
        }
    });
});
