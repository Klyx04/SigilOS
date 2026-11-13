/**
 * 🔢 Métriques des crons (lot C4) — une seule façon de borner une liste.
 *
 * Mesure du 18/10/2026 : les émetteurs coupaient leurs listes **avant** l'alerte
 * (cartes Dofensive 10, erreurs 5, boss en erreur 20) ⇒ ni `details` (C1) ni le
 * journal (C2) ne pouvaient récupérer ce qui avait été jeté. Ici la liste est
 * conservée jusqu'à un plafond explicite, et le reste est **dit** dans le texte.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { boundCronList, CRON_METRICS_MAX_LIST } from "@/lib/cron-metrics";

describe("boundCronList — garder tout, dire ce qui manque", () => {
    it("liste vide ⇒ aucun texte (jamais une ligne « : » vide)", () => {
        expect(boundCronList([])).toEqual({ shown: [], hidden: 0, text: "" });
        expect(boundCronList([null, undefined, "  "])).toEqual({ shown: [], hidden: 0, text: "" });
    });

    it("sous le plafond : tout est conservé, dans l'ordre, sans suffixe", () => {
        const result = boundCronList(["b", "a", "c"]);
        expect(result.shown).toEqual(["b", "a", "c"]);
        expect(result.hidden).toBe(0);
        expect(result.text).toBe("b, a, c");
    });

    it("au-delà du plafond : la coupe est DITE (… (+N autre(s)))", () => {
        const values = Array.from({ length: 5 }, (_, index) => `x${index}`);
        const result = boundCronList(values, 2);
        expect(result.shown).toEqual(["x0", "x1"]);
        expect(result.hidden).toBe(3);
        expect(result.text).toBe("x0, x1 … (+3 autre(s))");
    });

    it("nettoie les valeurs et prend le plafond par défaut partagé", () => {
        expect(boundCronList(["  a  ", "", "b"]).shown).toEqual(["a", "b"]);
        expect(CRON_METRICS_MAX_LIST).toBe(200);
        const big = Array.from({ length: CRON_METRICS_MAX_LIST + 2 }, (_, index) => `v${index}`);
        expect(boundCronList(big).hidden).toBe(2);
    });

    it("un plafond absurde reste utilisable (au moins 1)", () => {
        const result = boundCronList(["a", "b"], 0);
        expect(result.shown).toEqual(["a"]);
        expect(result.hidden).toBe(1);
    });
});

describe("verrous de source — les 4 émetteurs cron suivent la même règle", () => {
    const dataWatch = readFileSync("src/app/api/cron/data-watch/route.ts", "utf8");
    const ladderRoute = readFileSync("src/app/api/cron/ladder-sync/route.ts", "utf8");
    const maps = readFileSync("src/app/api/cron/sync-dofensive-maps/route.ts", "utf8");
    const monsters = readFileSync("src/app/api/cron/sync-monster-stats/route.ts", "utf8");

    it("chacun importe la règle partagée", () => {
        for (const source of [dataWatch, ladderRoute, maps, monsters]) {
            expect(source).toMatch(/boundCronList/);
            expect(source).toMatch(/from "@\/lib\/cron-metrics"/);
        }
    });

    it("data-watch envoie des champs FRANÇAIS (plus de repli sur les clés techniques)", () => {
        expect(dataWatch).toMatch(/name: "Objets \(DofusDB\)"/);
        expect(dataWatch).toMatch(/name: "⚠️ File indisponible"/);
    });

    it("Dofensive : plus aucune coupe avant l'alerte (10 cartes / 5 erreurs)", () => {
        expect(maps).not.toMatch(/result\.syncedMaps\.slice\(0, 10\)/);
        expect(maps).not.toMatch(/\.slice\(0, 5\)\.map/);
        expect(maps).not.toMatch(/\.join\("\\n"\)\.slice\(0, 1024\)/);
        expect(maps).toMatch(/cartes: mapsBound\.text/);
        expect(maps).toMatch(/erreurs: errorsBound\.text/);
    });

    it("Monstres : la liste des boss en erreur arrive entière au journal", () => {
        expect(monsters).not.toMatch(/errorBosses\.slice\(0, 20\)/);
        expect(monsters).toMatch(/bossesEnErreur: boundCronList\(errorBosses\)\.text/);
    });

    it("Ladder (route) : clés françaises et une ligne par échec dans la fiche", () => {
        expect(ladderRoute).not.toMatch(/batch_size:/);
        expect(ladderRoute).toMatch(/profilsTraites: summary\.batchSize/);
        expect(ladderRoute).toMatch(/Échec \$\{index \+ 1\}/);
    });
});
