import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde du deslop du module **Songes** (chantier « aux normes landing », 13/10/2026).
 *
 * Baseline MESURÉE avant reprise (17 composants, ~290 ko) — c'est ce que cette garde interdit
 * de réintroduire :
 *  - **88 rayons gonflés** (`rounded-xl|2xl|3xl`) là où le module tient désormais 3/4/6/10 px ;
 *  - **34 ombres** (`shadow-sm…2xl`, `drop-shadow`), **9 `backdrop-blur`**, **7 halos `blur-[…]`** ;
 *  - **14 animations d'entrée** (`animate-in`, `fade-in`, `slide-in-*`, `zoom-in`) et **15 `scale`**
 *    (`active:scale-95`, `hover:scale`, `scale-110`) + 8 `animate-pulse` ;
 *  - **136 couleurs de palette en dur** (`purple-*`, `amber-*`, `emerald-*`, `cyan-*`, `zinc-950`…),
 *    **13 `bg-black/…`**, **84 `font-black`**, **63 `tracking-widest`** ;
 *  - un composant d'en-tête **mort** (`SongesHeader`, jamais rendu) et 4 boutons d'en-tête qui ne se
 *    ressemblaient pas (hauteurs 36/44 px mélangées, 4 accents concurrents : fuchsia, bleu, teal, or).
 *
 * Depuis, le module suit les **tokens du thème** avec un **accent unique** (`info`) et une seule
 * source pour ses actions (`src/lib/songes/ui.ts`) — l'exemption `songes` de la règle
 * `sigil/no-hardcoded-colors` a donc été **retirée** de `eslint.config.mjs`.
 */

const SONGES_DIR = "src/components/songes";
const COMPONENTS = readdirSync(SONGES_DIR)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => join(SONGES_DIR, name));
const PAGE = "src/app/dashboard/[guildId]/songes/page.tsx";
const CONTRACT = "src/lib/songes/ui.ts";

/** Classes interdites (mesurées, cf. en-tête) — elles ne reviennent pas. */
const FORBIDDEN = [
    "rounded-xl",
    "rounded-2xl",
    "rounded-3xl",
    "shadow-sm",
    "shadow-lg",
    "shadow-xl",
    "shadow-2xl",
    "drop-shadow",
    "backdrop-blur",
    "blur-[",
    "blur-3xl",
    "animate-in",
    "fade-in",
    "slide-in-from",
    "zoom-in",
    "animate-pulse",
    "active:scale",
    "hover:scale",
    "scale-110",
    "font-black",
    "tracking-widest",
    "text-white",
    "text-black",
    "bg-black",
];

/** Toutes les familles de palette (la règle eslint n'en couvre qu'une partie : ici, aucune). */
const PALETTE =
    /(?<![\w-])(?:text|bg|border|divide|ring|from|to|via|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/g;

describe("deslop Songes — le slop ne revient pas", () => {
    it("les composants du module sont bien analysés", () => {
        expect(COMPONENTS.length).toBeGreaterThanOrEqual(15);
    });

    it.each(COMPONENTS)("%s : aucune classe interdite", (file) => {
        const source = readFileSync(file, "utf8");
        for (const pattern of FORBIDDEN) {
            expect(source, `${file} contient « ${pattern} »`).not.toContain(pattern);
        }
    });

    it.each(COMPONENTS)("%s : aucune couleur de palette en dur", (file) => {
        const hits = readFileSync(file, "utf8").match(PALETTE) ?? [];
        expect(hits, `${file} : ${hits.join(", ")}`).toEqual([]);
    });

    it("les rayons restent serrés (aucun rayon au-delà de 10 px hors pastille)", () => {
        const radii = new Set<string>();
        for (const file of COMPONENTS) {
            for (const m of readFileSync(file, "utf8").matchAll(/rounded-(sm|md|lg|full)\b/g)) radii.add(m[1]);
        }
        expect(radii.size).toBeGreaterThan(0);
        expect([...radii].sort()).toEqual(["full", "lg", "md", "sm"]);
    });

    it("le composant d'en-tête mort a disparu", () => {
        expect(existsSync(join(SONGES_DIR, "SongesHeader.tsx"))).toBe(false);
    });
});

describe("deslop Songes — une seule source pour les actions", () => {
    const contract = readFileSync(CONTRACT, "utf8");

    it("le contrat porte les 5 intentions et le groupe d'actions", () => {
        for (const key of ["primary", "secondary", "close", "danger", "ghost"]) {
            expect(contract, `intention absente du contrat : ${key}`).toMatch(new RegExp(`\\b${key}:`));
        }
        expect(contract).toContain("SONGES_ACTION_GROUP");
        expect(contract).toContain("SONGES_ACTION_GROUP_ITEM");
    });

    it("les surfaces à actions consomment le contrat, jamais une palette", () => {
        const consumers: Array<[string, string]> = [
            ["RunCard.tsx", "SONGES_BUTTON"],
            ["RunEditModal.tsx", "SONGES_BUTTON"],
            ["RunCloseModal.tsx", "SONGES_BUTTON"],
            ["RunDetailHeader.tsx", "SONGES_BUTTON"],
            ["BossGuideLauncher.tsx", "SONGES_ACTION_GROUP_ITEM"],
        ];
        for (const [file, symbol] of consumers) {
            expect(readFileSync(join(SONGES_DIR, file), "utf8"), `${file} n'utilise pas ${symbol}`).toContain(symbol);
        }
    });

    it("l'action principale ne porte aucun accent décoratif concurrent", () => {
        // Le seul accent du module est `info` : plus de fuchsia (guide), de teal (aide) ni d'or plein.
        expect(readFileSync(PAGE, "utf8")).not.toContain("fuchsia");
    });
});

describe("deslop Songes — l'en-tête regroupe ses 4 actions", () => {
    const page = readFileSync(PAGE, "utf8");

    it("les 4 actions vivent dans un seul groupe + l'action principale à part", () => {
        expect(page).toContain("className={SONGES_ACTION_GROUP}");
        expect(page).toContain("<BossGuideLauncher />");
        expect(page).toMatch(/<ModuleTourReplayButton phase="songes" appearance="grouped" \/>/);
        expect(page).toContain("<CreateRunButton");
        // Une seule action principale (les outils vivent dans le groupe).
        expect((page.match(/<CreateRunButton/g) ?? []).length).toBe(1);
    });

    it("conserve les ancres de la visite guidée (rien n'a été cassé)", () => {
        for (const anchor of [
            'data-tour="songes-header"',
            'data-tour="songes-guide"',
            'data-tour="songes-create"',
            'data-tour="songes-board"',
        ]) {
            expect(page, `ancre ${anchor} disparue`).toContain(anchor);
        }
    });

    it("les items du groupe partagent la même hauteur que l'action principale", () => {
        const contract = readFileSync(CONTRACT, "utf8");
        // Le groupe impose h-9, ses items prennent h-full : plus de 36 px collés à 44 px.
        expect(contract).toMatch(/SONGES_ACTION_GROUP =\s*"flex items-center h-9/);
        expect(contract).toMatch(/SONGES_ACTION_GROUP_ITEM =\s*"inline-flex items-center gap-2 h-full/);
        expect(readFileSync(join(SONGES_DIR, "CreateRunButton.tsx"), "utf8")).toMatch(/h-9 px-4 text-xs/);
    });
});

describe("deslop Songes — la règle de couleurs n'est plus contournée", () => {
    it("l'exemption « songes » a été retirée de l'allowlist eslint", () => {
        const eslint = readFileSync("eslint.config.mjs", "utf8");
        const ruleStart = eslint.indexOf('"sigil/no-hardcoded-colors": ["warn"');
        expect(ruleStart).toBeGreaterThan(-1);
        const allowBlock = eslint.slice(ruleStart, eslint.indexOf("allowHex:", ruleStart));
        expect(allowBlock).not.toContain('"songes"');
    });
});
