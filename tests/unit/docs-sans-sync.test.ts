/**
 * Documentation — le Sync Catalogue Officiel n'existe plus.
 *
 * Décision user : la vérité documentaire vit en base (`DocPage`, éditée via
 * /god/docs). Plus aucun bouton, aucune action serveur, aucun script npm ni
 * seed ne peut écraser ou purger les fiches. Ce test verrouille la suppression
 * (fichiers absents + aucune référence dans le code, commentaires exclus).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const exists = (p: string) => existsSync(join(root, p));
/** Code seul, sans les commentaires (comme le verrou ⑧ de deploy-sortie-visible). */
const codeOnly = (source: string) =>
    source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/*"))
        .join("\n");

describe("docs — plus aucun Sync Catalogue Officiel", () => {
    it("les fichiers du sync ont disparu", () => {
        expect(exists("src/app/god/docs/_components/sync-docs-button.tsx")).toBe(false);
        expect(exists("prisma/seed-docs.ts")).toBe(false);
        expect(exists("prisma/seed-docs.js")).toBe(false);
    });

    it("aucune ligne de code n'appelle le sync ou le seed docs", () => {
        const watched = [
            "src/server/actions/doc-actions.ts",
            "src/app/god/docs/page.tsx",
            "package.json",
            "Dockerfile",
        ];
        for (const file of watched) {
            const code = codeOnly(read(file));
            expect(code, file).not.toContain("syncOfficialDocsAction");
            expect(code, file).not.toContain("SyncOfficialDocsButton");
            expect(code, file).not.toContain("seed-docs");
            expect(code, file).not.toContain("seed:docs");
        }
    });

    it("package.json n'a plus aucun script de seed docs", () => {
        const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
        expect(Object.keys(pkg.scripts).filter((s) => s.includes("docs"))).toEqual([]);
        expect(pkg.scripts["build:seeds"] ?? "").not.toContain("seed-docs");
    });

    it("la liste God ne propose que la création manuelle", () => {
        const page = read("src/app/god/docs/page.tsx");
        expect(page).toContain("/god/docs/new");
        expect(page).not.toContain("Sync");
    });
});
