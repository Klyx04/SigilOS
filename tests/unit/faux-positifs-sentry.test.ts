/**
 * Faux positifs Sentry — un cas **normal** ne doit jamais partir en `console.error`.
 *
 * Rappel du mécanisme (mesuré le 07/10/2026) : `sentry.server.config.ts` active
 * `captureConsoleIntegration({ levels: ["error"] })` ⇒ **tout `console.error` serveur devient
 * une Issue Sentry** (+ alerte Discord).
 *
 * Les deux dernières routes concernées :
 *  - `/api/dofusbook/proxy/[id]/image` : un amont en 404 (image inexistante) était loggé en
 *    `console.error` ⇒ une Issue **par image manquante** ;
 *  - `/api/storage/[...path]` : un fichier disparu entre l'`existsSync` et la lecture (course de
 *    déploiement) rendait **500 + Issue** au lieu d'un 404.
 *
 * 🔒 Ce que ce test verrouille : ① un amont 404 rend un 404 **sans** `console.error` ;
 * ② les deux routes passent par `logger` et n'appellent plus `console.*` ;
 * ③ `storage` distingue la course (404) de la vraie panne (signal Sentry conservé), sans
 * jamais journaliser de chemin.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

import { GET as dofusbookImage } from "@/app/api/dofusbook/proxy/[id]/image/route";

const ROUTES = [
    "src/app/api/dofusbook/proxy/[id]/image/route.ts",
    "src/app/api/storage/[...path]/route.ts",
];

/** Retire les commentaires : les explications citent `console.error` à dessein. */
function codeSeul(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("faux positifs Sentry — un cas normal n'est jamais loggé en error", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("① image absente côté Dofusbook (amont 404) → 404 propre, sans console.error", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

        const res = await dofusbookImage(
            {} as never,
            { params: Promise.resolve({ id: "12345" }) } as never
        );

        expect(res.status).toBe(404);
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("② les deux routes passent par `logger` et n'appellent plus `console.*`", () => {
        for (const rel of ROUTES) {
            const code = codeSeul(readFileSync(rel, "utf8"));
            expect(code, rel).not.toMatch(/\bconsole\s*\./);
            expect(code, rel).toContain('from "@/lib/logger"');
        }
    });

    it("③ storage : ENOENT ⇒ 404 (pas 500), vraie panne ⇒ signal conservé, aucun chemin loggé", () => {
        const source = readFileSync("src/app/api/storage/[...path]/route.ts", "utf8");
        expect(source).toMatch(/code === "ENOENT"/);
        expect(source).toMatch(/new Response\("Not Found", \{ status: 404 \}\)/);
        expect(source).toMatch(/logger\.error\("\[Storage API\]/);
        // Aucun chemin (donc aucun snowflake de guilde) ne part dans un log.
        expect(source).not.toMatch(/logger\.[a-z]+\([^)]*safePath/);
    });
});
