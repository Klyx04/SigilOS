/**
 * Bundles esbuild et modules natifs — incident mesuré le 24/09/2026.
 *
 * `sharp` est un module **natif** : inliné par esbuild, `sharp/dist/sharp.mjs` appelle
 * `createRequire(import.meta.url)` — or en sortie CJS `import.meta.url` vaut `undefined` :
 *
 *   TypeError [ERR_INVALID_ARG_VALUE]: The argument 'filename' must be a file URL object,
 *   file URL string, or absolute path string. Received undefined
 *
 * Conséquence constatée en production : le worker (`dist/worker.js`, construit par
 * `npm run build:worker`) voyait ses passes **ITEMS / ANOMALY_BOSSES / BOUNTIES** échouer en
 * ~40 ms (3 tentatives BullMQ) alors que le même code marchait depuis l'app (Next garde
 * `sharp` externe). `build:siphon` externalisait déjà `sharp` — les 6 autres bundles avaient
 * oublié. Preuve de la cause : bundle 14,6 Mo → **1 Mo** et import OK après correction.
 *
 * Ce garde-fou verrouille la règle : **tout bundle esbuild externalise `sharp`**.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };

const bundlingScripts = Object.entries(pkg.scripts).filter(
    ([, cmd]) => cmd.includes("esbuild") && cmd.includes("--bundle"),
);

describe("bundles esbuild — modules natifs", () => {
    it("il y a bien des bundles à vérifier (sinon le garde ne garde rien)", () => {
        expect(bundlingScripts.length).toBeGreaterThanOrEqual(5);
    });

    it("chaque bundle externalise `sharp` (sinon il explose à l'exécution)", () => {
        for (const [name, cmd] of bundlingScripts) {
            expect(cmd, `script ${name} : --external:sharp manquant`).toContain("--external:sharp");
        }
    });

    it("le worker externalise aussi ses dépendances d'exécution (Prisma, Redis, BullMQ)", () => {
        const worker = pkg.scripts["build:worker"];
        expect(worker).toContain("--external:@prisma/client");
        expect(worker).toContain("--external:ioredis");
        expect(worker).toContain("--external:bullmq");
    });
});
