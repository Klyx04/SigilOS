import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Invariants des correctifs de la 2ᵉ passe (13/11/2026) :
 *  - #1 `/api/uploads` : confinement par séparateur ;
 *  - #3 SSRF : règle IP partagée (plus de liste locale) ;
 *  - #7 `/api/god/cron-status` : plus de chemin machine en dur ;
 *  - #8 routes God d'images : rate-limit présent.
 */
const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("correctifs 2ᵉ passe — invariants", () => {
    it("/api/uploads utilise la racine + séparateur", () => {
        const src = read("src/app/api/uploads/[...path]/route.ts");
        expect(src).toMatch(/UPLOAD_ROOT_WITH_SEP/);
        expect(src).not.toMatch(/!resolvedPath\.startsWith\(UPLOAD_ROOT\)\s*\)/);
    });

    it("/api/proxy-image et image-downloader passent par la connexion sûre", () => {
        for (const rel of ["src/app/api/proxy-image/route.ts", "src/lib/image-downloader.ts"]) {
            const src = read(rel);
            expect(src, rel).toMatch(/from ["']@\/lib\/safe-fetch["']/);
            expect(src, rel).not.toMatch(/await fetch\(/);
        }
    });

    it("les autres téléchargements d'URL externe passent aussi par safeFetch", () => {
        for (const rel of [
            "src/server/actions/dofusbook-actions.ts",
            "src/server/actions/skin-actions.ts",
            "src/app/api/assets-dofus/[type]/[id]/route.ts",
        ]) {
            const src = read(rel);
            expect(src, rel).toMatch(/from ["']@\/lib\/safe-fetch["']/);
            expect(src, rel).not.toMatch(/assertSafeUrl/);
        }
    });

    it("/api/god/cron-status ne contient plus de chemin machine", () => {
        const src = read("src/app/api/god/cron-status/route.ts");
        expect(src).not.toMatch(/\/home\/sigiladmin/);
        expect(src).toMatch(/CRON_LOG_DIR/);
    });

    it("les routes God d'images sont rate-limitées", () => {
        for (const rel of [
            "src/app/api/god/upload-image/route.ts",
            "src/app/api/god/download-image/route.ts",
        ]) {
            expect(read(rel), rel).toMatch(/rateLimit\(/);
        }
    });
});
