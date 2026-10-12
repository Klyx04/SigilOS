/**
 * Garde de dérive **seed ↔ assets** — tout `iconUrl` du seed doit **exister** sur le disque.
 *
 * 🐛 Constat du 12/10/2026 : le dossier `public/game-data/achievements` ne portait que **28**
 * fichiers (les challenges classiques) là où les fiches affichaient davantage de succès ⇒ des
 * `404` silencieux et des cases vides, sans qu'aucun test ne le voie. La donnée est souveraine :
 * ce que le seed écrit en base doit être **servi**.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SEED = "prisma/seed-data/game-data.json";

function collectAssetPaths(node: unknown, out = new Set<string>()): Set<string> {
    if (typeof node === "string") {
        if (node.startsWith("/game-data/")) out.add(node);
        return out;
    }
    if (Array.isArray(node)) {
        for (const item of node) collectAssetPaths(item, out);
        return out;
    }
    if (node && typeof node === "object") {
        for (const value of Object.values(node as Record<string, unknown>)) collectAssetPaths(value, out);
    }
    return out;
}

describe("seed → assets : chaque icône référencée existe dans `public/`", () => {
    const paths = [...collectAssetPaths(JSON.parse(readFileSync(SEED, "utf8")))].sort();

    it("au moins une référence est trouvée (sinon le verrou ne prouve rien)", () => {
        expect(paths.length).toBeGreaterThan(0);
    });

    it("aucune référence morte", () => {
        const missing = paths.filter((p) => !existsSync(join(process.cwd(), "public", decodeURIComponent(p))));
        expect(missing, `icônes du seed absentes de public/ : ${missing.join(", ")}`).toEqual([]);
    });
});
