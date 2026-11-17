/**
 * Gardes — **déslop God, périmètre complet `src/app/god/**`** (lot D6, 17/11/2026).
 *
 * 🎯 Le God était volontairement **allowlisté** dans la règle `sigil/no-hardcoded-colors`
 * (`eslint.config.mjs`). Ce test est donc la **seule** barrière qui empêche le retour
 * du « chaque écran invente sa palette ». Depuis D6, la garde ne compte plus seulement
 * des fichiers : elle exige **zéro** classe de palette en dur, **zéro** recette de
 * carte brute et **zéro** motif de slop (formes, effets, graisses) sur tout le périmètre.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const GOD_ROOT = "src/app/god";
const RAW_CARD = /bg-zinc-900\/2[05] border border-white\/5 rounded-3xl/g;
const PALETTE =
    /\b(?:text|bg|border|from|to|via|ring|shadow|divide|placeholder|fill|stroke)-(?:zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?\b|\b(?:text|bg|border)-(?:white|black)(?:\/\d+)?\b/g;
const ARBITRARY_COLOR = /-(?:text|bg|border|from|to|via|ring|shadow|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g;
const SHAPE_SLOP =
    /\b(?:font-black|font-extrabold|rounded-2xl|rounded-3xl|backdrop-blur(?:-\w+)?|tracking-widest|shadow-lg|shadow-xl|shadow-2xl|glass-premium)\b/g;

/** Écrans refondus : ils DOIVENT passer par le kit. */
const REFONTE_FILES = [
    "src/app/god/guilds/[id]/page.tsx",
    "src/app/god/guilds/[id]/god-guild-modules-client.tsx",
    "src/app/god/guilds/[id]/god-guild-access-panel.tsx",
    "src/app/god/logs/page.tsx",
    "src/app/god/logs/log-viewer.tsx",
    "src/app/god/logs/delegated-access-view.tsx",
    "src/app/god/components/system-health-dashboard.tsx",
];

/** Liste récursive des fichiers d'un dossier. */
function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : [full.replace(/\\/g, "/")];
    });
}

const GOD_FILES = walk(GOD_ROOT).filter((file) => /\.tsx?$/.test(file));

/** Un scrim de modale est le seul `bg-black` toléré (le kit `dialog.tsx` fait pareil). */
function withoutScrims(source: string): string {
    return source
        .split("\n")
        .map((line) => (line.includes("fixed inset-0") ? line.replace(/bg-black\/\d+/g, "bg-scrim") : line))
        .join("\n");
}

/** Fichiers qui portent encore un motif, avec les motifs trouvés (pour un échec lisible). */
function offenders(pattern: RegExp): string[] {
    return GOD_FILES.flatMap((file) => {
        const matches = withoutScrims(readFileSync(file, "utf8")).match(pattern) ?? [];
        return matches.length > 0 ? [`${file} → ${[...new Set(matches)].join(", ")}`] : [];
    });
}

/** Rayons arbitraires au-delà de 12 px (la DA autorise ≤ 12 px, 14 px pour la fenêtre Rush). */
function oversizedRadii(): string[] {
    return GOD_FILES.flatMap((file) => {
        const source = readFileSync(file, "utf8");
        const bad: string[] = [];
        for (const match of source.matchAll(/rounded-\[([0-9.]+)(px|rem|em)\]/g)) {
            const value = Number(match[1]);
            const tooBig = match[2] === "px" ? value > 12 : value > 0.75;
            if (tooBig) bad.push(match[0]);
        }
        return bad.length > 0 ? [`${file} → ${[...new Set(bad)].join(", ")}`] : [];
    });
}

describe("déslop God — zéro palette en dur sur tout le périmètre", () => {
    it("aucune classe de palette (zinc/emerald/amber/rose/white/black…) ne subsiste", () => {
        expect(offenders(PALETTE), "classes de palette en dur : utiliser les tokens de la DA").toEqual([]);
    });

    it("aucune couleur arbitraire en classe ne subsiste", () => {
        expect(offenders(ARBITRARY_COLOR), "couleurs arbitraires : utiliser les tokens de la DA").toEqual([]);
    });

    it("aucune forme de slop (graisses, rayons, flous, ombres) ne subsiste", () => {
        expect(offenders(SHAPE_SLOP), "motifs de slop : utiliser le kit God (≤ 12 px, pas de glass)").toEqual([]);
        expect(oversizedRadii(), "rayon arbitraire > 12 px").toEqual([]);
    });

    it("plus aucune recette brute dans src/app/god (elle vit dans GOD_CARD_BASE)", () => {
        expect(offenders(RAW_CARD), "cartes recopiées à la main : utiliser <GodCard> / GOD_CARD_BASE").toEqual([]);
    });
});

describe("déslop God — le kit et les surfaces refondues", () => {
    it("le kit God exporte la recette partagée", () => {
        const kit = readFileSync("src/app/god/ui/god-card.tsx", "utf8");
        expect(kit).toContain("export const GOD_CARD_BASE");
        const index = readFileSync("src/app/god/ui/index.ts", "utf8");
        expect(index).toContain("GOD_CARD_BASE");
    });

    it("les surfaces refondues consomment le kit", () => {
        for (const file of REFONTE_FILES) {
            const code = readFileSync(file, "utf8");
            expect(code, `${file} n'utilise pas le kit God`).toMatch(/from "@\/app\/god\/ui"|from "\.\.\/ui"|from "\.\.\/\.\.\/ui"/);
        }
    });

    it("l'ancienne liste d'utilisateurs orpheline et son action destructive ont disparu", () => {
        expect(existsSync("src/app/god/user-list.tsx")).toBe(false);
        const actions = readFileSync("src/server/actions/super-admin-actions.ts", "utf8");
        expect(actions).not.toContain("export async function forceDeleteUser");
    });
});

describe("déslop God — le périmètre reste borné", () => {
    it("le nombre de fichiers God ne remonte pas (plafond 78)", () => {
        // 79 → 78 le 17/11/2026 (D6) : `user-list.tsx` était orphelin (aucun import)
        // et portait une action de suppression de compte sans appelant. Ce plafond
        // ne peut que DÉCROÎTRE — il matérialise le reste, il ne l'excuse pas.
        const CEILING = 78;
        expect(GOD_FILES.length).toBeLessThanOrEqual(CEILING);
    });
});
