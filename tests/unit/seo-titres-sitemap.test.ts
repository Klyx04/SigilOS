import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getGuildSlug, getIndexableGuildSegment } from "@/lib/presentation-constants";
import { resolveAppBaseUrl } from "@/lib/utils";

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

describe("sitemap — les dates de modification sont honnêtes", () => {
    it("aucune route statique ne publie `lastModified` (plus de `new Date()` par requête)", () => {
        const src = codeOf(SITEMAP);
        const start = src.indexOf("const staticRoutes");
        const end = src.indexOf("];", start);
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);

        // Ces 15 routes n'ont pas de date de modification connue : publier `now` faisait croire à
        // Google qu'elles changeaient à chaque passage du robot (constat 21/09 puis 24/09/2026).
        expect(src.slice(start, end)).not.toMatch(/lastModified/);

        // Le reste du sitemap continue de publier des dates VRAIES (registre des guides, base).
        expect(src).toMatch(/lastModified: new Date\(guide\.updatedAt\)/);
        expect(src).toMatch(/lastModified: guild\.updatedAt/);
    });
});

describe("origine publique — la configuration, jamais l'en-tête `Host`", () => {
    it("priorité : NEXT_PUBLIC_APP_URL > NEXTAUTH_URL > repli prod", () => {
        expect(resolveAppBaseUrl({
            NEXT_PUBLIC_APP_URL: "https://exemple.test",
            NEXTAUTH_URL: "https://beta.sigilos.fr",
        })).toEqual({ url: "https://exemple.test", configured: true });

        expect(resolveAppBaseUrl({ NEXTAUTH_URL: "https://beta.sigilos.fr" }))
            .toEqual({ url: "https://beta.sigilos.fr", configured: true });

        // Tout autre environnement (préprod, test) est pris tel quel : c'est ce qui évite qu'un
        // site annexe publie des canonical vers sigilos.fr.
        expect(resolveAppBaseUrl({ NEXTAUTH_URL: "https://preprod.exemple.test" }))
            .toEqual({ url: "https://preprod.exemple.test", configured: true });

        // Aucune configuration : dernier recours explicite, signalé par un `warn` (plus de silence).
        expect(resolveAppBaseUrl({})).toEqual({ url: "https://sigilos.fr", configured: false });
    });

    it("une valeur vide (espaces) n'est pas une configuration", () => {
        expect(resolveAppBaseUrl({ NEXT_PUBLIC_APP_URL: "   " }).configured).toBe(false);
        expect(resolveAppBaseUrl({ NEXTAUTH_URL: "  " }).configured).toBe(false);
    });

    it("`utils.ts` ne lit jamais l'en-tête entrant `Host`", () => {
        expect(codeOf("src/lib/utils.ts")).not.toMatch(/next\/headers|headers\(\)/);
    });
});

describe("maintenance — page non indexable", () => {
    it("déclare robots noindex/nofollow", () => {
        const code = codeOf(MAINTENANCE);
        expect(code).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    });
});
