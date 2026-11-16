/**
 * Source maps Sentry — verrou du **build livré** (mesure du 16/11/2026).
 *
 * Constat : le workflow passait bien `SENTRY_AUTH_TOKEN` en `--build-arg`, mais le
 * Dockerfile ne l'exposait **jamais** au `RUN npm run build` (`ARG` sans `ENV` ni
 * montage). Le plugin Sentry ne créait donc aucune release et n'uploadait aucune
 * source map : les stacks restaient minifiées.
 *
 * La correction passe par un **secret BuildKit** (`--mount=type=secret`) : il est
 * visible uniquement pendant le `RUN` de build, jamais dans une couche, le cache
 * (`mode=max`) ou l'image livrée. Ce test interdit le retour au `--build-arg`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const DOCKERFILE = "Dockerfile";
const DEPLOY = ".github/workflows/deploy.yml";
const NEXT_CONFIG = "next.config.ts";

describe("Source maps Sentry — le jeton atteint réellement `next build`", () => {
    it("le Dockerfile monte le secret sur le RUN de build, pas en variable persistante", () => {
        const dockerfile = read(DOCKERFILE);

        expect(dockerfile).toMatch(/RUN --mount=type=secret,id=sentry_auth_token,required=false/);
        expect(dockerfile).toMatch(/SENTRY_AUTH_TOKEN="\$\(cat \/run\/secrets\/sentry_auth_token\)"/);

        // Le secret ne doit jamais devenir une variable de l'image (couche/cache).
        expect(dockerfile).not.toMatch(/^ARG SENTRY_AUTH_TOKEN\s*$/m);
        expect(dockerfile).not.toMatch(/^ENV SENTRY_AUTH_TOKEN=/m);
    });

    it("le secret est monté sur le RUN qui construit Next, pas sur un autre", () => {
        const dockerfile = read(DOCKERFILE);
        const start = dockerfile.indexOf("RUN --mount=type=secret,id=sentry_auth_token");
        const end = dockerfile.indexOf("# Build seeds", start);
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        expect(dockerfile.slice(start, end)).toContain("npm run build");
    });

    it("le workflow passe un `--secret`, jamais un `--build-arg` pour ce jeton", () => {
        const deploy = read(DEPLOY);

        expect(deploy).toContain("--secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN");
        expect(deploy).not.toContain("--build-arg SENTRY_AUTH_TOKEN");
        // La variable doit être exportée dans l'environnement du step pour `env=`.
        expect(deploy).toMatch(/SENTRY_AUTH_TOKEN:\s*\$\{\{\s*secrets\.SENTRY_AUTH_TOKEN\s*\}\}/);
    });

    it("la config Sentry uploade puis supprime les source maps", () => {
        const nextConfig = read(NEXT_CONFIG);

        expect(nextConfig).toContain("widenClientFileUpload: true");
        expect(nextConfig).toContain("deleteSourcemapsAfterUpload: true");
    });
});
