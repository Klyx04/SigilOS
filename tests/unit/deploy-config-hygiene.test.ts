import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Garde d'hygiène du déploiement : **aucun secret vestige**.
 *
 * Constat du 24/10/2026 : `BETA_PASSWORD` était passé en `--build-arg` (CI), en `ARG`
 * (Dockerfile) et en variable d'environnement (compose) alors que **personne ne le
 * lisait** (`process.env.BETA_PASSWORD` = 0 occurrence, aucune auth Caddy). Un secret
 * qui ne protège rien ne fait qu'une chose : fuiter. Il a été retiré ; ce test empêche
 * son retour (ou celui d'un autre secret construit dans l'image).
 */
const FILES = ["Dockerfile", "docker-compose.prod.yml", ".github/workflows/deploy.yml"];

describe("hygiène du déploiement", () => {
    it("aucun BETA_PASSWORD dans la configuration de build/déploiement", () => {
        for (const file of FILES) {
            const content = readFileSync(file, "utf8");
            expect(content, `${file} contient encore BETA_PASSWORD`).not.toContain("BETA_PASSWORD");
        }
    });

    it("les build-args transmis à l'image servent tous à quelque chose", () => {
        // Chaque `--build-arg X` de la CI doit être déclaré dans le Dockerfile (ARG X).
        const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
        const dockerfile = readFileSync("Dockerfile", "utf8");
        const buildArgs = [...workflow.matchAll(/--build-arg\s+([A-Z0-9_]+)=/g)].map((match) => match[1]);
        expect(buildArgs.length).toBeGreaterThan(0);
        for (const arg of new Set(buildArgs)) {
            expect(dockerfile, `build-arg ${arg} non déclaré dans le Dockerfile`).toContain(`ARG ${arg}`);
        }
    });
});
