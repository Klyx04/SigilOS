import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * AUD-07 (audit 13/11/2026) — les deux fallbacks `curl` passaient l'URL dans une
 * commande shell (`exec`), où `$(...)` et les backticks restent interprétés même
 * entre guillemets. `execFile` prend un tableau d'arguments : aucun shell.
 */
const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("AUD-07 — pas de shell dans les fetch curl", () => {
    for (const rel of [
        "src/lib/feed-aggregators.ts",
        "src/app/api/resources/news/route.ts",
    ]) {
        it(`${rel} utilise execFile (argv), jamais exec interpolé`, () => {
            const src = read(rel);
            expect(src).not.toMatch(/import\s*\{\s*exec\s*\}/);
            expect(src).not.toMatch(/promisify\(exec\)/);
            expect(src).not.toMatch(/`curl\s/);
            expect(src).toMatch(/execFile/);
        });
    }
});
