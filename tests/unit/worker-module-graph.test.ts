/**
 * Garde A1 — le worker d'arrière-plan ne doit JAMAIS entraîner `@/lib/security` (donc jsdom).
 *
 * Incident mesuré (capture God du 28/09/2026) : les datasets `BOUNTIES` et `ANOMALY_BOSSES`
 * échouaient en arrière-plan avec
 *
 *   Error: ENOENT: no such file or directory, open '/browser/default-stylesheet.css'
 *
 * alors que la même passe « dans l'onglet » réussissait. Cause racine prouvée :
 * `npm run build:worker` bundle `src/workers/metamob-worker.ts` dans `dist/worker.js`, déployé
 * en `/app/worker.js` (`Dockerfile`). Les siphons d'arrière-plan importaient
 * `@/server/actions/{game-data,dofensive}-actions`, une action traînant `@/lib/security` →
 * `isomorphic-dompurify` → **jsdom**, qui lit son `browser/default-stylesheet.css` via
 * `path.resolve(__dirname, "../../../browser/…")` **à l'évaluation du module**
 * (`jsdom/lib/jsdom/living/css/helpers/computed-style.js:18`) : le `__dirname` inliné par esbuild
 * ne tombe plus juste ⇒ trois `..` mènent à `/browser/…`. Un module qui lève à l'évaluation est
 * réévalué au `import()` suivant ⇒ **une erreur par item**.
 *
 * Ce garde marche le graphe d'imports RÉEL (statiques ET dynamiques) depuis l'entrée du worker :
 * plus rapide qu'un build esbuild, et il échoue là où le bug est né — avant même le bundle.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const ROOT = process.cwd();
/** Entrée du bundle `dist/worker.js` (`package.json` → `build:worker`). */
const ENTRY = "src/workers/metamob-worker.ts";
const CANDIDATE_EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

/** Résout un spécifieur local (`@/…` ou relatif) vers un chemin du dépôt ; `null` pour un paquet. */
function resolveLocal(fromFile: string, specifier: string): string | null {
    const base = specifier.startsWith("@/")
        ? resolve(ROOT, "src", specifier.slice(2))
        : specifier.startsWith("./") || specifier.startsWith("../")
            ? resolve(dirname(resolve(ROOT, fromFile)), specifier)
            : null;
    if (!base) return null;
    for (const extension of CANDIDATE_EXTENSIONS) {
        if (existsSync(base + extension)) return relative(ROOT, base + extension).replace(/\\/g, "/");
    }
    return null;
}

/** Tous les spécifieurs importés par un module (statiques, `import()`, `require`, `export … from`). */
function importsOf(file: string): { specifier: string; typeOnly: boolean }[] {
    const source = readFileSync(resolve(ROOT, file), "utf8");
    const patterns = [
        /(?:^|\n)\s*import\s+[^"'`]*?from\s+["'`]([^"'`]+)["'`]/g,
        /(?:^|\n)\s*import\s+["'`]([^"'`]+)["'`]/g,
        /import\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
        /require\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
        /(?:^|\n)\s*export\s+[^"'`]*?from\s+["'`]([^"'`]+)["'`]/g,
    ];
    const typeOnlySpecifiers = new Set(
        [...source.matchAll(/(?:^|\n)\s*import\s+type\s+[^"'`]*?from\s+["'`]([^"'`]+)["'`]/g)].map((m) => m[1])
    );
    const specifiers: string[] = [];
    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
    }
    return [...new Set(specifiers)].map((specifier) => ({
        specifier,
        typeOnly: typeOnlySpecifiers.has(specifier),
    }));
}

/** Marche du graphe : `files` = modules atteints (avec la chaîne qui y mène), `edges` = arêtes. */
function workerGraph() {
    const files = new Map<string, string>();
    const edges: { from: string; specifier: string; typeOnly: boolean }[] = [];
    const queue: { file: string; via: string }[] = [{ file: ENTRY, via: "(entrée)" }];

    while (queue.length > 0) {
        const { file, via } = queue.shift()!;
        if (files.has(file)) continue;
        files.set(file, via);
        if (!existsSync(resolve(ROOT, file))) continue;

        for (const { specifier, typeOnly } of importsOf(file)) {
            edges.push({ from: file, specifier, typeOnly });
            const local = resolveLocal(file, specifier);
            if (local) queue.push({ file: local, via: `${file} → ${specifier}` });
        }
    }
    return { files, edges };
}

const GRAPH = workerGraph();

/** Arêtes d'un module `src/lib/**` vers `@/server/**` (auth Next + graph serveur : à éviter). */
function libToServerEdges(): string[] {
    return GRAPH.edges
        .filter((edge) => edge.from.startsWith("src/lib/") && edge.specifier.startsWith("@/server/"))
        .map((edge) => `${edge.from} → ${edge.specifier}`)
        .sort();
}

/**
 * Arêtes `src/lib → @/server` TOLÉRÉES, avec leur raison : `@/server/game/dungeon-slug` (helper
 * Prisma, sans session Next) et les notifications God **dynamiques** (`notifyGod`), qui ne tirent
 * ni jsdom ni la chaîne d'auth. Toute nouvelle ligne ici doit être justifiée **en commentaire**.
 */
const DOCUMENTED_LIB_TO_SERVER_EDGES = [
    "src/lib/anomaly-boss-siphon.ts → @/server/game/dungeon-slug",
    "src/lib/discord-veille.ts → @/server/actions/god-notif-actions",
    "src/lib/dofusdb-limiter.ts → @/server/actions/god-notif-actions",
];

describe("A1 — graphe d'imports du worker (jsdom interdit)", () => {
    it("la marche atteint bien les siphons d'arrière-plan (sinon le garde ne garde rien)", () => {
        expect(GRAPH.files.size).toBeGreaterThan(50);
        for (const siphon of [
            "src/lib/anomaly-boss-siphon.ts",
            "src/lib/bounty-siphon.ts",
            "src/lib/game-items-siphon.ts",
            "src/lib/market/referential-siphon.ts",
        ]) {
            expect(GRAPH.files.has(siphon), `${siphon} absent du graphe du worker`).toBe(true);
        }
    });

    it("jsdom n'est jamais atteint à l'évaluation (`ENOENT /browser/default-stylesheet.css`)", () => {
        // Le CŒUR des lectures DofusDB/Dofensive vit en `src/lib` : `@/lib/security` reste dehors.
        const offenders = GRAPH.edges
            .filter((edge) => edge.specifier === "@/lib/security")
            .map((edge) => `${edge.from} → ${edge.specifier}`);
        expect(offenders, "jsdom embarqué dans le worker : ENOENT une fois par item en production").toEqual([]);

        const npmSpecifiers = GRAPH.edges
            .map((edge) => edge.specifier)
            .filter((specifier) => /^(isomorphic-dompurify|jsdom)$/.test(specifier));
        expect(npmSpecifiers).toEqual([]);
    });

    it("les siphons d'arrière-plan n'importent aucune server action", () => {
        for (const siphon of ["src/lib/anomaly-boss-siphon.ts", "src/lib/bounty-siphon.ts"]) {
            const imports = GRAPH.edges
                .filter((edge) => edge.from === siphon && edge.specifier.startsWith("@/server/actions/"))
                .map((edge) => edge.specifier);
            expect(imports, `${siphon} : descendre le cœur en src/lib plutôt qu'importer une action`).toEqual([]);
        }
    });

    it("aucune autre arête src/lib → @/server non documentée", () => {
        expect(libToServerEdges()).toEqual(DOCUMENTED_LIB_TO_SERVER_EDGES);
    });
});

