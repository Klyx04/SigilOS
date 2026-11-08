/**
 * Profil dashboard — **cliquet de déslop** (lot P1 de `docs/plans/PLAN-REFONTE-PROFIL-DASHBOARD.md`).
 *
 * Pourquoi un test : `docs/RULES.md` § UI interdit les couleurs de palette en dur, les rayons
 * > 12 px et le glassmorphisme — mais une règle déclarative ne prouve rien. Ce fichier transforme
 * l'audit du 08/11/2026 en **plafond vérifiable** : le compte ne peut que descendre.
 *
 * Mesure du 08/11/2026 (28 fichiers de l'écran profil, commentaires retirés), **avant** les lots :
 *   · **81** classes de palette en dur (`text-emerald-400`, `bg-zinc-…`), dont **50** dans le seul
 *     bento : 9 familles de teintes pour 12 onglets, alors qu'un écran n'a droit qu'à **une**
 *     teinte d'accent ;
 *   · **~100** marqueurs « AI slop » (`font-black`, `backdrop-blur`, `bg-gradient-to-`,
 *     `glass-premium`) — **1 seul** dans le bento, le reste chez ses voisins ;
 *   · **56** rayons > 12 px (`rounded-2xl` = 16 px, `rounded-3xl` = 24 px).
 *
 * Après **P2** (onglets) et **P2-bis** (les trois cartes de l'onglet Général) : **30** classes de
 * palette, **65** marqueurs slop, **48** rayons. Les budgets ci-dessous sont déjà à ces valeurs.
 *
 * **Hors périmètre, volontairement** : les **couleurs de donnée** (hex dans `style`, ex.
 * `getClassColor`, couleur d'un rôle Discord) ne sont pas du slop — les compter pousserait à une
 * « correction » qui effacerait du sens. On ne compte que les classes de palette Tailwind.
 *
 * Le cliquet va dans les **deux sens** (même discipline que `responsive-guard.test.ts`) : un budget
 * très au-dessus du compte réel est une dette — le lot qui corrige doit baisser le budget ici.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Les deux racines de l'écran profil : composants clients + page serveur. */
const ROOTS = ["src/components/profile", "src/app/dashboard/[guildId]/profile"] as const;

const PREFIXES =
    "bg|text|border|from|via|to|ring|shadow|fill|stroke|decoration|divide|outline|placeholder|accent|caret|scrollbar-thumb|scrollbar-track";
const FAMILIES =
    "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const COUNTERS = {
    /** `text-emerald-400`, `bg-zinc-800/60`, `scrollbar-thumb-zinc-700`… */
    palette: new RegExp(`(?:${PREFIXES})-(?:${FAMILIES})-[0-9]{2,3}`, "g"),
    /** Marqueurs d'« AI slop » mesurés dans le dépôt. */
    slop: /font-black|glass-premium|bg-gradient-to-|backdrop-blur/g,
    /** Rayons au-delà de la limite de 12 px (2xl = 16 px, 3xl = 24 px, `rounded-[Npx]` > 12). */
    rayon: /rounded-2xl|rounded-3xl|rounded-\[(?:1[3-9]|[2-9][0-9])px\]/g,
} as const;

type Counter = keyof typeof COUNTERS;

/** Plafonds **mesurés** le 08/11/2026. Ils ne peuvent que descendre. */
const BUDGET: Record<string, Record<Counter, number>> = {
    "src/components/profile/achievement-validation-queue.tsx": { palette: 11, slop: 2, rayon: 1 },
    "src/components/profile/add-build-modal.tsx": { palette: 1, slop: 8, rayon: 1 },
    "src/components/profile/alignment-section.tsx": { palette: 0, slop: 0, rayon: 0 },
    "src/components/profile/alt-pseudos.tsx": { palette: 0, slop: 1, rayon: 2 },
    "src/components/profile/archi-matching-widget.tsx": { palette: 0, slop: 1, rayon: 0 },
    "src/components/profile/availability-heatmap.tsx": { palette: 13, slop: 1, rayon: 1 },
    "src/components/profile/builds-card.tsx": { palette: 0, slop: 7, rayon: 6 },
    "src/components/profile/class-display.tsx": { palette: 0, slop: 0, rayon: 0 },
    "src/components/profile/discord-ownership-modal.tsx": { palette: 0, slop: 5, rayon: 1 },
    "src/components/profile/hero-header.tsx": { palette: 3, slop: 0, rayon: 1 },
    "src/components/profile/introduction-card.tsx": { palette: 0, slop: 7, rayon: 5 },
    "src/components/profile/jobs-grid.tsx": { palette: 0, slop: 0, rayon: 2 },
    "src/components/profile/legendary-crafting.tsx": { palette: 0, slop: 0, rayon: 0 },
    "src/components/profile/legendary-pet-toggle.tsx": { palette: 0, slop: 0, rayon: 0 },
    "src/components/profile/metamob-link.tsx": { palette: 0, slop: 0, rayon: 0 },
    "src/components/profile/presentation-card.tsx": { palette: 0, slop: 0, rayon: 0 },
    "src/components/profile/profile-activity-tab.tsx": { palette: 0, slop: 0, rayon: 1 },
    // P2 : 50 classes de palette (9 familles pour 12 onglets) → 0, une seule teinte d'accent.
    "src/components/profile/profile-bento-grid.tsx": { palette: 0, slop: 1, rayon: 1 },
    "src/components/profile/profile-dofus-tab.tsx": { palette: 0, slop: 0, rayon: 2 },
    "src/components/profile/profile-services-tab.tsx": { palette: 0, slop: 8, rayon: 5 },
    "src/components/profile/profile-tour-replay-button.tsx": { palette: 0, slop: 0, rayon: 0 },
    "src/components/profile/skin-library.tsx": { palette: 0, slop: 9, rayon: 8 },
    "src/components/profile/solicit-action.tsx": { palette: 0, slop: 0, rayon: 0 },
    "src/components/profile/success-sync.tsx": { palette: 2, slop: 11, rayon: 1 },
    "src/components/profile/user-request-modal.tsx": { palette: 0, slop: 1, rayon: 1 },
    "src/components/profile/user-settings.tsx": { palette: 0, slop: 2, rayon: 9 },
    "src/components/profile/vacation-mode.tsx": { palette: 0, slop: 1, rayon: 0 },
    "src/app/dashboard/[guildId]/profile/page.tsx": { palette: 0, slop: 0, rayon: 0 },
};

const BENTO = "src/components/profile/profile-bento-grid.tsx";

/** Retire les commentaires : un exemple cité dans un commentaire n'est pas une occurrence. */
function codeOf(file: string): string {
    return readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function count(file: string, counter: Counter): number {
    return (codeOf(file).match(COUNTERS[counter]) ?? []).length;
}

/** Tous les `.tsx` des deux racines, en chemins relatifs au dépôt, triés. */
function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith(".tsx")) out.push(full.split(path.sep).join("/"));
    }
    return out;
}

function filesOnDisk(): string[] {
    return ROOTS.flatMap((root) => walk(root)).sort();
}

describe("Profil dashboard — le cliquet ne remonte jamais", () => {
    it("tout fichier de l'écran profil est déclaré (un fichier neuf ne passe pas)", () => {
        // Un composant ajouté au profil sans ligne dans BUDGET échappe au cliquet : on l'interdit.
        expect(filesOnDisk()).toEqual(Object.keys(BUDGET).sort());
        for (const file of Object.keys(BUDGET)) {
            expect(existsSync(file), `${file} : budget orphelin (fichier renommé ou supprimé)`).toBe(true);
        }
    });

    for (const [file, budget] of Object.entries(BUDGET).sort(([a], [b]) => a.localeCompare(b))) {
        it(`${file} reste sous ses plafonds`, () => {
            for (const counter of Object.keys(COUNTERS) as Counter[]) {
                expect(
                    count(file, counter),
                    `${file} · ${counter} : plafond ${budget[counter]}`
                ).toBeLessThanOrEqual(budget[counter]);
            }
        });

        it(`${file} tient son budget à jour`, () => {
            // Même règle que `responsive-guard` : plus d'une occurrence corrigée sans baisser le
            // budget ici, c'est un plafond qui ne protège plus rien.
            for (const counter of Object.keys(COUNTERS) as Counter[]) {
                expect(
                    count(file, counter),
                    `${file} · ${counter} : baisse le budget dans ce fichier (compte descendu)`
                ).toBeGreaterThanOrEqual(budget[counter] - 1);
            }
        });
    }
});

describe("P2 — une seule teinte d'accent dans le bento", () => {
    it("aucune classe de palette en dur ne subsiste", () => {
        // Les onglets portaient une couleur par domaine : 9 familles pour 12 onglets.
        expect(count(BENTO, "palette")).toBe(0);
    });

    it("l'onglet actif passe par le token `accent`, plus par une teinte de domaine", () => {
        const src = codeOf(BENTO);
        expect(src).toContain('const ACTIVE_TAB_CLASSES = "bg-accent/15 border-accent/30 text-accent');
        expect(src).toContain('const ACTIVE_TAB_ICON_CLASSES = "text-accent"');
        // Les deux champs qui portaient la couleur par onglet ont disparu de la définition.
        expect(src).not.toContain("activeColor");
        expect(src).not.toContain("bgActive");
    });
});

describe("P2-bis — les trois cartes de l'onglet Général sont épurées", () => {
    const CARTES = ["class-display.tsx", "metamob-link.tsx", "alignment-section.tsx"] as const;

    for (const carte of CARTES) {
        it(`${carte} : zéro couleur de palette, zéro marqueur slop, zéro rayon > 12 px`, () => {
            const file = `src/components/profile/${carte}`;
            for (const counter of Object.keys(COUNTERS) as Counter[]) {
                expect(count(file, counter), `${carte} · ${counter}`).toBe(0);
            }
        });
    }

    it("plus de carte dans la carte : une seule surface, plus de dégradé imbriqué", () => {
        // Défaut mesuré le 08/11/2026 : chaque carte `border` contenait une seconde carte
        // `border` + `bg-gradient-to-br` + `backdrop-blur-md` (boîte dans la boîte).
        for (const carte of ["metamob-link.tsx", "alignment-section.tsx"] as const) {
            const src = codeOf(`src/components/profile/${carte}`);
            expect(src, `${carte} : dégradé de surface imbriqué`).not.toContain("bg-gradient-to-br");
            expect(src, `${carte} : verre dépoli`).not.toContain("backdrop-blur");
        }
    });
});
