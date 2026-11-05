import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { countRushQuests, matchesRushQuestFilter } from "@/lib/rush-quest-filter";

/**
 * Garde de la DA « Gouache Wakfu » (`src/app/da-wakfu.css`).
 *
 * Elle ne teste pas un rendu : elle teste des **règles mesurables** que la
 * maquette ne tenait pas, et qui ont chacune coûté une mesure :
 *   · contraste AA des six combinaisons bloc × mode (WCAG 2.2, 4,5:1) ;
 *   · préfixe `--da-` obligatoire (le `--muted` global est une SURFACE, le
 *     `--muted` de la maquette est un TEXTE : les confondre repeint le produit) ;
 *   · « validé » = `--da-ok` fixe, jamais l'accent du bloc ;
 *   · pas de `filter` sur une liste de cartes (une rastérisation par carte) ;
 *   · rayons : 14 px autorisé pour la fenêtre seule.
 */

const CSS = "src/app/da-wakfu.css";
const SKILL = ".cline/skills/sigilos-da-wakfu/SKILL.md";
const FILTERS = "src/components/da/DaWakfuFilters.tsx";
const DOCK = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterBar.tsx";
const SHELL = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const HEADER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx";

type Rgb = [number, number, number];

function hex(value: string): Rgb {
    const v = value.trim().replace(/^#/, "");
    const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
    ];
}

function luminance(value: string): number {
    const [r, g, b] = hex(value).map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
    const la = luminance(a);
    const lb = luminance(b);
    const [light, dark] = la >= lb ? [la, lb] : [lb, la];
    return (light + 0.05) / (dark + 0.05);
}

/** `color-mix(in srgb, base X%, other)`, soit `ratio` de `other`. */
function mix(base: string, other: string, ratio: number): string {
    const a = hex(base);
    const b = hex(other);
    const out = a.map((channel, i) => Math.round(channel + (b[i] - channel) * ratio));
    return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Déclarations `--da-*` d'un sélecteur exact (le `{` doit suivre le sélecteur). */
function tokens(css: string, selector: string): Record<string, string> {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const found = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))];
    expect(found.length, `sélecteur absent : ${selector}`).toBeGreaterThan(0);

    const out: Record<string, string> = {};
    for (const match of found) {
        for (const decl of match[1].matchAll(/--da-[a-z0-9-]+\s*:\s*([^;]+);/g)) {
            const name = decl[0].split(":")[0].trim();
            out[name] = decl[1].trim();
        }
    }
    return out;
}

const css = readFileSync(CSS, "utf8");
const dark = tokens(css, '[data-da="wakfu"]');
const light = tokens(css, '[data-da="wakfu"][data-theme="light"]');

const BLOCKS = ["emeraude", "cauchemar", "ocre"] as const;

function blockTokens(block: string, mode: "dark" | "light") {
    const selector =
        mode === "dark"
            ? `[data-da="wakfu"][data-block="${block}"]`
            : `[data-da="wakfu"][data-theme="light"][data-block="${block}"]`;
    return tokens(css, selector);
}

describe("DA Gouache Wakfu — tokens", () => {
    it("la feuille de tokens existe et reste une feuille de couche", () => {
        expect(existsSync(CSS)).toBe(true);
        // Aucun reset global : la maquette embarquait `*{margin:0}` et
        // `body{display:grid}` — les importer casserait tout le produit.
        expect(css).not.toMatch(/(^|\n)\s*\*\s*[,{]/);
        expect(css).not.toMatch(/(^|\n)\s*body\s*\{/);
    });

    it("aucune déclaration sans le préfixe --da- (collision avec les tokens du produit)", () => {
        const bare = [...css.matchAll(/^\s*--(?!da-)[a-z0-9-]+\s*:/gm)].map((m) => m[0].trim());
        expect(bare).toEqual([]);
    });

    it("les six combinaisons bloc × mode existent", () => {
        for (const block of BLOCKS) {
            for (const mode of ["dark", "light"] as const) {
                const set = blockTokens(block, mode);
                for (const key of ["--da-acc", "--da-acc2", "--da-acc-ink", "--da-tint", "--da-on", "--da-outline"]) {
                    expect(set[key], `${block} ${mode} : ${key}`).toBeTruthy();
                }
            }
        }
    });

    it("« validé » est une couleur fixe, indépendante du bloc", () => {
        expect(dark["--da-ok"]).toBeTruthy();
        expect(light["--da-ok"]).toBeTruthy();
        // Aucun bloc ne redéfinit --da-ok : sinon la coche changerait de couleur
        // au changement de chapitre (défaut de la maquette).
        expect(css).not.toMatch(/\[data-block="(emeraude|cauchemar|ocre)"\][^{]*\{[^}]*--da-ok/);
    });
});

describe("DA Gouache Wakfu — contraste AA (4,5:1)", () => {
    for (const mode of ["dark", "light"] as const) {
        const base = mode === "dark" ? dark : light;

        it(`${mode} : texte principal et secondaire sur fond et sur carte`, () => {
            for (const block of BLOCKS) {
                const set = blockTokens(block, mode);
                const card = mix(base["--da-panel0"], set["--da-tint"], 0.12);
                const bg = mix(base["--da-bg0"], set["--da-tint"], 0.1);

                expect(contrast(base["--da-ink"], card), `${block} ink/card`).toBeGreaterThanOrEqual(4.5);
                expect(contrast(base["--da-ink"], bg), `${block} ink/bg`).toBeGreaterThanOrEqual(4.5);
                expect(contrast(base["--da-muted0"], card), `${block} muted/card`).toBeGreaterThanOrEqual(4.5);
            }
        });

        it(`${mode} : exigence, prérequis et accent en texte`, () => {
            for (const block of BLOCKS) {
                const set = blockTokens(block, mode);
                const card = mix(base["--da-panel0"], set["--da-tint"], 0.12);

                expect(contrast(base["--da-amber-ink"], card), `${block} amber/card`).toBeGreaterThanOrEqual(4.5);
                expect(contrast(base["--da-warn"], card), `${block} warn/card`).toBeGreaterThanOrEqual(4.5);
                expect(contrast(set["--da-acc-ink"], card), `${block} acc-ink/card`).toBeGreaterThanOrEqual(4.5);
            }
        });

        it(`${mode} : texte sur aplat d'accent (bouton principal)`, () => {
            for (const block of BLOCKS) {
                const set = blockTokens(block, mode);
                expect(contrast(set["--da-on"], set["--da-acc"]), `${block} on/acc`).toBeGreaterThanOrEqual(4.5);
            }
        });
    }
});

describe("DA Gouache Wakfu — coût de rendu", () => {
    it("aucun filtre sur les bords de carte hors qualité haute", () => {
        expect(css).toMatch(/\[data-quality="high"\]\s+\.da-card::before\s*\{\s*filter:\s*url\(#da-rough\)/);
        const cardRule = css.match(/\.da-card::before\s*\{([^}]*)\}/)?.[1] ?? "";
        expect(cardRule).not.toMatch(/filter:/);
    });

    it("les filtres sont coupés en qualité basse (PiP au-dessus du jeu)", () => {
        expect(css).toMatch(/\[data-quality="low"\]\s+\.da-grain::after\s*\{\s*display:\s*none/);
        expect(css).toMatch(/\[data-quality="low"\]\s+\.da-btn::before/);
    });

    it("le grain n'existe qu'une fois, en pseudo-élément de surface", () => {
        expect(css.match(/mix-blend-mode:\s*overlay/g)?.length).toBe(1);
    });

    it("les filtres référencés par le CSS sont exactement ceux du composant", () => {
        const used = new Set([...css.matchAll(/url\(#(da-[a-z]+)\)/g)].map((m) => m[1]));
        expect([...used].sort()).toEqual(["da-brush", "da-rough"]);

        const filters = readFileSync(FILTERS, "utf8");
        for (const id of used) {
            expect(filters).toContain(`id="${id}"`);
        }
    });
});

describe("DA Gouache Wakfu — rayons (règle « ≤ 12 px »)", () => {
    it("les deux seules exceptions sont justifiées sur place", () => {
        const radii = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
        const tooBig = radii.filter((value) => {
            const px = value.match(/(\d+(?:\.\d+)?)px/g) ?? [];
            return px.some((n) => parseFloat(n) > 12);
        });
        // Fenêtre 14 px (bord de fenêtre) et coin de carte 14 px (asymétrie
        // 4/14) : deux signatures de la DA, chacune commentée dans le CSS.
        expect(tooBig.sort()).toEqual(["14px", "4px 14px 4px 14px"]);
        expect(css).toMatch(/border-radius:\s*14px;\s*\/\* exception mesurée/);
        expect(css).toMatch(/border-radius:\s*4px 14px 4px 14px;\s*\/\* exception mesurée/);
    });
});

describe("DA Gouache Wakfu — harnais", () => {
    it("le skill existe, avec un frontmatter valide et son nom de dossier", () => {
        expect(existsSync(SKILL)).toBe(true);
        const body = readFileSync(SKILL, "utf8");
        expect(body).toMatch(/^---\r?\nname: sigilos-da-wakfu\r?\n/);
        expect(body).toMatch(/description: .{40,}/);
        // La règle demandée par le mainteneur : habillage, jamais déplacement.
        expect(body).toMatch(/Habillage seul/);
    });
});

describe("DA Gouache Wakfu — compteurs de filtre", () => {
    // Règle pure `countRushQuests` : une seule passe, une seule vérité.
    // Une quête terminée n'est JAMAIS comptée « verrouillée », même si l'entrée
    // est incohérente (même règle que `matchesRushQuestFilter`).
    it("compte chaque état une fois et le total à part", () => {
        const counts = countRushQuests([
            { isDone: true, isLocked: false },
            { isDone: true, isLocked: true },
            { isDone: false, isLocked: true },
            { isDone: false, isLocked: false },
            { isDone: false, isLocked: false },
        ]);
        expect(counts).toEqual({ all: 5, done: 2, locked: 1, active: 2 });
    });

    it("un filtre « Faites » ne rend que les quêtes terminées", () => {
        expect(matchesRushQuestFilter({ isDone: true, isLocked: false }, "done")).toBe(true);
        expect(matchesRushQuestFilter({ isDone: false, isLocked: false }, "done")).toBe(false);
        expect(matchesRushQuestFilter({ isDone: false, isLocked: true }, "done")).toBe(false);
    });
});

describe("DA Gouache Wakfu — dock (E1e)", () => {
    it("le compteur du dock est un mini-écriteau 40 × 28", () => {
        const mini = css.match(/\.da-plank\[data-size="mini"\]\s*\{([^}]*)\}/)?.[1] ?? "";
        expect(mini, "variante absente").not.toBe("");
        expect(mini).toMatch(/width:\s*40px/);
        expect(mini).toMatch(/height:\s*28px/);
    });

    it("le titre du chapitre n'est JAMAIS tronqué (plus d'ellipsis)", () => {
        const label = css.match(/\.da-dock \.da-dock-label\s*\{([^}]*)\}/)?.[1] ?? "";
        expect(label, "règle absente").not.toBe("");
        expect(label).not.toMatch(/text-overflow/);
        expect(label).not.toMatch(/overflow:\s*hidden/);
        // La taille reste celle de la maquette : 13 px condensé.
        expect(label).toMatch(/font:\s*700 13px/);
        expect(readFileSync(DOCK, "utf8")).toMatch(/className="da-dock-label/);
    });

    it("la case « tout le chapitre » est le nœud de la liste, pas un carré nu", () => {
        expect(readFileSync(DOCK, "utf8")).toMatch(
            /<span className="da-node" data-state=\{msDone \? "done" : "todo"\}/
        );
        expect(css).toMatch(/\.da-dock \.da-node\[data-state="done"\]::before/);
    });

    it("le filet de carte est teinté par le bloc, jamais un gris uniforme", () => {
        const card = css.match(/\.da-card::before\s*\{([^}]*)\}/)?.[1] ?? "";
        expect(card, "règle absente").not.toBe("");
        expect(card).toMatch(/border:\s*1\.6px solid var\(--da-acc2\)/);
        expect(card).not.toMatch(/var\(--da-ln\)/);
        // Même teinte sur le nœud « à faire maintenant ».
        const next = css.match(/\.da-row\[data-state="next"\] \.da-node::before\s*\{([^}]*)\}/)?.[1] ?? "";
        expect(next).toMatch(/border-color:\s*var\(--da-acc2\)/);
    });

    it("la description du bloc est rendue sous la bannière", () => {
        const shell = readFileSync(SHELL, "utf8");
        expect(shell).toMatch(/className="da-blockdesc"/);
        expect(shell).toMatch(/<RushRichText text=\{currentMs\.description\}/);
        expect(css).toMatch(/\.da-blockdesc\s*\{/);
    });

    it("le palier `wide` fait 276 px et la frise de stade est montée", () => {
        expect(css).toMatch(/\.da-hero\[data-density="wide"\]\s*\{\s*min-height:\s*276px/);
        expect(css).toMatch(/\.da-stage\s*\{/);
        const header = readFileSync(HEADER, "utf8");
        expect(header).toMatch(/dofusStage\(overallPct\)/);
        expect(header).toMatch(/RUSH_DOFUS_STAGE_COUNT/);
        // L'hôte décide du palier : `wide` dès 820 px de haut.
        expect(readFileSync(SHELL, "utf8")).toMatch(/h >= 820 \? "wide"/);
    });
});
