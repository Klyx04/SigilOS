/**
 * Icônes `GameIcon` — verrou d'existence des fichiers (Sentry `JAVASCRIPT-NEXTJS-1K`).
 *
 * 🐛 Mesure du 17/10/2026 : `⨯ internal image response failed for
 * /assets/dofus/game-icons/ladder.png 404` sur `GET /_next/image`, 2 événements bêta.
 * Cause : `GameIcon` préfixait **toujours** `/assets/dofus/game-icons/`, or l'onglet
 * « Rôles d'ancienneté » du module Membres demandait `ladder.png` — fichier **absent** de
 * ce dossier (il n'existe que dans `public/assets/dofus/modules/`, déjà versionné pour
 * `module-catalog.ts`). L'icône cassée n'était donc pas un asset manquant mais un **chemin
 * reconstruit** à partir d'un nom : exactement la famille de bug du succès « Spécial ».
 *
 * 🔒 Ce que ce fichier verrouille :
 *  ① chaque `.png` cité par un composant qui rend `<GameIcon>` existe **vraiment** sous
 *    `public/` (chemin absolu tel quel, sinon `game-icons/<nom>`) ;
 *  ② `GameIcon` accepte un chemin absolu (plus de reconstruction aveugle) ;
 *  ③ non-régression de l'onglet « Rôles d'ancienneté » (plus de `"ladder.png"` nu).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GAME_ICONS_DIR = "public/assets/dofus/game-icons";

/** Toutes les sources TypeScript du dossier `src/`. */
function sources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...sources(full));
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

/** Fichiers qui rendent `<GameIcon …>` (hors le composant lui-même). */
const CONSOMMATEURS = sources(path.join(ROOT, "src"))
    .filter((file) => !file.endsWith("game-icon.tsx"))
    .filter((file) => /<GameIcon\b/.test(readFileSync(file, "utf8")));

/** Résolution appliquée par `GameIcon` : absolu = tel quel, sinon `game-icons/<nom>`. */
function resolveGameIcon(src: string): string {
    return src.startsWith("/")
        ? path.join(ROOT, "public", src)
        : path.join(ROOT, "public/assets/dofus/game-icons", src);
}

describe("icônes GameIcon — aucun chemin reconstruit vers un fichier absent", () => {
    it("① chaque .png cité par un consommateur existe sous public/", () => {
        expect(CONSOMMATEURS.length).toBeGreaterThan(3);

        const manquants: string[] = [];
        for (const file of CONSOMMATEURS) {
            const source = readFileSync(file, "utf8");
            // Littéraux simples uniquement (les expressions sont ignorées).
            for (const match of source.matchAll(/"(\/?[\w./-]+\.png)"/g)) {
                const candidate = match[1];
                if (!existsSync(resolveGameIcon(candidate))) {
                    manquants.push(`${path.relative(ROOT, file)} → ${candidate}`);
                }
            }
        }

        expect(manquants).toEqual([]);
    });

    it("② GameIcon rend un chemin absolu tel quel", () => {
        const source = readFileSync("src/components/shared/game-icon.tsx", "utf8");
        expect(source).toMatch(/src\.startsWith\("\/"\)\s*\?\s*src\s*:\s*`\/assets\/dofus\/game-icons\/\$\{src\}`/);
        expect(source).toContain("src={href}");
    });

    it("③ l'onglet « Rôles d'ancienneté » pointe l'asset réellement versionné", () => {
        const source = readFileSync("src/components/admin/members/member-management.tsx", "utf8");
        expect(source).toContain('icon: "/assets/dofus/modules/ladder.png"');
        expect(source).not.toContain('icon: "ladder.png"');
        // L'asset canonique du module existe (source unique : `public/assets/dofus/modules/`).
        expect(existsSync(path.join(ROOT, "public/assets/dofus/modules/ladder.png"))).toBe(true);
        // …et il n'a pas été dupliqué dans `game-icons/` pour faire taire le 404.
        expect(existsSync(path.join(ROOT, GAME_ICONS_DIR, "ladder.png"))).toBe(false);
    });
});
