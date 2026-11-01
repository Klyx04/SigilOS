/**
 * 🔧 Paquet `services/discord-bot` — contrat de build.
 *
 * Deux pièges mesurés le 25/10/2026 :
 *  1. `moduleResolution: "node"` est **déprécié** (l'éditeur le peint en rouge) ;
 *  2. en passant à `bundler`, `tsc` **ne copie plus** le miroir `.mjs` dans `dist/` → le bot
 *     démarre puis meurt en `ERR_MODULE_NOT_FOUND` (mesuré : `dist/` ne contenait que
 *     `index.js`). Le build le copie donc **explicitement**.
 *
 * Ce test verrouille les deux points, et la présence des types du miroir.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const TSCONFIG = "services/discord-bot/tsconfig.json";
const PACKAGE = "services/discord-bot/package.json";

describe("build du bot Discord", () => {
    it("n'utilise pas la résolution dépréciée `node`", () => {
        const tsconfig = readFileSync(TSCONFIG, "utf8");
        expect(tsconfig).not.toContain('"moduleResolution": "node"');
        expect(tsconfig).toContain('"module": "ESNext"');
        expect(tsconfig).toContain('"moduleResolution": "bundler"');
    });

    it("copie explicitement le miroir `.mjs` dans `dist/` (sinon le bot ne démarre pas)", () => {
        const pkg = JSON.parse(readFileSync(PACKAGE, "utf8")) as { scripts?: Record<string, string> };
        const build = pkg.scripts?.build ?? "";
        expect(build).toContain("tsc");
        expect(build).toContain("copyFileSync('ticket-name.mjs'");
    });

    it("déclare les types du miroir (sinon l'import serait `any`)", () => {
        const types = readFileSync("services/discord-bot/ticket-name.d.mts", "utf8");
        expect(types).toContain("renameTicketChannelName");
        expect(types).toContain("slugifyTicketName");
    });
});

/**
 * LG-4 — règle de plafond **partagée** avec le site (`src/lib/guild-limit.ts`).
 *
 * L'image du bot ne contient pas `src/` : la règle est donc copiée dans le paquet au build. Une
 * seule source est versionnée ; la copie est un artefact (ignorée par git et par le contexte Docker,
 * comme `dist/`). Sans le `prebuild`, un clone neuf échouerait sur un import absent.
 */
describe("règle de plafond partagée avec le site", () => {
    it("le build copie `src/lib/guild-limit.ts` dans le paquet", () => {
        const pkg = JSON.parse(readFileSync(PACKAGE, "utf8")) as { scripts?: Record<string, string> };
        const sync = pkg.scripts?.["sync:shared"] ?? "";

        expect(sync).toContain("../../src/lib/guild-limit.ts");
        expect(sync).toContain("shared/guild-limit.ts");
        expect(pkg.scripts?.prebuild).toContain("sync:shared");
        expect(pkg.scripts?.predev).toContain("sync:shared");
    });

    it("la copie locale est ignorée par git et par le contexte Docker", () => {
        expect(readFileSync(".gitignore", "utf8")).toContain("/services/discord-bot/shared/");
        expect(readFileSync(".dockerignore", "utf8")).toContain("services/discord-bot/shared");
    });

    it("l'image copie la source, jamais une copie de poste de travail", () => {
        const dockerfile = readFileSync("services/discord-bot/Dockerfile", "utf8");
        expect(dockerfile).toContain("COPY src/lib/guild-limit.ts ./shared/guild-limit.ts");
    });
});

