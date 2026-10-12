/**
 * 🚦 Sommaire `/bestiaire` — le coût **par visite** (mesure du 12/10/2026).
 *
 * Constat user : « cette page lag comme pas possible, le scroll infini, les images mettent un temps
 * fou à charger, l'impression que ça fait lagger notre site ».
 *
 * **Mesures bêta** : 6,4 Mo de HTML (**285 Ko** compressés), **4 399 `<img>`**, **8 982 liens**,
 * **1,9 s** de TTFB, et surtout `Cache-Control: private, no-store, max-age=0` **malgré**
 * `export const revalidate = 3600` — parce que la page appelle `auth()`/`headers()` (nonce CSP) et
 * est donc rendue **à chaque visite**, en relisant **5 129** monstres.
 *
 * Ce verrou protège la correction retenue : la **donnée** est mise en cache 1 h (`withCache`, Redis,
 * repli automatique sur la source) et le **navigateur** ignore les familles hors écran. Une page
 * 100 % statique est volontairement exclue : `src/lib/csp.ts` construit un `script-src` **nonce-based
 * sans `'unsafe-inline'`**, donc les JSON-LD (nonce par requête) seraient bloqués.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

describe("sommaire /bestiaire — donnée mise en cache, hors-écran ignoré", () => {
    const actions = read("src/server/actions/game-data-actions.ts");

    it("`getBestiaryHub` passe par `withCache` avec un TTL d'une heure", () => {
        expect(actions).toContain('const BESTIARY_HUB_CACHE_KEY = "bestiary:hub:v1";');
        expect(actions).toContain('const BESTIARY_HUB_TTL_SECONDS = 3600;');
        expect(actions).toContain("withCache(BESTIARY_HUB_CACHE_KEY, BESTIARY_HUB_TTL_SECONDS");
    });

    it("la construction du sommaire est PURE (cachable telle quelle, aucune IO)", () => {
        // Fin de bloc robuste (le dépôt est en CRLF) : on s'arrête à la prochaine déclaration.
        const start = actions.indexOf("function buildBestiaryHubPayload");
        const rest = actions.slice(start);
        const end = rest.search(/\n(?:export )?(?:async )?function\s/);
        const builder = end > 0 ? rest.slice(0, end) : rest;
        expect(builder.length).toBeGreaterThan(500);
        expect(builder).not.toMatch(/\bawait\b/);
        expect(builder).not.toContain("db.");
    });

    it("la page laisse le navigateur ignorer le hors-écran et fige les dimensions des icônes", () => {
        const page = read("src/app/bestiaire/page.tsx");
        expect(page).toContain("contentVisibility");
        expect(page).toContain("containIntrinsicSize");
        expect(page).toContain('decoding="async"');
        expect(page).toContain("width={32}");
        // La liste reste complète (demande du 11/10) : le budget de liens est inchangé.
        expect(actions).toContain("BESTIARY_HUB_MAX_LINKS = 6000");
    });
});