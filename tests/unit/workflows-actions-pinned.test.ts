/**
 * Garde de chaîne d'outils (lecture source) — **actions CI épinglées** (F2, 20/09/2026).
 *
 * 🎯 Le risque : chaque `uses:` en **étiquette mobile** (`@v7`) confie le pipeline à du
 * code que l'amont peut redéployer sur ce tag. `deploy.yml` porte `packages: write` :
 * une action détournée fabrique une **image de production piégée**. Consensus 3/3 des
 * audits du 20/09/2026 (S-01 · cline CYB-10 · opus CYB-07 · muse-spark CMP-02).
 *
 * 🛡️ Ce que ce test verrouille :
 *  - **toute** action — first-party (`actions/*`) comprise — est épinglée sur un SHA de
 *    commit complet **avec** son tag en commentaire (`@<sha40> # vX`) : sans ce
 *    commentaire, Dependabot ne suit plus l'action et le pin se périmerait en silence ;
 *  - aucune étiquette mobile ne revient (`@v7`, `@main`, `@master`, `@latest`) ;
 *  - le build de production garde **provenance + SBOM** sur ses 4 images.
 *
 * ⚠️ Les valeurs de SHA ne sont **pas** figées ici (Dependabot les fait bouger) : on
 * verrouille la **forme**, pas la version. Test en lecture seule (aucun import
 * applicatif, aucun réseau) ; il échoue **bruyamment** si l'extraction ne trouve rien.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const WORKFLOWS = [
    ".github/workflows/deploy.yml",
    ".github/workflows/verify.yml",
] as const;

const DEPLOY = ".github/workflows/deploy.yml";

/** Lignes `uses:` d'un workflow, telles qu'écrites (mapping `uses:` ou item `- uses:`). */
function usesLines(workflow: string): string[] {
    return readFileSync(workflow, "utf8")
        .split(/\r?\n/)
        .filter((line) => /^\s*(-\s*)?uses:\s*\S/.test(line));
}

/** Référence seule (`owner/action@ref`), commentaire de version exclu. */
function referenceOf(line: string): string {
    return line.slice(line.indexOf("uses:") + "uses:".length).split("#")[0].trim();
}

describe("Actions GitHub — épinglage par SHA (F2)", () => {
    it("l'extraction couvre bien les 2 workflows (garde non inopérante)", () => {
        const counts = WORKFLOWS.map((workflow) => usesLines(workflow).length);
        expect(counts[0], "deploy.yml : 4 `uses:` attendus").toBeGreaterThanOrEqual(4);
        expect(counts[1], "verify.yml : 10 `uses:` attendus").toBeGreaterThanOrEqual(10);
        const all = WORKFLOWS.flatMap((workflow) => usesLines(workflow)).join("\n");
        expect(all, "au moins une action first-party").toMatch(/actions\//);
        expect(all, "au moins une action tierce").toMatch(/dorny\/|gitleaks\/|semgrep\/|aquasecurity\//);
    });

    it("aucune action n'est appelée par une étiquette mobile", () => {
        for (const workflow of WORKFLOWS) {
            for (const line of usesLines(workflow)) {
                const reference = referenceOf(line);
                expect(
                    reference,
                    `${workflow} : étiquette mobile → ${line.trim()}`,
                ).toMatch(/@[0-9a-f]{40}$/);
                expect(reference, `${workflow} : tag flottant → ${line.trim()}`).not.toMatch(
                    /@(v?\d+(\.\d+)*|main|master|latest|HEAD)$/,
                );
            }
        }
    });

    it("chaque pin garde son tag en commentaire (suivi Dependabot)", () => {
        for (const workflow of WORKFLOWS) {
            for (const line of usesLines(workflow)) {
                expect(line, `${workflow} : pin sans « # vX » → ${line.trim()}`).toMatch(
                    /@[0-9a-f]{40}\s+#\s*v[\d.]+/,
                );
            }
        }
    });

    it("le build de production garde provenance + SBOM sur chaque image", () => {
        const source = readFileSync(DEPLOY, "utf8");
        const builds = source
            .split(/\r?\n/)
            .filter((line) => line.includes("buildx build"));
        expect(builds.length, "au moins un `buildx build` (sinon garde inopérante)").toBeGreaterThanOrEqual(1);
        for (const line of builds) {
            expect(line, `build sans provenance → ${line.trim()}`).toContain("--provenance=true");
            expect(line, `build sans SBOM → ${line.trim()}`).toContain("--sbom=true");
        }
    });
});
