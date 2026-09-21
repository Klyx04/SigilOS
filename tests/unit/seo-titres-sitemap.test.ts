import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getGuildSlug, getIndexableGuildSegment } from "@/lib/presentation-constants";

/**
 * SEO — non-régression des correctifs du 21/09/2026 (constat Search Console) :
 *  1. plus de marque en double dans les titres (« … | SigilOS | SigilOS ») ;
 *  2. le sitemap publie le segment de guilde qui RÉSOUT (plus de redirection) ;
 *  3. l'almanax n'inonde plus le sitemap de 30 dates futures ;
 *  4. `/maintenance` n'est plus indexable (le proxy la sert en 200 sur toutes les URL).
 */

const codeOf = (p: string) => readFileSync(p, "utf8");
const countOf = (code: string, re: RegExp) => (code.match(re) ?? []).length;

const SITEMAP = "src/app/sitemap.ts";
const MAINTENANCE = "src/app/maintenance/page.tsx";
const LAYOUT = "src/app/layout.tsx";

/**
 * Pages dont le titre porte DÉJÀ la marque : elles doivent passer leur titre en
 * `title: { absolute: … }`, sinon le template unique du layout racine l'ajoute une 2ᵉ fois.
 * La valeur = nombre de titres à protéger dans le fichier.
 */
const TITRES_ABSOLUS: Record<string, number> = {
    "src/app/boss/page.tsx": 1,
    "src/app/boss/[dungeonId]/page.tsx": 3,
    "src/app/almanax/page.tsx": 1,
    "src/app/almanax/[date]/page.tsx": 1,
    "src/app/modules/page.tsx": 1,
    "src/app/guides/rush-sylvestre/page.tsx": 1,
    "src/app/guilds/page.tsx": 1,
    "src/app/guilds/[guildId]/page.tsx": 3,
    "src/app/carte-du-monde/page.tsx": 1,
    "src/app/status/page.tsx": 1,
    "src/app/legal/cgu/page.tsx": 1,
    "src/app/legal/faq/page.tsx": 1,
    "src/app/legal/mentions/page.tsx": 1,
    "src/app/legal/privacy/page.tsx": 1,
};

describe("titres de page — la marque n'est plus doublée", () => {
    it("le layout racine reste la SEULE source du template « | SigilOS »", () => {
        expect(codeOf(LAYOUT)).toMatch(/template: "%s \| SigilOS"/);
        for (const page of Object.keys(TITRES_ABSOLUS)) {
            expect(codeOf(page)).not.toMatch(/template:\s*"%s/);
        }
    });

    for (const [page, attendus] of Object.entries(TITRES_ABSOLUS)) {
        it(`${page} protège ${attendus} titre(s) en absolute`, () => {
            expect(countOf(codeOf(page), /absolute:/g)).toBeGreaterThanOrEqual(attendus);
        });
    }
});

describe("sitemap — segment de guilde indexable", () => {
    it("un nom ASCII simple se publie en slug (résolution garantie)", () => {
        expect(getIndexableGuildSegment({ name: "Stellium", discordGuildId: "1290442961380835451" })).toBe("stellium");
        expect(getIndexableGuildSegment({ name: "Les Veilleurs", discordGuildId: "1" })).toBe("les-veilleurs");
    });

    it("un nom accentué retombe sur l'identifiant (le slug 404erait)", () => {
        const guild = { name: "Étoile du Nord", discordGuildId: "42" };
        expect(getGuildSlug(guild)).toBe("etoile-du-nord"); // slug trompeur…
        expect(getIndexableGuildSegment(guild)).toBe("42"); // …jamais publié
    });

    it("un nom avec ponctuation perdue retombe aussi sur l'identifiant", () => {
        expect(getIndexableGuildSegment({ name: "Guilde 2026 !", discordGuildId: "7" })).toBe("7");
        expect(getIndexableGuildSegment({ name: "Les Veilleurs d'Amakna", discordGuildId: "8" })).toBe("8");
    });

    it("sans nom, l'identifiant fait foi (jamais de chaîne vide)", () => {
        expect(getIndexableGuildSegment({ name: null, discordGuildId: "9" })).toBe("9");
        expect(getIndexableGuildSegment({ name: "", discordGuildId: "9" })).toBe("9");
    });

    it("le sitemap utilise ce helper (plus de snowflake nu) et borne l'almanax à 7 jours", () => {
        const code = codeOf(SITEMAP);
        expect(code).toMatch(/getIndexableGuildSegment/);
        expect(code).not.toMatch(/\/guilds\/\$\{guild\.discordGuildId\}/);
        expect(code).toMatch(/almanaxItems\.slice\(0, ALMANAX_SITEMAP_DAYS\)/);
        expect(code).toMatch(/const ALMANAX_SITEMAP_DAYS = 7;/);
    });
});

describe("maintenance — page non indexable", () => {
    it("déclare robots noindex/nofollow", () => {
        const code = codeOf(MAINTENANCE);
        expect(code).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    });
});
