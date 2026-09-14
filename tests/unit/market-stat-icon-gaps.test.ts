/**
 * Régression (14/09/2026, constat beta) — **« icône assets ko : +5 % Mêlée (%) »**,
 * et audit des autres icônes manquantes/fausses.
 *
 * 📏 Mesure (sonde `src/temp/_probe-stat-icons-audit.mjs`, lecture du référentiel
 * siphonné `GameCharacteristic` + `GameEffect` — c'est la **source de vérité**) :
 *   · `Mêlée (%)` (caractéristique **124**, asset `tx_resMelee`) et
 *     `Distance (%)` (`120`/`121`, `tx_distanceRes`) n'avaient **aucun** thème ⇒
 *     repli lucide (éclair) au lieu du bouclier officiel ;
 *   · `124` est une **collision d'espaces** : `effectId 124` = *Sagesse*,
 *     `characteristicId 124` = *Mêlée (%)* ⇒ une seule carte ne peut pas être
 *     juste pour les deux (d'où `THEME_BY_CHARACTERISTIC`, consultée d'abord) ;
 *   · trois ids donnaient une **mauvaise** icône : `82` (Retrait PA, était
 *     Esquive PA), `84` (Dommages Poussée, était Esquive PM) et `88`
 *     (Dommages Terre, était Résistance Poussée) ;
 *   · `414`/`416`/`417` (Poussée / Poussée (fixe)) et `418`→`421`
 *     (Critiques / Critiques (fixe)) manquaient, tout comme leurs libellés.
 *
 * Aucun test ne vérifiait ces lignes : la carte affichait donc une icône juste
 * « par chance » (libellé reconnu) ou une icône fausse (id mal cartographié).
 */

import { describe, it, expect } from "vitest";
import { dofusStatAssetUrl, resolveDofusStatTheme } from "@/lib/dofus-stats-theme";

describe("Mêlée / Distance (%) — l'icône officielle existe enfin", () => {
    it("`effectId` 2803 (Mêlée %) → bouclier (le référentiel dit `tx_resMelee`)", () => {
        expect(resolveDofusStatTheme(null, 2803)).toMatchObject({
            asset: "bouclier.png",
            label: "Résistance Mêlée",
        });
    });

    it("`effectId` 2804 / 2807 (Distance %) → bouclier", () => {
        expect(resolveDofusStatTheme(null, 2804)).toMatchObject({ asset: "bouclier.png" });
        expect(resolveDofusStatTheme(null, 2807)).toMatchObject({
            asset: "bouclier.png",
            label: "Résistance Distance",
        });
    });

    it("caractéristique 124 (Mêlée %) → Mêlée, PAS Sagesse (collision d'ids)", () => {
        expect(resolveDofusStatTheme(124)).toMatchObject({ asset: "bouclier.png" });
        expect(resolveDofusStatTheme(121)).toMatchObject({ asset: "bouclier.png" });
    });

    it("`effectId` 124 reste **Sagesse** (l'autre espace d'ids, intact)", () => {
        expect(resolveDofusStatTheme(null, 124)).toMatchObject({
            asset: "sagesse.png",
            label: "Sagesse",
        });
    });

    it("filet par libellé : « Mêlée (%) » / « Distance (%) » (caractéristique absente)", () => {
        expect(resolveDofusStatTheme(null, null, null, "Mêlée (%)")).toMatchObject({
            asset: "bouclier.png",
        });
        expect(resolveDofusStatTheme(null, null, null, "Distance (%)")).toMatchObject({
            asset: "bouclier.png",
        });
    });

    it("l'asset référencé existe bien (aucune icône cassée)", () => {
        const theme = resolveDofusStatTheme(null, 2803);
        expect(theme && dofusStatAssetUrl(theme.asset)).toBe("/assets/dofus/stats/bouclier.png");
    });
});

describe("Ids mal cartographiés (audit du référentiel)", () => {
    it("`82` = Retrait PA (était Esquive PA)", () => {
        expect(resolveDofusStatTheme(null, 82)).toMatchObject({ asset: "retraitPA.png" });
    });

    it("`84` = Dommages Poussée (était Esquive PM)", () => {
        expect(resolveDofusStatTheme(null, 84)).toMatchObject({ asset: "dommages.png" });
    });

    it("`88` = Dommages Terre (était Résistance Poussée)", () => {
        expect(resolveDofusStatTheme(null, 88)).toMatchObject({ asset: "terre.png" });
    });

    it("`410`/`160`/`161` (Retrait PA / Esquive PA / Esquive PM) restent justes", () => {
        expect(resolveDofusStatTheme(null, 410)).toMatchObject({ asset: "retraitPA.png" });
        expect(resolveDofusStatTheme(null, 160)).toMatchObject({ asset: "esquivePA.png" });
        expect(resolveDofusStatTheme(null, 161)).toMatchObject({ asset: "esquivePM.png" });
    });
});

describe("Séries Poussée / Critiques (mesurées au référentiel)", () => {
    it("`414` Poussée → dégâts, `416`/`417` Poussée (fixe) → résistance", () => {
        expect(resolveDofusStatTheme(null, 414)).toMatchObject({ asset: "dommages.png" });
        expect(resolveDofusStatTheme(null, 416)).toMatchObject({ asset: "bouclier.png" });
        expect(resolveDofusStatTheme(null, 417)).toMatchObject({ asset: "bouclier.png" });
    });

    it("`418`/`419` Critiques → dégâts critiques, `420`/`421` (fixe) → résistance critique", () => {
        expect(resolveDofusStatTheme(null, 418)).toMatchObject({ asset: "dommages.png" });
        expect(resolveDofusStatTheme(null, 419)).toMatchObject({ asset: "dommages.png" });
        expect(resolveDofusStatTheme(null, 420)).toMatchObject({ asset: "bouclier.png" });
        expect(resolveDofusStatTheme(null, 421)).toMatchObject({ asset: "bouclier.png" });
    });

    it("libellés : « Poussée » → dégâts, « Poussée (fixe) » / « Critiques (fixe) » → résistance", () => {
        expect(resolveDofusStatTheme(null, null, null, "Poussée")).toMatchObject({
            asset: "dommages.png",
        });
        expect(resolveDofusStatTheme(null, null, null, "Poussée (fixe)")).toMatchObject({
            asset: "bouclier.png",
        });
        expect(resolveDofusStatTheme(null, null, null, "Critiques (fixe)")).toMatchObject({
            asset: "bouclier.png",
        });
        // Le coup critique (%) n'est pas une « critiques (fixe) » : il garde son icône.
        expect(resolveDofusStatTheme(null, 115)).toMatchObject({ asset: "critique.png" });
    });
});
