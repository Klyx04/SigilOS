/**
 * Conditions d'équipement — **parseur** du DSL DofusDB (`criterions`) et rendu Dofusbook.
 *
 * Mesures du 25/10/2026 (croisées DofusDB ↔ tooltips Dofusbook) :
 *   · `Heaume Oplate` : `CP<12|CM<6` = « PA < 12 ou PM < 6 » ;
 *   · `Dévastateur Feu majeur` : `pk<2` = « Bonus de panoplies < 2 ».
 *
 * Fail-closed : un code non mesuré ⇒ `ok:false` (aucune condition inventée).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    CRITERIA_LABELS,
    parseDofusCriterions,
    renderDofusbookConstraints,
} from "@/lib/dofus-criteria";
import { processDofusbookRawData } from "@/lib/dofusbook-utils";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("parseDofusCriterions — DSL mesuré", () => {
    it("rend « PA < 12 ou PM < 6 » (Heaume Oplate)", () => {
        const parsed = parseDofusCriterions("CP<12|CM<6");

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.text).toBe("PA < 12 ou PM < 6");
        expect(parsed.conditions).toEqual([
            { code: "CP", operator: "<", value: "12" },
            { code: "CM", operator: "<", value: "6" },
        ]);
        expect(parsed.node.kind).toBe("or");
    });

    it("rend « Panoplies actives < 2 » (Dévastateur Feu majeur)", () => {
        const parsed = parseDofusCriterions("pk<2");

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.text).toBe("Panoplies actives < 2");
    });

    it("gère le ET (`&`) avec priorité sur le OU", () => {
        const parsed = parseDofusCriterions("CP<12&CM<6");

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.text).toBe("PA < 12 et PM < 6");
        expect(parsed.node.kind).toBe("and");
    });

    it("accepte une absence de condition", () => {
        const parsed = parseDofusCriterions("");

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.text).toBe("");
        expect(parsed.conditions).toHaveLength(0);
    });

    it("refuse un code non mesuré (fail-closed, aucun libellé inventé)", () => {
        const parsed = parseDofusCriterions("CS>199&CC>199");

        expect(parsed.ok).toBe(false);
        if (parsed.ok) return;
        expect(parsed.unsupported).toEqual(["CS", "CC"]);
        expect(parsed.raw).toBe("CS>199&CC>199");
    });

    it("refuse une syntaxe inconnue", () => {
        const parsed = parseDofusCriterions("CP<12|???");
        expect(parsed.ok).toBe(false);
    });

    it("ne mappe que les codes mesurés", () => {
        expect(Object.keys(CRITERIA_LABELS).sort()).toEqual(["CM", "CP", "pk"]);
    });
});

describe("renderDofusbookConstraints — structure `constraints` de Dofusbook", () => {
    it("rend les deux conditions liées par « ou » comme Dofusbook", () => {
        const text = renderDofusbookConstraints([
            { name: "pa", sign: "<", value: "12" },
            { name: "pm", sign: "<", value: "6" },
        ]);

        expect(text).toBe("PA < 12 ou PM < 6");
    });

    it("laisse un nom inconnu en majuscules (jamais traduit au hasard)", () => {
        expect(renderDofusbookConstraints([{ name: "zz", sign: ">", value: "3" }])).toBe("ZZ > 3");
    });

    it("retourne une chaîne vide sans condition", () => {
        expect(renderDofusbookConstraints([])).toBe("");
        expect(renderDofusbookConstraints(null)).toBe("");
    });
});

describe("chaîne complète — payload → item → fiche", () => {
    it("transporte les `constraints` de l'item jusque dans la fiche", () => {
        const data = processDofusbookRawData("22329554", {
            stuff: { name: "Test", character_level: 200, stuffItem: { ch: 1 }, stuffCarac: {}, stuffFm: { fm: {} }, stuffFmItem: {} },
            items: [{
                id: 1,
                name: "Heaume Oplate",
                picture: 1,
                official: 19595,
                level: 200,
                effects: [{ name: "vi", min: 350, max: 350 }],
                constraints: {
                    value: [
                        { name: "pa", sign: "<", value: "12" },
                        { name: "pm", sign: "<", value: "6" },
                    ],
                    Count: 2,
                },
            }],
            cloths: [],
        });

        expect(data.items?.ch?.constraints).toEqual([
            { name: "pa", sign: "<", value: "12" },
            { name: "pm", sign: "<", value: "6" },
        ]);
    });

    it("la fiche d'item affiche la condition", () => {
        const preview = read("src/components/dofus/dofusbook-preview.tsx");

        expect(preview).toContain("renderDofusbookConstraints(item.constraints)");
        expect(preview).toContain("<span className=\"font-semibold text-warning\">Condition</span>");
    });
});
