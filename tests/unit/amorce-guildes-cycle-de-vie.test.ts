/**
 * Anti-hallucination — **chaque chemin cité par l'amorce existe**.
 *
 * 📌 `docs/plans/AMORCE-GUILDES-CYCLE-DE-VIE.md` énumère ce qui reste à décider sur le cycle de vie
 * d'une guilde. Un plan qui cite un fichier renommé ou supprimé devient un pointeur mort : ce verrou
 * relit l'amorce et **vérifie l'existence** de chaque chemin `src/…`, `services/…`, `prisma/…`,
 * `tests/…`, `docs/…` qu'elle mentionne.
 *
 * Il ne juge pas le contenu (une affirmation peut être périmée), il garantit que la **preuve
 * annexée** pointe vers quelque chose de réel — la double vérification reste dans l'Annexe A.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const AMORCE = "docs/plans/AMORCE-GUILDES-CYCLE-DE-VIE.md";

const markdown = fs.readFileSync(path.join(REPO_ROOT, AMORCE), "utf8");

/** Chemins cités, entre backticks, éventuellement suffixés d'un `:ligne`. */
function citedPaths(): string[] {
    const matches = markdown.match(/(?:src|services|prisma|tests|docs)\/[A-Za-z0-9_./[\]-]+/g) ?? [];
    return [...new Set(matches.map((raw) => raw.replace(/:\d+$/, "").replace(/[.,;:]$/, "")))];
}

describe("amorce « cycle de vie d'une guilde »", () => {
    it("cite des chemins, et ils sont tous réels", () => {
        const paths = citedPaths();
        expect(paths.length).toBeGreaterThan(10);

        const missing = paths.filter((rel) => !fs.existsSync(path.join(REPO_ROOT, rel)));
        expect(missing, `chemins cités introuvables : ${missing.join(", ")}`).toEqual([]);
    });

    it("couvre les cinq décisions et les trois lots faisables", () => {
        for (const id of ["D-A", "D-B", "D-C", "D-D", "D-E"]) {
            expect(markdown).toContain(`**${id}**`);
        }
        for (const lot of ["Lot 4.1", "Lot 4.2", "Lot 4.3"]) {
            expect(markdown).toContain(lot);
        }
    });

    it("garde l'annexe de preuves (c'est elle qui empêche d'affirmer sans mesurer)", () => {
        expect(markdown).toContain("## Annexe A — Preuves");
        expect(markdown).toContain("## Annexe B — Glossaire");
    });
});
