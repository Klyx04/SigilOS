import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Garde-fou de la chaîne d'approvisionnement npm.
 *
 * Contexte : TensorLake (2026-10-08) et MALFEX (`tlxbnhd`, retiré le
 * 2026-09-22) exécutent du code à l'installation via `preinstall` / `install`
 * / `postinstall`. Le lockfile fige la version, pas le comportement : tout
 * nouveau paquet qui déclare un script d'installation doit être examiné.
 *
 * Le test exécute le script réel (pas une copie de sa logique) sur des
 * lockfiles temporaires, puis sur le `package-lock.json` du dépôt.
 *
 * Référence : docs/RULES.md § Sécurité de la chaîne d'outils.
 */
const scriptPath = fileURLToPath(
    new URL("../../scripts/check-install-scripts.mjs", import.meta.url),
);
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const tempDir = mkdtempSync(path.join(tmpdir(), "sigilos-install-scripts-"));

afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
});

function runWithLock(lock: unknown): { status: number; output: string } {
    const lockPath = path.join(tempDir, `lock-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(lockPath, JSON.stringify(lock), "utf8");
    try {
        const output = execFileSync("node", [scriptPath, "--lock", lockPath], {
            cwd: repoRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        return { status: 0, output };
    } catch (error) {
        const failure = error as { status?: number; stdout?: string; stderr?: string };
        return {
            status: failure.status ?? 1,
            output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
        };
    }
}

describe("scripts d'installation npm", () => {
    it("accepte un lock sans aucun script d'installation", () => {
        const result = runWithLock({
            lockfileVersion: 3,
            packages: {
                "": { name: "test" },
                "node_modules/sans-script": { version: "1.0.0" },
            },
        });

        expect(result.status).toBe(0);
        expect(result.output).toContain("0 paquet(s)");
    });

    it("refuse un paquet inconnu qui déclare un script d'installation", () => {
        const result = runWithLock({
            lockfileVersion: 3,
            packages: {
                "": { name: "test" },
                "node_modules/paquet-piege": {
                    version: "6.6.6",
                    hasInstallScript: true,
                },
            },
        });

        expect(result.status).toBe(1);
        expect(result.output).toContain("paquet-piege@6.6.6");
        expect(result.output).toContain("hors allowlist");
    });

    it("accepte un paquet justifié, y compris en chemin imbriqué ou scopé", () => {
        const result = runWithLock({
            lockfileVersion: 3,
            packages: {
                "": { name: "test" },
                "node_modules/@prisma/engines": {
                    version: "7.10.1",
                    hasInstallScript: true,
                },
                "node_modules/eslint/node_modules/unrs-resolver": {
                    version: "1.11.1",
                    hasInstallScript: true,
                },
            },
        });

        expect(result.status).toBe(0);
        expect(result.output).toContain("2 paquet(s)");
    });

    it("refuse un paquet scopé inconnu et affiche son nom complet", () => {
        const result = runWithLock({
            lockfileVersion: 3,
            packages: {
                "": { name: "test" },
                "node_modules/@scope/curieux": {
                    version: "0.0.1",
                    hasInstallScript: true,
                },
            },
        });

        expect(result.status).toBe(1);
        expect(result.output).toContain("@scope/curieux@0.0.1");
    });

    it("le lock du dépôt ne contient que des scripts d'installation justifiés", () => {
        const output = execFileSync("node", [scriptPath], {
            cwd: repoRoot,
            encoding: "utf8",
        });

        expect(output).toContain("tous justifiés dans l'allowlist");
    });
});
