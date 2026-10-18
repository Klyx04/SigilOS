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
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { GET as dofusbookImage } from "@/app/api/dofusbook/proxy/[id]/image/route";

const ROUTES = [
    "src/app/api/dofusbook/proxy/[id]/image/route.ts",
    "src/app/api/storage/[...path]/route.ts",
];

const ROOT = process.cwd();

/** Toutes les sources TypeScript du dossier `src/`. */
function fichiersSource(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...fichiersSource(full));
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

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

/**
 * 2ᵉ famille (mesurée le 07/10/2026 sur la bêta après deploy) : un échec **non fatal** loggé
 * en `logger.error` (⇒ Issue Sentry) et un avertissement de **process Node** émis par le
 * runtime de Next sur une URL qui n'existe pas.
 */
describe("faux positifs Sentry — cas non fatal & bruit de process", () => {
    it("④ aucune source ne logge un échec « non-fatal » en `logger.error`", () => {
        const fautifs: string[] = [];
        for (const file of fichiersSource(path.join(ROOT, "src"))) {
            readFileSync(file, "utf8")
                .split("\n")
                .forEach((line, index) => {
                    if (/non-fatal/i.test(line) && /logger\.error\(/.test(line)) {
                        fautifs.push(`${path.relative(ROOT, file)}:${index + 1}`);
                    }
                });
        }
        expect(fautifs).toEqual([]);
    });

    it("⑤ le bruit de process du runtime Next est filtré, explicitement et avec sa mesure", () => {
        const source = readFileSync("src/lib/sentry-ignores.ts", "utf8");
        expect(source).toMatch(/SERVER_IGNORE_ERRORS/);
        expect(source).toMatch(/\/MaxListenersExceededWarning\//);
        // La décision doit rester motivée par la mesure : volume + URL fantôme.
        expect(source).toMatch(/113 événements en/);
        // 🔒 Source unique : les trois runtimes la consomment, aucune liste locale.
        for (const file of ["sentry.server.config.ts", "sentry.edge.config.ts", "src/instrumentation-client.ts"]) {
            expect(readFileSync(file, "utf8"), file).toContain("sentry-ignores");
        }
    });

    it("⑥ le bruit de **décalage de build** (onglet ouvert pendant un déploiement) est filtré aussi", () => {
        // Mesure du 11/10/2026 : 65 `UnrecognizedActionError` en 24 h côté navigateur — puis
        // **1 870 + 369** en 3 h une fois le problème regardé en face : le filtre ne vivait
        // que dans la config **client**, or `onRequestError = captureRequestError` remonte
        // l'erreur **côté serveur** ⇒ le filtre doit être partagé.
        const source = readFileSync("src/lib/sentry-ignores.ts", "utf8");
        expect(source).toMatch(/ignoreErrors|COMMON_IGNORE_ERRORS/);
        expect(source).toMatch(/\/UnrecognizedActionError\//);
        // La décision reste motivée par la mesure (volume + cause), jamais « pour faire taire ».
        expect(source).toMatch(/65 événements en 24 h/);
        expect(source).toMatch(/1 870/);
    });

    it("⑧ un amont externe en échec (DofusDB, Metamob) n'est loggé qu'en `warn`", () => {
        // Mesure du 18/10/2026 — deux Issues **neuves** sur la bêta, même famille : un cas
        // DÉJÀ géré (repli local / liste vide) journalisé en `error`, donc transformé en Issue
        // par `captureConsoleIntegration({ levels: ["error"] })` :
        //   · `JAVASCRIPT-NEXTJS-1Q` — `[getDungeonMonsters]` (`DofusDB search failed`),
        //     3 événements sur `GET /boss/comte-et-klime` ;
        //   · `JAVASCRIPT-NEXTJS-1P` — `[getGuildKralamoureEvents]` (« Accès refusé : Ce
        //     compte Metamob est privé. »), 1 événement sur `POST …/quete-ocre`.
        const sites = [
            { file: "src/server/actions/game-data-actions.ts", marker: "[getDungeonMonsters]" },
            { file: "src/server/actions/ocre-actions.ts", marker: "[getGuildKralamoureEvents]" },
            // 18/10/2026, troisième occurrence de la même famille (widget d'échanges
            // d'archimonstres, `POST …/members/<pseudo>`) : compte Metamob non authentifié.
            { file: "src/server/actions/ocre-actions.ts", marker: "[getProfileMatchingArchis]" },
        ];

        for (const { file, marker } of sites) {
            const source = readFileSync(file, "utf8");
            const lignes = source.split("\n").filter((line) => line.includes(marker));
            expect(lignes.length, file).toBeGreaterThan(0);
            for (const ligne of lignes) {
                expect(ligne, `${file} → ${ligne.trim()}`).not.toMatch(/logger\.error\(/);
            }
            // Le repli reste **rendu** (jamais un throw) : l'écran dégrade sans casser.
            expect(source, file).toContain("logger.warn(");
        }
    });

    it("⑨ la couche MetaMob ne journalise plus un amont en échec en `console.error`", () => {
        // Mesure du 18/10/2026 — `JAVASCRIPT-NEXTJS-1S` : `TypeError: fetch failed`
        // (`connect ETIMEDOUT 172.67.169.207:443` / `ENETUNREACH` IPv6 vers Cloudflare) sur
        // `GET /dashboard/<guildId>`. Le catch DÉGRADE (cache Redis, `null`, liste vide) ou
        // lève une erreur typée — ce n'est pas un défaut du produit. Deux `console.error`
        // suffisaient à créer une Issue ; il y en avait même un **doublon** avec le
        // `console.warn("Silent fail…")` juste après.
        const source = readFileSync("src/lib/metamob-client.ts", "utf8");
        expect(source).not.toMatch(/console\.error\(/);
        // Le vrai signal (format d'API changé) reste en `error`, une seule fois.
        expect(source).toContain('logger.error("[Metamob] Format de réponse API inattendu"');
        // Et l'amont indisponible est dit en `warn`, une ligne par branche.
        expect(source).toMatch(/logger\.warn\(`\[Metamob\] Amont indisponible/);
    });

    it("⑦ une image pas encore siphonnée ne devient plus une Issue serveur", () => {
        // Mesure du 11/10/2026 (Sentry) : 12 issues `⨯ The requested resource isn't a valid
        // image for /game-data/monsters/<slug>.webp received null`, ~64 événements chacune,
        // culprit `GET /_next/image`. Les fichiers sont **absents du disque** (mesuré :
        // `public/game-data/monsters` = 63 fichiers) ⇒ cas normal, pas une panne produit.
        const source = readFileSync("src/lib/sentry-ignores.ts", "utf8");
        expect(source).toMatch(/isn't a valid image/);
        expect(source).toMatch(/fuji-givrefoux\.webp/);
    });
});
