/**
 * Route `/api/uploads/[...path]` — **un asset absent n'est pas une erreur**.
 *
 * 🐛 Cause racine mesurée le 07/10/2026 (alertes Discord 17:40) : `sentry.server.config.ts`
 * active `captureConsoleIntegration({ levels: ["error"] })` ⇒ **tout `console.error` serveur
 * devient une Issue Sentry** (donc une alerte Discord). Or la route journalisait
 * `console.error` **trois fois par appel**, dont **un à chaque requête réussie** :
 *  ① `[uploads] Request: /api/uploads/<chemin>` (avant tout traitement) ;
 *  ② `[uploads] Resolved path: /app/public/…` (chemin **absolu**, fuite d'infra) ;
 *  ③ `Error: ENOENT: no such file or directory, stat` (l'asset n'est pas encore siphonné).
 * Résultat : une simple icône de sort manquante (`/uploads/assets-dofus/spells/sort_15534.webp`,
 * le navigateur bascule ensuite sur le proxy `/api/assets-dofus/*`) déclenchait 3 Issues Sentry.
 *
 * 🔒 Ce que ce test verrouille :
 *  ① un asset absent répond **404** sans un seul `console.error` (⇒ zéro Issue Sentry) ;
 *  ② le chemin heureux (fichier présent) est **totalement silencieux** (avant : 2 `console.error`) ;
 *  ③ une traversée de chemin reste **fail-closed** (403) ;
 *  ④ la source passe par `logger` (jamais `console.*`) et ne journalise **jamais** le chemin absolu.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { GET } from "@/app/api/uploads/[...path]/route";

const ROUTE_PATH = "src/app/api/uploads/[...path]/route.ts";

/** Fichier témoin sous `public/uploads/proofs/temp/` — dossier **gitignoré** : un résidu
 *  éventuel ne peut pas salir `git status`. */
const HAPPY_RELATIVE = "proofs/temp/__uploads-route-test__.png";

function req() {
    return new NextRequest("http://localhost/api/uploads/x.png");
}

/** `params` d'une route catch-all Next 16 : une promesse. */
function ctx(...segments: string[]) {
    return { params: Promise.resolve({ path: segments }) };
}

describe("route /api/uploads — un 404 d'asset ne devient jamais une Issue Sentry", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // `console.error` est le **vrai** déclencheur d'Issue Sentry (captureConsoleIntegration).
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("① asset non siphonné → 404, sans un seul console.error", async () => {
        const res = await GET(req(), ctx("assets-dofus", "spells", "sort_99999999.webp"));
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "Not found" });
        expect(errorSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled(); // ENOENT est attendu : pas une anomalie
    });

    it("② fichier présent → 200, et le chemin heureux ne journalise RIEN", async () => {
        const absolute = path.join(process.cwd(), "public", "uploads", ...HAPPY_RELATIVE.split("/"));
        mkdirSync(path.dirname(absolute), { recursive: true });
        writeFileSync(absolute, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        try {
            const res = await GET(req(), ctx(...HAPPY_RELATIVE.split("/")));
            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toBe("image/png");
            expect(errorSpy).not.toHaveBeenCalled();
            expect(warnSpy).not.toHaveBeenCalled();
            expect(logSpy).not.toHaveBeenCalled();
        } finally {
            rmSync(absolute, { force: true });
        }
    });

    it("③ traversée de chemin → 403 fail-closed, sans bruit Sentry", async () => {
        const res = await GET(req(), ctx("..", "..", "..", "etc", "passwd.png"));
        expect(res.status).toBe(403);
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("④ extension non servie → 404 (ni disque, ni log)", async () => {
        const res = await GET(req(), ctx("private_uploads", "dump.sql"));
        expect(res.status).toBe(404);
        expect(errorSpy).not.toHaveBeenCalled();
        expect(logSpy).not.toHaveBeenCalled();
    });

    it("⑤ la source passe par `logger` (jamais un appel `console.*`) sans divulguer de chemin absolu", () => {
        const source = readFileSync(ROUTE_PATH, "utf8");
        // On compare le **code** : les commentaires d'explication citent `console.error` à dessein.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        expect(code).not.toMatch(/\bconsole\s*\./);
        expect(code).toContain('from "@/lib/logger"');
        expect(code).toMatch(/logger\.debug\(/); // miss normal
        expect(code).toMatch(/logger\.warn\(/); // anomalie réelle
        expect(code).not.toMatch(/logger\.error\(/); // jamais : ce serait une Issue Sentry
        // Le chemin résolu (`/app/public/…`) ne doit jamais entrer dans un log.
        expect(source).not.toMatch(/logger\.[a-z]+\([^)]*resolvedPath/);
    });
});
