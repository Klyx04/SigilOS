/**
 * T0 — **une seule origine** : `getAppBaseUrl()`.
 *
 * Mesure du 18/10/2026 : ~30 endroits réécrivaient la règle
 * `process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr"` à la main. Conséquence : si seule
 * `NEXTAUTH_URL` est posée (cas bêta), ces liens partaient vers **la prod** ; un des sites
 * n'avait **aucun** repli (le lien devenait `undefined/dashboard/…`) et 4 assets d'embed
 * pointaient en dur sur `https://sigilos.fr` (une carte bêta renvoyait vers les fichiers prod).
 *
 * 🔒 Ce que ce test verrouille :
 *  ① `src/server/**` ne lit plus `NEXT_PUBLIC_APP_URL` directement (hors **détection** d'environnement) ;
 *  ② aucune URL `sigilos.fr` en dur hors allow-list motivée (source unique, robots, CSP, CORS, maquette)
 *    et hors lignes d'identité (`User-Agent`) ;
 *  ③ l'origine est normalisée (jamais de `//` dans les liens construits).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { resolveAppBaseUrl } from "@/lib/utils";

const ROOT = process.cwd();

/** Toutes les sources TypeScript de `src/`. */
function fichiersSource(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...fichiersSource(full));
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

/** Retire les commentaires : la documentation cite le domaine à dessein. */
function codeSeul(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Fichiers qui ont le droit de citer le domaine, **avec leur motif**. */
const FICHIERS_AUTORISES = new Map<string, string>([
    ["src/lib/utils.ts", "source unique : repli documenté + avertissement d'origine manquante"],
    ["src/app/robots.ts", "compare l'origine courante à prod/bêta pour décider l'indexabilité"],
    ["src/lib/csp.ts", "wss://*.sigilos.fr couvre les deux environnements"],
    ["src/server/websocket/server.ts", "allow-list CORS explicite des deux origines"],
    ["src/lib/i18n/locales/fr.ts", "titre de la maquette de navigateur (texte, pas un lien)"],
    ["src/lib/i18n/locales/en.ts", "titre de la maquette de navigateur (texte, pas un lien)"],
]);

/** Identité/contact du projet : un `User-Agent` n'est pas une origine d'environnement. */
const LIGNE_AUTORISEE = /User-Agent|SigilOS\/1\.0|DiscordBot \(https:\/\/sigilos\.fr/;

describe("T0 — une seule origine (getAppBaseUrl)", () => {
    it("① le serveur ne lit plus NEXT_PUBLIC_APP_URL directement (hors détection bêta)", () => {
        const fautifs: string[] = [];
        for (const file of fichiersSource(path.join(ROOT, "src/server"))) {
            codeSeul(readFileSync(file, "utf8"))
                .split("\n")
                .forEach((line, index) => {
                    if (!line.includes("NEXT_PUBLIC_APP_URL")) return;
                    // Détection d'environnement (choisir une variante), jamais une URL construite.
                    if (/isBeta|includes\(["']beta["']\)/.test(line)) return;
                    fautifs.push(`${path.relative(ROOT, file)}:${index + 1}`);
                });
        }
        expect(fautifs).toEqual([]);
    });

    it("② aucune URL sigilos.fr en dur hors allow-list (et hors User-Agent)", () => {
        const fautifs: string[] = [];
        for (const file of fichiersSource(path.join(ROOT, "src"))) {
            const rel = path.relative(ROOT, file).split(path.sep).join("/");
            if (FICHIERS_AUTORISES.has(rel)) continue;
            codeSeul(readFileSync(file, "utf8"))
                .split("\n")
                .forEach((line, index) => {
                    if (!/https?:\/\/(beta\.)?sigilos\.fr/.test(line)) return;
                    if (LIGNE_AUTORISEE.test(line)) return;
                    fautifs.push(`${rel}:${index + 1}`);
                });
        }
        expect(fautifs).toEqual([]);
    });

    it("③ l'origine est normalisée (pas de double slash dans un lien)", () => {
        expect(resolveAppBaseUrl({ NEXT_PUBLIC_APP_URL: "https://exemple.test/" }).url).toBe("https://exemple.test");
        expect(resolveAppBaseUrl({ NEXT_PUBLIC_APP_URL: "https://exemple.test///" }).url).toBe(
            "https://exemple.test",
        );
        expect(resolveAppBaseUrl({ NEXTAUTH_URL: "https://beta.sigilos.fr/" }).url).toBe(
            "https://beta.sigilos.fr",
        );
    });
});