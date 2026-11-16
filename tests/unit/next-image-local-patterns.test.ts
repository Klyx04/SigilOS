/**
 * `next/image` — verrou Sentry **2W** : « Image with src "/api/assets-dofus/monsters/687?
 * url=…&sprite=1" is using a query string which is not configured in images.localPatterns ».
 *
 * Next 16 applique par défaut `localPatterns: [{ pathname: "**", search: "" }]`, qui refuse
 * **toute** query string sur une image locale. Le proxy interne d'assets Dofus en porte deux
 * (`url`, `sprite`) : il faut donc un pattern dédié **sans `search`** (dans le code de Next,
 * un `search` absent saute la comparaison, donc toutes les query passent).
 *
 * Le second pattern conserve le comportement par défaut pour tout le reste : aucune query.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

describe("next/image — localPatterns du proxy d'assets Dofus", () => {
    it("déclare `localPatterns` explicitement", () => {
        expect(CONFIG).toMatch(/images:\s*\{[\s\S]*?localPatterns:/);
    });

    it("autorise toutes les query du proxy interne (aucun `search` sur ce pattern)", () => {
        // Le bloc doit être exactement `{ pathname: "/api/assets-dofus/**" }` : un
        // `search: ""` réintroduirait le refus des query et donc le crash SSR.
        expect(CONFIG).toMatch(/\{\s*pathname:\s*"\/api\/assets-dofus\/\*\*"\s*\}/);
    });

    it("garde le comportement par défaut pour les autres images locales", () => {
        expect(CONFIG).toMatch(/\{\s*pathname:\s*"\/\*\*",\s*search:\s*""\s*\}/);
    });
});
