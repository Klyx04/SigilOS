import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { formatGroupedInteger } from "@/lib/market/kamas";

/**
 * BUG-9 — `React error #418` (hydratation) constaté sur `/marche`.
 *
 * Cause **structurelle** identifiée : un composant client du Marché rendait
 * `quantity.toLocaleString("fr-FR")`, dont le séparateur de milliers dépend de
 * l'ICU (Node au rendu serveur vs navigateur à l'hydratation) ⇒ le texte différait
 * et React levait `#418`.
 *
 * Ce test fige les deux règles :
 *   1. le formatage passe par `formatGroupedInteger` (déterministe) ;
 *   2. **aucun** composant client du Marché n'utilise de valeur non déterministe
 *      au rendu (`toLocaleString`, `Date.now()`, `Math.random()`).
 */
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function collectClientFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...collectClientFiles(full));
        else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
    return files;
}

describe("🧪 Marché — hydratation déterministe (BUG-9)", () => {
    it("formate les quantités sans dépendre de l'ICU (même chaîne serveur / navigateur)", () => {
        expect(formatGroupedInteger(500)).toBe("500");
        expect(formatGroupedInteger(1000)).toBe(`1${"\u202F"}000`);
        expect(formatGroupedInteger(1_234_567)).toBe(`1${"\u202F"}234${"\u202F"}567`);
        expect(formatGroupedInteger(-2500)).toBe(`-2${"\u202F"}500`);
        // Deux appels successifs ⇒ exactement la même chaîne (aucun état global).
        expect(formatGroupedInteger(12345)).toBe(formatGroupedInteger(12345));
    });

    it("interdit les sources de rendu non déterministes dans les composants client du Marché", () => {
        const files = [
            ...collectClientFiles(path.join(PROJECT_ROOT, "src", "components", "market")),
            ...collectClientFiles(
                path.join(PROJECT_ROOT, "src", "app", "dashboard", "[guildId]", "marche")
            ),
        ];
        const offenders: string[] = [];
        for (const file of files) {
            const content = fs.readFileSync(file, "utf8");
            const relative = path.relative(PROJECT_ROOT, file);
            if (/\.toLocale(?:String|DateString|TimeString)\(/.test(content)) {
                offenders.push(`${relative} → toLocale*`);
            }
            if (/Date\.now\(\)/.test(content) || /Math\.random\(\)/.test(content)) {
                offenders.push(`${relative} → Date.now()/Math.random()`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
