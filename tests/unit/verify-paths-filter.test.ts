/**
 * Garde de chaîne d'outils (lecture source) — **filtre « doc-only » de `verify.yml`**
 * (mesure et correctif du 30/09/2026).
 *
 * 🎯 Le risque : le quantificateur par défaut de `dorny/paths-filter` est `some`, où
 * chaque motif est évalué **indépendamment** (`patterns.some(rule => rule.isMatch(file))`,
 * `src/filter.ts` de l'action épinglée). Le positif `**` matche donc **tout** fichier et
 * chaque négation (`!docs/**`, `!**.md`…) devient **inerte** — un `!` ne réduit jamais un
 * résultat positif, il ne fait qu'en ajouter. Mesuré le 30/09/2026 (sonde locale sur 18
 * fichiers, dont une PR 100 % documentaire) : **18/18 → `true`** ⇒ `verify` payait
 * ~8 min de `next build` + tests sur un diff de documentation seule, alors que le filtre
 * était justement censé l'éviter (il n'évitait rien).
 *
 * 🛡️ Ce que ce test verrouille (la **forme**, pas une version — même approche que
 * `workflows-actions-pinned.test.ts`) :
 *  - `predicate-quantifier` est **explicite** et vaut `some-with-excludes` : c'est lui,
 *    et lui seul, qui rend les exclusions effectives (« an exclusion is final ») ;
 *  - le filtre garde **au moins un motif positif** — un filtre de seules négations ne
 *    matche jamais rien, donc `verify` ne tournerait plus jamais — et `**` en fait
 *    partie : tout fichier hors liste doit continuer à construire ;
 *  - chaque chemin **doc/config** reste nié (sinon la CI se rallume pour rien) ;
 *  - aucun motif dupliqué : `!**.md` couvre **déjà** les sous-dossiers (mesuré) — un
 *    second motif « tous les .md » (`!` + `**` + `/*.md`) serait un doublon mort ;
 *  - `verify` reste **gouverné** par `needs.filter.outputs.should_run == 'true'`, et le
 *    workflow ne revient pas à `paths:`/`paths-ignore:` sur `on:` (décision documentée
 *    dans l'en-tête du fichier : un check requis doit **toujours** être rapporté).
 *
 * ⚠️ Test en lecture seule (aucun import applicatif, aucun réseau, **aucun import de
 * `picomatch`** : il n'est que transitif dans `node_modules`). Il échoue **bruyamment**
 * si l'extraction ne trouve rien, pour ne jamais passer au vert en ne lisant rien.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const VERIFY = ".github/workflows/verify.yml";

/** Chemin doc/config à ne **jamais** laisser déclencher la CI. */
const EXCLUDED = [
    "!**.md",
    "!.gitignore",
    "!LICENSE",
    "!docs/**",
    "!.gemini/**",
    "!scripts/*.sh",
    "!scripts/*.md",
] as const;

function lines(): string[] {
    return readFileSync(VERIFY, "utf8").split(/\r?\n/);
}

/** Indentation (nombre d'espaces) d'une ligne. */
function indentOf(line: string): number {
    return /^(\s*)/.exec(line)?.[1].length ?? 0;
}

/** Lignes du step `dorny/paths-filter` (borné par le `- ` suivant de même indentation). */
function filterStepLines(): string[] {
    const source = lines();
    const start = source.findIndex((line) => /^\s*-?\s*uses:\s*dorny\/paths-filter@/.test(line));
    expect(start, "step `dorny/paths-filter` introuvable dans verify.yml").toBeGreaterThan(-1);
    const rest = source.slice(start + 1);
    const stop = rest.findIndex(
        (line) => /^\s*-\s/.test(line) && indentOf(line) <= indentOf(source[start]),
    );
    return [source[start], ...(stop === -1 ? rest : rest.slice(0, stop))];
}

/** Valeur de `predicate-quantifier` dans le step du filtre (`undefined` si absente). */
function quantifier(): string | undefined {
    const line = filterStepLines().find((candidate) => /predicate-quantifier\s*:/.test(candidate));
    return /predicate-quantifier\s*:\s*['"]?([a-z-]+)/.exec(line ?? "")?.[1];
}

/** Motifs du bloc scalaire `filters: |`, dans l'ordre écrit. */
function filterPatterns(): string[] {
    const step = filterStepLines();
    const marker = step.findIndex((line) => /^\s*filters:\s*\|/.test(line));
    expect(marker, "bloc `filters: |` introuvable dans le step du filtre").toBeGreaterThan(-1);
    const patterns: string[] = [];
    for (const line of step.slice(marker + 1)) {
        if (line.trim() !== "" && indentOf(line) <= indentOf(step[marker])) break;
        const match = /^\s*-\s*'([^']+)'\s*$/.exec(line);
        if (match) patterns.push(match[1]);
    }
    return patterns;
}

describe("Filtre « doc-only » de verify.yml (dorny/paths-filter)", () => {
    it("l'extraction est non inopérante (quantificateur et motifs)", () => {
        expect(quantifier(), "`predicate-quantifier` introuvable").toBeDefined();
        expect(
            filterPatterns().length,
            "motifs attendus écrits `- '…'` (guillemets obligatoires en YAML pour `*` et `!`)",
        ).toBeGreaterThanOrEqual(EXCLUDED.length + 1);
    });

    it("le quantificateur est explicite et sépare inclusions et exclusions", () => {
        // Avec le défaut (`some`), le positif `**` matche tout et les `!` sont inertes :
        // le filtre ne filtre rien (mesuré : 18/18 fichiers → `true`).
        expect(quantifier()).toBe("some-with-excludes");
    });

    it("le filtre garde `**` en positif (hors liste, tout doit construire)", () => {
        const positives = filterPatterns().filter((pattern) => !pattern.startsWith("!"));
        expect(positives, "aucun motif positif ⇒ le filtre ne matcherait jamais rien").toContain(
            "**",
        );
    });

    it("chaque chemin doc/config reste exclu", () => {
        const patterns = filterPatterns();
        for (const pattern of EXCLUDED) {
            expect(patterns, `${pattern} manque : la CI se rallumerait pour ce chemin`).toContain(
                pattern,
            );
        }
    });

    it("aucun motif dupliqué (`!**.md` couvre déjà les sous-dossiers)", () => {
        const patterns = filterPatterns();
        expect(new Set(patterns).size, `doublon dans ${JSON.stringify(patterns)}`).toBe(
            patterns.length,
        );
    });

    it("verify reste gouverné par le filtre (`should_run == 'true'`)", () => {
        expect(readFileSync(VERIFY, "utf8")).toContain("needs.filter.outputs.should_run == 'true'");
    });

    it("le déclenchement ne repasse pas par `paths`/`paths-ignore`", () => {
        const source = lines();
        const start = source.findIndex((line) => /^on:/.test(line));
        const jobs = source.findIndex((line) => /^jobs:/.test(line));
        expect(start, "clé `on:` introuvable").toBeGreaterThan(-1);
        expect(
            source.slice(start, jobs === -1 ? source.length : jobs).join("\n"),
            "un check requis bloqué en « Expected » ne serait plus jamais rapporté",
        ).not.toMatch(/^\s*paths(-ignore)?:/m);
    });
});
