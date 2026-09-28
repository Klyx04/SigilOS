import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    ALMANAX_SOURCE_WINDOW_DAYS,
    almanaxWindowLastDay,
    clampLastModified,
    isServableAlmanaxDay,
} from "@/lib/seo";
import { getPublishedGuides } from "@/content/guides";

/**
 * Indexation honnête — mesures du 29/09/2026 (`curl`, avant correctif) :
 *  1. `sitemap.xml` publiait un `<lastmod>` **futur** (`/guides/raid-gigalodon-dofus-guide` et
 *     `…-sanctuaire-…` annoncés au 02/10 alors que le sitemap était généré le 29/09) ;
 *  2. `/almanax/1999-01-01`, `/almanax/2030-01-01`, `/almanax/2026-11-15` répondaient
 *     **200 `index, follow`** avec « Donnée temporairement indisponible » (la source ne sert que
 *     30 jours et **ignore** `range[date]` : le passé n'existe pas) ;
 *  3. `/guides/rush-sylvestre` était **publié dans le sitemap ET en `noindex`** (toggle God
 *     « Mode Construction » actif) — contradiction remontée par Search Console.
 */
const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

const SITEMAP = readSource("src/app/sitemap.ts");
const ALMANAX_PAGE = readSource("src/app/almanax/[date]/page.tsx");

describe("clampLastModified — jamais de `lastmod` dans le futur", () => {
    const now = new Date("2026-09-29T12:00:00.000Z");

    it("ramène une date future à l'instant de génération", () => {
        expect(clampLastModified(new Date("2026-10-02T00:00:00.000Z"), now).toISOString()).toBe(now.toISOString());
    });

    it("conserve une date passée telle quelle", () => {
        const past = new Date("2026-08-27T00:00:00.000Z");
        expect(clampLastModified(past, now).toISOString()).toBe(past.toISOString());
    });

    it("ne publie jamais « Invalid Date » (donnée absente ou illisible)", () => {
        expect(clampLastModified(new Date("pas-une-date"), now).toISOString()).toBe(now.toISOString());
    });

    it("le sitemap plafonne ses 3 blocs datés (guildes, guides, boss)", () => {
        expect((SITEMAP.match(/clampLastModified\(/g) ?? []).length).toBe(3);
        expect(SITEMAP).not.toMatch(/lastModified: new Date\(guide\.updatedAt\)/);
        expect(SITEMAP).not.toMatch(/lastModified: guild\.updatedAt \?\? new Date\(\)/);
        expect(SITEMAP).not.toMatch(/lastModified: d\.updatedAt \?\? now/);
    });
});

describe("registre des guides — des dates réelles, dans les deux langues", () => {
    it("publication ≤ modification ≤ aujourd'hui", () => {
        const today = new Date().toISOString().slice(0, 10);
        for (const locale of ["fr", "en"] as const) {
            for (const guide of getPublishedGuides(locale)) {
                const label = `${locale}/${guide.slug}`;
                expect(guide.updatedAt >= guide.publishedAt, `${label} : modifié avant publication`).toBe(true);
                expect(guide.updatedAt <= today, `${label} : date de modification dans le futur`).toBe(true);
            }
        }
    });
});

describe("sitemap — le guide Sylvestre suit son toggle (une seule source de vérité)", () => {
    it("l'URL n'est plus publiée en dur dans les routes statiques", () => {
        expect((SITEMAP.match(/url: `\$\{baseUrl\}\/guides\/rush-sylvestre`/g) ?? []).length).toBe(1);
    });

    it("elle n'est publiée que si le chantier est terminé, et fail-closed sinon", () => {
        expect(SITEMAP).toMatch(/db\.optimizedGuide\.findUnique\(\{/);
        expect(SITEMAP).toMatch(/select: \{ isUnderConstruction: true \}/);
        expect(SITEMAP).toMatch(/if \(rushGuide && !rushGuide\.isUnderConstruction\) \{/);
        expect(SITEMAP).toMatch(/logger\.error\("\[Sitemap\] Error fetching rush guide state"/);
    });
});

describe("almanax — on ne sert que les jours que la source connaît", () => {
    const noon = new Date("2026-09-29T12:00:00.000Z"); // 14:00 à Paris

    it("fenêtre = jour civil Paris → +29 jours", () => {
        expect(ALMANAX_SOURCE_WINDOW_DAYS).toBe(30);
        expect(almanaxWindowLastDay("2026-09-29")).toBe("2026-10-28");
        expect(isServableAlmanaxDay("2026-09-29", noon)).toBe(true);
        expect(isServableAlmanaxDay("2026-10-28", noon)).toBe(true);
        expect(isServableAlmanaxDay("2026-10-29", noon)).toBe(false);
    });

    it("passé, dates lointaines et formes invalides : non servis (404, plus de coquille vide)", () => {
        for (const day of ["2026-09-28", "2026-11-15", "2030-01-01", "1999-01-01", "pas-une-date"]) {
            expect(isServableAlmanaxDay(day, noon), day).toBe(false);
        }
    });

    it("le jour civil est celui de Paris, pas celui du serveur (UTC)", () => {
        const lateUtc = new Date("2026-09-28T23:30:00.000Z"); // 29/09 01:30 à Paris
        expect(isServableAlmanaxDay("2026-09-29", lateUtc)).toBe(true);
        expect(isServableAlmanaxDay("2026-09-28", lateUtc)).toBe(false);
    });

    it("la page applique le garde et n'offre pas une page vide à l'index", () => {
        expect(ALMANAX_PAGE).toMatch(/if \(!isServableAlmanaxDay\(date\)\) notFound\(\);/);
        expect(ALMANAX_PAGE).toMatch(
            /robots: item \? \{ index: true, follow: true \} : \{ index: false, follow: true \},/,
        );
    });
});
