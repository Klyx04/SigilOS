/**
 * Garde — **souveraineté des visuels** : aucun écran ne doit faire appeler `api.dofusdb.fr`
 * par le navigateur du joueur.
 *
 * 🐛 Constat user du 12/10/2026 (onglet Réseau de la bêta) : les cartes d'archimonstres du volet
 * de zone chargeaient `https://api.dofusdb.fr/img/monsters/117.png` **en direct** — hotlink,
 * IP du joueur exposée à un tiers, et dépendance à un service qu'on ne maîtrise pas. Le dépôt
 * possédait déjà la règle de proxy interne (`internalDofusDbImageUrl`) : elle n'était branchée
 * qu'à trois endroits. Ces tests verrouillent les points de **publication** (actions serveur).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { internalDofusDbImageUrl } from "@/lib/dofus-image-url";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf-8");

describe("internalDofusDbImageUrl — la règle de proxy", () => {
    it("convertit une URL d'image DofusDB en route interne", () => {
        expect(internalDofusDbImageUrl("https://api.dofusdb.fr/img/monsters/117.png")).toMatch(
            /^\/api\/assets-dofus\/monsters\/117/
        );
        expect(internalDofusDbImageUrl("https://api.dofusdb.fr/img/items/11756.png")).toMatch(
            /^\/api\/assets-dofus\/items\/11756/
        );
    });

    it("ne touche ni un asset local ni une URL déjà interne (repli de l'appelant)", () => {
        expect(internalDofusDbImageUrl("/game-data/monsters/117.webp")).toBeNull();
        expect(internalDofusDbImageUrl("/api/assets-dofus/monsters/117")).toBeNull();
        expect(internalDofusDbImageUrl(null)).toBeNull();
    });
});

describe("les visuels sont publiés par le proxy, jamais en hotlink", () => {
    it("archimonstres (2 mappeurs) + avis de recherche — game-data-actions", () => {
        const src = read("src/server/actions/game-data-actions.ts");
        // Les URL DofusDB brutes ne sont plus publiées telles quelles.
        expect(src).not.toContain("imageUrl: a.imageUrl,");
        expect(src).not.toContain("imageUrl: b.imageUrl,");
        const wrapped = src.match(/imageUrl: internalDofusDbImageUrl\(/g) ?? [];
        expect(wrapped.length).toBeGreaterThanOrEqual(3);
    });

    it("archimonstres du volet de zone — ocre-actions", () => {
        const src = read("src/server/actions/ocre-actions.ts");
        expect(src).toContain("image: internalDofusDbImageUrl(a.imageUrl)");
    });
});
