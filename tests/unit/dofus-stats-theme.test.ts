import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
    DOFUS_STAT_ASSET_BASE,
    dofusStatAssetUrl,
    resolveDofusStatTheme,
} from "@/lib/dofus-stats-theme";

/**
 * S7.1 — thème graphique des caractéristiques : **vrais assets Dofus**.
 *
 * Ces tests verrouillent deux choses :
 *   1. la **résolution** (id de caractéristique → id d'effet → code court →
 *      mots-clés du libellé) — c'est elle qui a corrigé les icônes génériques ;
 *   2. l'**existence réelle** du fichier PNG référencé : une icône annoncée ne
 *      peut jamais pointer vers un asset absent (jamais d'image cassée).
 */
describe("dofus-stats-theme — résolution des thèmes", () => {
    it("résout par caractéristique officielle (ids vérifiés en base)", () => {
        expect(resolveDofusStatTheme(11)).toMatchObject({ asset: "pv.png", label: "Vitalité" });
        expect(resolveDofusStatTheme(10)).toMatchObject({ asset: "terre.png", label: "Force" });
        expect(resolveDofusStatTheme(16)).toMatchObject({ asset: "dommages.png", label: "Dommages" });
        expect(resolveDofusStatTheme(26)).toMatchObject({ asset: "invocation.png", label: "Invocations" });
        expect(resolveDofusStatTheme(27)).toMatchObject({ asset: "esquivePA.png", label: "Esquive PA" });
        expect(resolveDofusStatTheme(28)).toMatchObject({ asset: "esquivePM.png", label: "Esquive PM" });
        expect(resolveDofusStatTheme(48)).toMatchObject({ asset: "pp.png", label: "Prospection" });
        expect(resolveDofusStatTheme(49)).toMatchObject({ asset: "soin.png", label: "Soins" });
        expect(resolveDofusStatTheme(33)).toMatchObject({ asset: "resTerre.png" });
        expect(resolveDofusStatTheme(37)).toMatchObject({ asset: "resNeutre.png" });
        expect(resolveDofusStatTheme(40)).toMatchObject({ asset: "pod.png" });
        expect(resolveDofusStatTheme(44)).toMatchObject({ asset: "initiative.png" });
    });

    it("résout par effectId quand la caractéristique est absente", () => {
        expect(resolveDofusStatTheme(null, 111)).toMatchObject({ asset: "pa.png" });
        expect(resolveDofusStatTheme(null, 128)).toMatchObject({ asset: "pm.png" });
        expect(resolveDofusStatTheme(null, 117)).toMatchObject({ asset: "po.png" });
        expect(resolveDofusStatTheme(null, 182)).toMatchObject({ asset: "invocation.png" });
        expect(resolveDofusStatTheme(null, 163)).toMatchObject({ asset: "bouclier.png" });
        expect(resolveDofusStatTheme(null, 424)).toMatchObject({ asset: "feu.png" });
        expect(resolveDofusStatTheme(null, 752)).toMatchObject({ asset: "fuite.png" });
    });

    it("résout par code court historique", () => {
        expect(resolveDofusStatTheme(null, null, "vi")).toMatchObject({ asset: "pv.png" });
        expect(resolveDofusStatTheme(null, null, "PO")).toMatchObject({ asset: "po.png" });
        expect(resolveDofusStatTheme(null, null, "dmg")).toMatchObject({ asset: "dommages.png" });
    });

    it("résout par mots-clés du libellé (dernier filet)", () => {
        expect(resolveDofusStatTheme(null, null, null, "Résistance Feu (%)")).toMatchObject({
            asset: "resFeu.png",
        });
        expect(resolveDofusStatTheme(null, null, null, "Dommages Air")).toMatchObject({ asset: "air.png" });
        expect(resolveDofusStatTheme(null, null, null, "Soins")).toMatchObject({ asset: "soin.png" });
        expect(resolveDofusStatTheme(null, null, null, "Coups critiques")).toMatchObject({
            asset: "critique.png",
        });
    });

    it("priorise la caractéristique, puis l'effectId, puis le libellé", () => {
        expect(resolveDofusStatTheme(11, 111, "pa", "PA")).toMatchObject({ asset: "pv.png" });
        expect(resolveDofusStatTheme(null, 111, "vi", "Vitalité")).toMatchObject({ asset: "pa.png" });
        expect(resolveDofusStatTheme(null, null, "vi", "PA")).toMatchObject({ asset: "pv.png" });
    });

    it("renvoie null quand rien n'est identifiable (⇒ repli lucide)", () => {
        expect(resolveDofusStatTheme()).toBeNull();
        expect(resolveDofusStatTheme(999_999, 999_999, "zz", "Effet")).toBeNull();
    });

    it("dofusStatAssetUrl construit une URL publique statique", () => {
        expect(dofusStatAssetUrl("pv.png")).toBe(`${DOFUS_STAT_ASSET_BASE}/pv.png`);
        expect(dofusStatAssetUrl("pv.png")).toBe("/assets/dofus/stats/pv.png");
    });

    /**
     * Garde-fou « jamais d'icône cassée » : chaque asset annoncé doit exister
     * dans `public/assets/dofus/stats/`.
     */
    it("chaque asset référencé existe réellement sur le disque", () => {
        const ids = [
            1, 10, 11, 12, 13, 14, 15, 16, 18, 19, 23, 25, 26, 27, 28, 31, 33, 34, 35, 36, 37, 40, 44, 48, 49, 50,
            78, 79, 80, 82, 83, 84, 87, 88, 89, 90, 91, 92, 93, 111, 112, 114, 117, 118, 119, 123, 124, 125, 126,
            128, 141, 162, 163, 164, 165, 178, 182, 210, 211, 212, 213, 214, 412, 422, 424, 428, 430, 432, 752, 753,
        ];
        const assets = new Set<string>();
        for (const id of ids) {
            const theme = resolveDofusStatTheme(id);
            expect(theme).not.toBeNull();
            if (theme) assets.add(theme.asset);
        }
        expect(assets.size).toBeGreaterThan(25);
        for (const asset of assets) {
            expect(existsSync(join(process.cwd(), "public", "assets", "dofus", "stats", asset))).toBe(true);
        }
    });
});
