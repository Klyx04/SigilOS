/**
 * Extraits SERP — non-régression du 20/10/2026.
 *
 * Mesure (export Search Console de la bêta, 01/08 → 17/10/2026 : 6 156 impressions, 109 clics) :
 *  - **fiches boss** : 1 715 impressions → **4 clics** (0,23 %) avec un titre de **91 caractères** ;
 *  - **`/almanax`** : 479 impressions → **1 clic** (0,21 %), requête « almanax du jour » à 202 impressions ;
 *  - **guides** : 2 368 impressions → **48 clics** (44 % des clics du site) pour 2,6 % des pages.
 *
 * Google n'affiche qu'~60 caractères de titre et ~155 de description. Au-delà, c'est l'argument de
 * la page qui est coupé — précisément la partie qui fait cliquer. Ces gardes empêchent le retour
 * des gabarits trop longs.
 *
 * Le périmètre est **FR uniquement** : c'est la seule propriété dont on a la mesure. Les titres EN
 * (traductions) restent à borner dans un lot dédié, quand une mesure EN existera.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    SERP_DESCRIPTION_MAX_LENGTH,
    SERP_TITLE_MAX_LENGTH,
    clampSerpDescription,
    composeSerpTitle,
    truncateAtWord,
} from "@/lib/seo";
import { getPublishedGuides } from "@/content/guides";
import { fr } from "@/lib/i18n/locales/fr";

/** Ce que le template du layout racine ajoute à un titre qui n'est pas en `absolute`. */
const BRAND_SUFFIX = " | SigilOS";

describe("truncateAtWord", () => {
    it("ne coupe jamais un mot en deux", () => {
        expect(truncateAtWord("Avis de recherche Roub Ignolles niveau 40", 20)).toBe("Avis de recherche");
    });

    it("retire la ponctuation pendante laissée par la coupe", () => {
        expect(truncateAtWord("Sorts, portées, résistances et butin", 16)).toBe("Sorts, portées");
    });

    it("laisse intact un texte qui tient, en normalisant les espaces", () => {
        expect(truncateAtWord("  Roub   Ignolles  ", 60)).toBe("Roub Ignolles");
    });
});

describe("composeSerpTitle", () => {
    it("garde nom, niveau et qualificatif quand tout tient", () => {
        expect(composeSerpTitle("Roub' Ignolles", "(Niv. 40)", "avis de recherche")).toBe(
            "Roub' Ignolles (Niv. 40) — avis de recherche",
        );
    });

    it("sacrifie le qualificatif avant le nom (le nom est la requête)", () => {
        const name = "Comte et Missiz Frizz de la Chambre des Maléfices";
        expect(composeSerpTitle(name, "(Niv. 200)", "sorts, portées, résistances")).toBe(`${name} (Niv. 200)`);
    });

    it("tombe sur le nom seul, coupé sur un mot entier, quand même le niveau ne tient pas", () => {
        const name = "Protecteurs du Sanctuaire des Jardins Éternels de la Reine Écarlate";
        const title = composeSerpTitle(name, "(Niv. 200)", "sorts");
        expect(title.length).toBeLessThanOrEqual(SERP_TITLE_MAX_LENGTH);
        expect(name.startsWith(title)).toBe(true);
        // Le dernier caractère n'est pas une coupe au milieu d'un mot : il est suivi d'un espace.
        expect(name.includes(`${title} `)).toBe(true);
    });

    it("ne dépasse jamais la limite sur un échantillon de noms réels", () => {
        const names = [
            "Roub' Ignolles",
            "Comte Harebourg",
            "Comte et Missiz Frizz",
            "Protecteurs du Sanctuaire",
            "Chambre des Maléfices du Comte Harebourg",
            "Darma",
        ];
        for (const name of names) {
            expect(composeSerpTitle(name, "(Niv. 200)", "sorts, portées, résistances").length).toBeLessThanOrEqual(
                SERP_TITLE_MAX_LENGTH,
            );
        }
    });
});

describe("clampSerpDescription", () => {
    it("borne la description et coupe sur un mot", () => {
        const description = "Fiche tactique complète du boss et de sa salle. ".repeat(10);
        const out = clampSerpDescription(description);
        expect(out.length).toBeLessThanOrEqual(SERP_DESCRIPTION_MAX_LENGTH);
        expect(description.startsWith(out)).toBe(true);
    });
});

describe("fiches boss — plus de titre tronqué à 91 caractères", () => {
    const page = () => readFileSync("src/app/boss/[dungeonId]/page.tsx", "utf8");

    it("compose ses deux titres avec le borneur", () => {
        expect(page().match(/composeSerpTitle\(/g)?.length).toBe(2);
    });

    it("borne ses deux descriptions", () => {
        expect(page().match(/clampSerpDescription\(/g)?.length).toBe(2);
    });

    it("n'a plus les gabarits qui dépassaient la limite SERP", () => {
        expect(page()).not.toMatch(/Zone de traque & Simulation \| SigilOS/);
        expect(page()).not.toMatch(/Sorts, Portées & Stratégie \| SigilOS/);
    });

    it("ne préfixe plus le nom du donjon (« Donjon Donjon … »)", () => {
        // `dungeon.name` vaut déjà « Donjon du Comte Harebourg » : un préfixe « boss du donjon »
        // produisait la duplication en production (mesuré le 20/10/2026).
        expect(page()).not.toMatch(/boss du donjon \$\{dungeonLabel\}/);
        expect(page()).not.toMatch(/boss of \$\{dungeonLabel\}/);
    });
});

describe("guide Rush Sylvestre — extrait borné avant publication", () => {
    const page = () => readFileSync("src/app/guides/rush-sylvestre/page.tsx", "utf8");

    it("titre en `absolute` ≤ 60 caractères", () => {
        const title = page().match(/title: \{ absolute: "([^"]+)" \}/)?.[1] ?? "";
        expect(title.length).toBeGreaterThan(0);
        expect(title.length).toBeLessThanOrEqual(SERP_TITLE_MAX_LENGTH);
    });

    it("description ≤ 155 caractères", () => {
        const description = page().match(/description:\s*\n?\s*"([^"]+)"/)?.[1] ?? "";
        expect(description.length).toBeGreaterThan(0);
        expect(description.length).toBeLessThanOrEqual(SERP_DESCRIPTION_MAX_LENGTH);
    });
});

describe("almanax — hub collé à la requête mesurée", () => {
    it("titre ≤ 60 et portant l'expression « almanax du jour »", () => {
        expect(fr.almanaxPage.metaTitle.length).toBeLessThanOrEqual(SERP_TITLE_MAX_LENGTH);
        expect(fr.almanaxPage.metaTitle.toLowerCase()).toContain("almanax du jour");
    });

    it("description ≤ 155", () => {
        expect(fr.almanaxPage.metaDesc.length).toBeLessThanOrEqual(SERP_DESCRIPTION_MAX_LENGTH);
    });
});

describe("guides publiés — extraits dans les limites Google", () => {
    const guides = getPublishedGuides("fr");

    it("le registre n'est pas vide (le garde ne teste pas du vide)", () => {
        expect(guides.length).toBeGreaterThanOrEqual(7);
    });

    it("titre + « | SigilOS » ≤ 60 caractères", () => {
        const tooLong = guides
            .map((guide) => ({ slug: guide.slug, length: `${guide.title}${BRAND_SUFFIX}`.length }))
            .filter((guide) => guide.length > SERP_TITLE_MAX_LENGTH);
        expect(tooLong).toEqual([]);
    });

    it("description ≤ 155 caractères", () => {
        const tooLong = guides
            .map((guide) => ({ slug: guide.slug, length: guide.description.length }))
            .filter((guide) => guide.length > SERP_DESCRIPTION_MAX_LENGTH);
        expect(tooLong).toEqual([]);
    });
});
