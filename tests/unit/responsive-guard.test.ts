/**
 * Garde responsive — **cliquet** (ratchet), pas un big bang.
 *
 * Le skill `.cline/skills/responsive/` dit *quoi* faire ; il ne peut pas prouver qu'on l'a fait.
 * Un skill purement déclaratif est une intention. Ce test le rend **vérifiable** : il compte les
 * trois anti-patterns qui ont réellement cassé des écrans, et **interdit qu'ils augmentent**.
 *
 * Mesure du 07/11/2026 (état figé, à ne jamais relever) :
 *   · `100vh` sur mobile — la barre d'URL change la hauteur visible (21 occurrences) ;
 *   · `h-screen` — même piège, version Tailwind (48) ;
 *   · largeur **fixe** > 400 px — déborde à 390 px de viewport (57, dont 12 décors à 1 600/2 500 px).
 *
 * Ce n'est pas « le responsive est à refaire » : **452 fichiers sur 799** utilisent déjà des
 * variantes responsive. C'est un plafond qui empêche la régression pendant qu'on corrige, écran
 * par écran. Quand un lot corrige des occurrences, **il baisse le budget** dans le même commit.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = "src";
const EXTENSIONS = new Set([".tsx", ".ts", ".css"]);
const SKIP_DIRS = new Set(["node_modules", "temp", ".next"]);

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
        } else if (EXTENSIONS.has(path.extname(entry.name))) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
}

const CORPUS = walk(ROOT)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

const occurrences = (re: RegExp) => (CORPUS.match(re) ?? []).length;

/** Plafonds **mesurés** le 07/11/2026. Ils ne peuvent que descendre. */
const BUDGET = {
    "100vh": 21,
    "h-screen": 48,
    "largeur fixe > 400px": 57,
} as const;

const COUNTERS: Record<keyof typeof BUDGET, RegExp> = {
    "100vh": /100vh/g,
    "h-screen": /h-screen/g,
    "largeur fixe > 400px": /w-\[(4[0-9][0-9]|[5-9][0-9][0-9]|[0-9]{4,})px\]/g,
};

describe("Garde responsive — le cliquet ne remonte jamais", () => {
    it("aucun anti-pattern ne dépasse le budget mesuré", () => {
        for (const [label, re] of Object.entries(COUNTERS) as Array<
            [keyof typeof BUDGET, RegExp]
        >) {
            expect(occurrences(re), `${label} : budget ${BUDGET[label]}`).toBeLessThanOrEqual(
                BUDGET[label]
            );
        }
    });

    it("les budgets restent d'actualité (un budget oublié est une dette)", () => {
        // Si un compteur est très en dessous de son plafond, le lot qui l'a corrigé a oublié
        // de baisser le budget : on l'exige, sinon le cliquet ne protège plus rien.
        for (const [label, re] of Object.entries(COUNTERS) as Array<
            [keyof typeof BUDGET, RegExp]
        >) {
            expect(
                occurrences(re),
                `${label} : baisse le budget dans ce fichier`
            ).toBeGreaterThan(BUDGET[label] - 6);
        }
    });
});

describe("Le skill responsive est branché (pas seulement présent)", () => {
    it("le skill et ses deux références existent", () => {
        expect(existsSync(".cline/skills/responsive/SKILL.md")).toBe(true);
        expect(existsSync(".cline/skills/responsive/references/tailwind-v4.md")).toBe(true);
        expect(existsSync(".cline/skills/responsive/references/sigilos.md")).toBe(true);
    });

    it("les règles du dépôt et l'amorce le citent — un skill qu'on ne route pas est mort", () => {
        const rules = readFileSync("docs/RULES.md", "utf8");
        const agents = readFileSync("AGENTS.md", "utf8");
        const harnais = readFileSync("docs/agents/harnais.md", "utf8");
        for (const [name, text] of [["RULES", rules], ["AGENTS", agents], ["harnais", harnais]] as const) {
            expect(text, `${name} ne route pas le skill responsive`).toContain("skills/responsive");
        }
    });
});
