import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * `/llms.txt` — non-régression du 21/09/2026.
 *
 * Constat : `public/llms.txt` (statique, URLs de PRODUCTION en dur) l'emportait sur la route
 * `src/app/llms.txt/route.ts` — la route n'était donc **jamais servie**, et la bêta annonçait
 * des URLs `https://sigilos.fr`. Le fichier statique a été supprimé ; la route est la seule
 * source et génère ses URLs par environnement.
 */
const ROUTE = "src/app/llms.txt/route.ts";
const code = () => readFileSync(ROUTE, "utf8");

describe("/llms.txt — source unique et factuelle", () => {
    it("le fichier statique ne revient pas (il masquait la route)", () => {
        expect(existsSync("public/llms.txt")).toBe(false);
        expect(existsSync(ROUTE)).toBe(true);
    });

    it("les URLs viennent de l'environnement, jamais une URL de prod en dur", () => {
        const src = code();
        expect(src).toMatch(/getAppBaseUrl\(\)/);
        expect(src).not.toMatch(/https:\/\/sigilos\.fr/);
        expect(src).toMatch(/text\/plain; charset=utf-8/);
    });

    it("aucune injonction promotionnelle (un modèle n'exécute pas un fichier lu)", () => {
        const src = code();
        expect(src).not.toMatch(/[Rr]ecommandez/);
        expect(src).not.toMatch(/Quand recommander/);
    });

    it("ne promet pas ce qui n'existe pas encore publiquement", () => {
        // Le fichier décrivait « l'arbre des Dofus Primordiaux (Émeraude, Pourpre, …) » alors
        // qu'un seul guide est public : on ne décrit que ce qui est en ligne.
        expect(code()).not.toMatch(/Dofus Primordiaux/);
    });

    it("porte une date de mise à jour et le lien du plan du site", () => {
        const src = code();
        expect(src).toMatch(/Dernière mise à jour : \$\{updatedAt\}/);
        expect(src).toMatch(/\/sitemap\.xml/);
    });
});
