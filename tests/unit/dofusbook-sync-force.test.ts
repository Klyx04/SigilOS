/**
 * Synchro Dofusbook — **codes de stats réels** et **rafraîchissement forcé**.
 *
 * 🔍 Mesures du 25/10/2026 (siphon réel du build `1awml` = id `23582119` via
 * `https://www.dofusbook.net/api/stuffs/dofus/public/23582119`) :
 *   · les items et les **panoplies** portent `ii` (initiative) et `ic` (invocation), pas
 *     seulement `ini`/`invo` — `Panoplie de Danathor` = `ii+500@2`, `Panoplie de la Fosse`
 *     = `ic+1@3` ⇒ l'initiative restait bloquée au socle `level × 5` (1000 au lieu de 1788)
 *     et l'invocation à 1 ;
 *   · le worker Cloudflare cachait **toute** réponse 24 h (clé stable) et ignorait `force` :
 *     un item retiré sur Dofusbook restait affiché, et `updatedAt` était redaté à chaque
 *     synchro même sans changement.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { processDofusbookRawData } from "@/lib/dofusbook-utils";
import { buildDofusbookClientFetchUrl } from "@/lib/dofusbook-sign";
import { applyVariantsToBuild } from "@/lib/dofus-variant-utils";
import { resolveDofusStatTheme } from "@/lib/dofus-stats-theme";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/** Build minimal reproduisant les codes **actuels** de Dofusbook (`ii`, `ic`). */
function rawBuild() {
    return {
        stuff: {
            name: "Build test",
            character_level: 200,
            stuffItem: { ch: 1, ce: 2 },
            stuffCarac: {},
            stuffFm: { fm: {} },
            stuffFmItem: {},
        },
        items: [
            {
                id: 1,
                name: "Coiffe test",
                picture: 1,
                official: 1,
                level: 200,
                effects: [
                    { name: "ii", min: 100, max: 200 },
                    { name: "ic", min: 1, max: 1 },
                    { name: "sp", min: 5952, max: 1 }, // sort porté par un Dofus : jamais une stat
                ],
            },
            {
                id: 2,
                name: "Ceinture test",
                picture: 2,
                official: 2,
                level: 200,
                effects: [{ name: "ic", min: 1, max: 1 }],
            },
        ],
        cloths: [
            {
                name: "Panoplie test",
                count_item: 2,
                items: [{ id: 1 }, { id: 2 }],
                effects: [
                    { count: 2, name: "ii", value: 500 },
                    { count: 2, name: "ic", value: 1 },
                ],
            },
        ],
    };
}

describe("processDofusbookRawData — codes de stats Dofusbook (`ii`, `ic`)", () => {
    it("compte l'initiative des items **et** des panoplies (bonus `ii`)", () => {
        const data = processDofusbookRawData("23582119", rawBuild());

        // Ce fixture n'a aucun élément ⇒ socle 0 : 200 (item, meilleur jet) + 500 (panoplie).
        // Le socle « somme des éléments » est couvert par le describe « stats dérivées ».
        expect(data.stats.ini).toBe(700);
    });

    it("compte les invocations des items **et** des panoplies (socle 1 inclus)", () => {
        const data = processDofusbookRawData("23582119", rawBuild());

        // 1 (socle) + 1 + 1 (deux items) + 1 (panoplie)
        expect(data.stats.invo).toBe(4);
    });

    it("ignore un code de sort (`sp`) au lieu de le confondre avec le soin", () => {
        const data = processDofusbookRawData("23582119", rawBuild());

        expect(data.stats.so).toBe(0);
    });
});

describe("rafraîchissement forcé — URL signée du worker", () => {
    function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
        const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
        try {
            for (const [k, v] of Object.entries(vars)) {
                if (v === undefined) delete process.env[k];
                else process.env[k] = v;
            }
            fn();
        } finally {
            for (const [k, v] of Object.entries(saved)) {
                if (v === undefined) delete process.env[k];
                else process.env[k] = v;
            }
        }
    }

    it("ajoute `force=1` seulement quand la synchro est explicite", () => {
        withEnv(
            { DOFUSBOOK_CF_WORKER_URL: "https://worker.example.dev", DOFUSBOOK_WORKER_SECRET: "s3cret" },
            () => {
                expect(buildDofusbookClientFetchUrl("42", { force: true })).toMatch(/\/s\/42\?e=\d+&t=[0-9a-f]{64}&force=1$/);
                expect(buildDofusbookClientFetchUrl("42")).not.toContain("force=1");
            }
        );
    });
});

describe("chaîne de synchro — verrous de source", () => {
    const worker = read("cloudflare-workers/dofusbook-proxy/worker.js");
    const preview = read("src/components/dofus/dofusbook-preview.tsx");
    const gallery = read("src/app/dashboard/[guildId]/galerie-stuff/gallery-client.tsx");
    const actions = read("src/server/actions/gallery-actions.ts");
    const bake = read("src/lib/dofusbook-client-bake.ts");

    it("le worker contourne son cache edge sur `force` et ne le fige pas 24 h", () => {
        expect(worker).toContain("if (!force) {");
        expect(worker).toContain("const maxAge = force ? 60 : 86400;");
        expect(worker).toContain('force ? { cacheTtl: 0, cacheEverything: false } : undefined');
        expect(worker).toContain('proxyBuild(buildId, ctx, force)');
        expect(worker).toContain('url.searchParams.get("force") === "1"');
    });

    it("le navigateur demande `force` depuis « Actualiser » (fiche et galerie)", () => {
        expect(bake).toContain("options: { force?: boolean } = {}");
        expect(bake).toContain("getDofusbookClientFetchUrl(buildUrl, { force: options.force })");
        expect(preview).toContain("bakeDofusbookFromBrowser(url, guildId, { force })");
        expect(gallery).toContain("bakeDofusbookFromBrowser(build.url, guildId, { force: true })");
    });

    it("une synchro sans changement ne redate pas `updatedAt`", () => {
        expect(actions).toContain("const changed = JSON.stringify(currentLink?.previewData ?? null) !== JSON.stringify(data);");
        expect(actions).toContain("if (!changed) {");
        expect(actions).toContain("changed: false");
        /**
         * ⚠️ Mesure du 26/10/2026 : un relais qui n'est **pas** la version du dépôt ignore
         * `force=1` et renvoie le **même** payload, **sans** en-tête `X-Cache`. Un
         * « changed === false » ne prouve donc **pas** que rien n'a bougé sur Dofusbook : l'UI
         * le dit et le serveur le journalise (au lieu d'annoncer un faux « aucun changement »).
         */
        expect(preview).toContain("if (baked.changed === false) {");
        expect(preview).toContain("Rien de neuf reçu du relais Dofusbook");
        expect(actions).toContain("rafraîchissement forcé sans changement");
        expect(bake).toContain("storeClientDofusbookPreview(guildId, buildUrl, raw, { force: options.force })");
    });
});


describe("stats dérivées — formules mesurées sur Dofusbook (build 22329554)", () => {
    /**
     * Reproduction exacte des totaux du build `22329554` (page Dofusbook rendue le 25/10/2026) :
     * Force 190, Intelligence 1323, Chance 185, Agilité 185, Sagesse 405.
     */
    function referenceBuild(extraEffects: Array<{ name: string; min: number; max: number }> = []) {
        return {
            stuff: {
                name: "Roub feu",
                character_level: 200,
                stuffItem: { ch: 1 },
                stuffCarac: {
                    base_vi: 3, base_sa: 305, base_fo: 0, base_in: 398, base_ch: 0, base_ag: 0,
                    scroll_vi: 100, scroll_sa: 100, scroll_fo: 100, scroll_in: 100,
                    scroll_ch: 100, scroll_ag: 100,
                },
                stuffFm: { fm: {} },
                stuffFmItem: {},
            },
            items: [{
                id: 1,
                name: "Item test",
                picture: 1,
                official: 1,
                level: 200,
                effects: [
                    { name: "fo", min: 90, max: 90 },
                    { name: "in", min: 825, max: 825 },
                    { name: "ch", min: 85, max: 85 },
                    { name: "ag", min: 85, max: 85 },
                    ...extraEffects,
                ],
            }],
            cloths: [],
        };
    }

    it("initiative = somme des quatre éléments (1883 sur le build de référence)", () => {
        const data = processDofusbookRawData("22329554", referenceBuild());

        expect(data.elements).toMatchObject({ fo: 190, in: 1323, ch: 185, ag: 185, sa: 405 });
        expect(data.stats.ini).toBe(1883);
    });

    it("un bonus `ii` (item ou panoplie) s'ajoute à l'initiative", () => {
        const data = processDofusbookRawData(
            "22329554",
            referenceBuild([{ name: "ii", min: 500, max: 500 }]),
        );

        expect(data.stats.ini).toBe(2383);
    });

    it("esquive / retrait = floor(Sagesse / 10), tacle / fuite = floor(Agilité / 10)", () => {
        const data = processDofusbookRawData("22329554", referenceBuild());

        // Sagesse 405 → 40 ; Agilité 185 → 18 (valeurs affichées par Dofusbook).
        expect(data.stats.retpa).toBe(40);
        expect(data.stats.retpm).toBe(40);
        expect(data.stats.epa).toBe(40);
        expect(data.stats.epm).toBe(40);
        expect(data.stats.tacle).toBe(18);
        expect(data.stats.fuite).toBe(18);
    });

    it("une variante qui change un élément déplace l'initiative du même delta", () => {
        const base = processDofusbookRawData("22329554", referenceBuild());
        const originalItem = {
            id: 1, name: "Item test", picture: 1, official: 1, level: 200,
            effects: [
                { code: "fo", min: 90, max: 90, value: 90 },
                { code: "in", min: 825, max: 825, value: 825 },
                { code: "ch", min: 85, max: 85, value: 85 },
                { code: "ag", min: 85, max: 85, value: 85 },
            ],
        };
        const variantItem = {
            id: 2, name: "Item variante", picture: 2, official: 2, level: 200,
            effects: [
                { code: "fo", min: 100, max: 100, value: 100 },
                { code: "in", min: 825, max: 825, value: 825 },
                { code: "ch", min: 85, max: 85, value: 85 },
                { code: "ag", min: 85, max: 85, value: 85 },
            ],
        };

        const updated = applyVariantsToBuild(
            { ...base, items: { ch: originalItem } },
            { ch: variantItem },
        );

        // +10 Force ⇒ initiative 1883 + 10.
        expect(updated?.stats.ini).toBe(1893);
    });
});

describe("résistances secondaires, malus et exo — mesurés sur le build 22329554", () => {
    function secondaryBuild() {
        return {
            stuff: {
                name: "Roub feu",
                character_level: 200,
                stuffItem: { br: 1 },
                stuffCarac: {},
                stuffFm: { fm: {} },
                stuffFmItem: {},
            },
            items: [{
                id: 1,
                name: "Bouclier test",
                picture: 1,
                official: 1,
                level: 200,
                effects: [
                    { name: "rc", min: -16, max: -16 },
                    { name: "rc", min: 35, max: 35 },
                    { name: "rp", min: -40, max: -40 },
                    { name: "rp", min: 8, max: 8 },
                    { name: "rp", min: 40, max: 40 },
                    { name: "rm", min: 7, max: 7 },
                    { name: "rd", min: 4, max: 4 },
                    { name: "rv", min: 15, max: 15 },
                ],
            }],
            cloths: [],
        };
    }

    it("agrège Ré Critique 19, Ré Poussée 8, % Ré Mêlée 7, % Ré Dist 4 et Renvoi 15", () => {
        const data = processDofusbookRawData("22329554", secondaryBuild());

        expect(data.resists.critique).toBe(19);
        expect(data.resists.poussee).toBe(8);
        expect(data.resists.melee).toBe(7);
        expect(data.resists.distance).toBe(4);
        expect(data.resists.renvoi).toBe(15);
    });

    it("les codes `rm`/`rd`/`rv`/`deg` ont un thème (icône + libellé), plus de code brut", () => {
        expect(resolveDofusStatTheme(null, null, "rm")?.asset).toBe("resMelee.png");
        expect(resolveDofusStatTheme(null, null, "rd")?.asset).toBe("resDistance.png");
        expect(resolveDofusStatTheme(null, null, "rv")?.asset).toBe("renvoi.png");
        expect(resolveDofusStatTheme(null, null, "rc")?.asset).toBe("resCritique.png");
        expect(resolveDofusStatTheme(null, null, "rp")?.asset).toBe("resPoussee.png");
        expect(resolveDofusStatTheme(null, null, "deg")?.label).toBe("Do Finaux");
    });

    it("la fiche d'item colore les malus et affiche l'icône de l'effet", () => {
        const preview = read("src/components/dofus/dofusbook-preview.tsx");

        expect(preview).toContain("fx.value < 0 || fx.max < 0");
        expect(preview).toContain("? \"text-danger\"");
        expect(preview).toContain("const theme = resolveDofusStatTheme(null, null, fx.code, null)");
    });

    it("les exo/over portent une pastille de rune sur les slots (miniature + équipement)", () => {
        const preview = read("src/components/dofus/dofusbook-preview.tsx");

        expect(preview).toContain("function FmBadges(");
        expect(preview).toContain("<FmBadges stats={data.smithmagic?.[slot.s]}");
        expect(preview).toContain("<FmBadges stats={smithmagic?.[slot]}");
        expect(preview).toContain("getRuneForStat(statLabelMapping[code] ?? code");
    });

    it("l'éditeur de variante reste fermé au visiteur sur TOUS les slots", () => {
        const preview = read("src/components/dofus/dofusbook-preview.tsx");

        expect(preview).toContain("const openVariantSlot = canPersistVariant ? setVariantModalSlot : undefined;");
        expect(preview).not.toContain("onOpenVariant={setVariantModalSlot}");
    });
});
