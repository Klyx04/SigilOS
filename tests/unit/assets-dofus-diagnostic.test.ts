/**
 * Garde — un échec de téléchargement d'asset n'est **plus muet**.
 *
 * Mesure du 09/11/2026 (bêta) : TOUS les sprites `?sprite=1` renvoyaient le placeholder 1×1
 * (118 octets) alors que `api.dofusdb.fr/img/monsters/<n>.png` répondait 200 avec ~20 Ko.
 * Le `catch` de la route avalait la cause : impossible de distinguer un refus SSRF, un DNS
 * mort, un `sharp` cassé ou un budget épuisé. La route doit nommer l'échec avant de replier.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROUTE = "src/app/api/assets-dofus/[type]/[id]/route.ts";

describe("proxy /api/assets-dofus — diagnostic d'un échec de téléchargement", () => {
    const src = readFileSync(path.join(process.cwd(), ROUTE), "utf8");

    it("logge la cause avant de renvoyer le placeholder", () => {
        expect(src).toContain("logger.warn");
        expect(src).toContain("téléchargement du sprite impossible");
        // La cause réelle est transmise (String(error)), pas un message générique.
        expect(src).toContain("error: String(error)");
    });

    it("le placeholder reste un PNG 1×1 transparent et non-cacheable", () => {
        expect(src).toContain("X-SigilOS-Placeholder");
        expect(src).toContain("'Cache-Control': 'no-store'");
    });
});
