import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * SEO — contrat de la vitrine prod `sigilos.fr` (constat mesuré le 24/09/2026).
 *
 * Ce qui était réellement servi AVANT correctif (curl, pas supposé) :
 *  - `https://sigilos.fr/robots.txt` → 200 `text/html` (la vitrine elle-même) ;
 *  - `https://sigilos.fr/sitemap.xml` → 200 `text/html`, alors que le robots.txt statique
 *    l'annonçait comme sitemap ⇒ « Impossible de récupérer le sitemap » dans Search Console ;
 *  - `<meta name="robots" content="index, follow">` sur la vitrine : le domaine de marque
 *    s'auto-déclarait indexable alors que la bêta est la seule propriété qui travaille
 *    (`docs/plans/SEO_REPRISE.md` § « À ne PAS faire — garder les 2 domaines indexés ») ;
 *  - cause racine du retard : le compose monte UN fichier de config Caddy, dont l'inode est
 *    figé à la création du conteneur ⇒ `deploy-cd.sh` doit comparer les empreintes et recréer
 *    le proxy (2ᵉ incident du même type : 23/08/2026 puis 04/09/2026).
 */

const caddyfile = () => readFileSync("Caddyfile", "utf8");
const vitrine = () => readFileSync("public/maintenance.html", "utf8");
const deployCd = () => readFileSync("scripts/deploy-cd.sh", "utf8");

/**
 * Extrait le bloc d'un site du Caddyfile. Les accolades internes sont indentées : le premier
 * `\n}` en colonne 0 ferme donc bien le bloc du site.
 */
function siteBlock(site: "sigilos.fr" | "beta.sigilos.fr"): string {
    const code = caddyfile();
    const start = code.indexOf(`\n${site} {`);
    expect(start, `bloc « ${site} » introuvable dans le Caddyfile`).toBeGreaterThan(-1);
    const end = code.indexOf("\n}", start);
    expect(end, `bloc « ${site} » non refermé dans le Caddyfile`).toBeGreaterThan(start);
    return code.slice(start, end);
}

/** Supprime les lignes de commentaire (les commentaires citent parfois la forme fautive). */
const sansCommentaires = (src: string) =>
    src
        .split("\n")
        .filter((line) => !line.trim().startsWith("#"))
        .join("\n");

describe("vitrine sigilos.fr — hors index pendant la bêta", () => {
    it("le bloc sigilos.fr désindexe tout le domaine", () => {
        expect(siteBlock("sigilos.fr")).toMatch(/header X-Robots-Tag "noindex, nofollow"/);
    });

    it("la bêta reste indexable (aucun noindex global sur son bloc)", () => {
        expect(siteBlock("beta.sigilos.fr")).not.toMatch(/X-Robots-Tag "noindex/);
    });

    it("robots.txt ne renvoie plus un sitemap qui n'existe pas", () => {
        const block = siteBlock("sigilos.fr");
        expect(block).not.toMatch(/Sitemap: https:\/\/sigilos\.fr\/sitemap\.xml/);
        expect(block).toMatch(/Content-Type text\/plain/);
    });

    it("robots.txt est un vrai fichier multi-lignes (heredoc, pas de `\\n` littéral)", () => {
        // On ignore les commentaires : l'avertissement lui-même cite la forme fautive.
        const block = sansCommentaires(siteBlock("sigilos.fr"));
        // Mesuré le 24/09/2026 : `respond "…\n…"` est servi LITTÉRALEMENT par Caddy (une seule
        // ligne, `\n` visibles) ⇒ robots.txt illisible pour Google. Seul un heredoc produit de
        // vrais retours à la ligne. Ce test interdit le retour de la forme fautive.
        expect(block).toMatch(/respond <<ROBOTS/);
        expect(block).toMatch(/\nUser-agent: \*/);
        expect(block).toMatch(/\nROBOTS 200/);
        expect(block).not.toMatch(/respond "[^"]*\\n/);
    });

    it("sitemap.xml répond un vrai 404 (plus de HTML déguisé en XML)", () => {
        expect(siteBlock("sigilos.fr")).toMatch(/handle \/sitemap\.xml \{\s*respond 404\s*\}/);
    });

    it("la page d'attente ne dit plus « indexe-moi »", () => {
        const html = vitrine();
        expect(html).toMatch(/<meta name="robots" content="noindex, nofollow">/);
        expect(html).not.toMatch(/name="robots" content="index, follow/);
    });
});

describe("déploiement — le proxy ne peut plus rester en retard en silence", () => {
    it("compare l'empreinte du Caddyfile du dépôt à celle vue par le conteneur", () => {
        const code = deployCd();
        expect(code).toMatch(/caddy_config_check\(\)/);
        expect(code).toMatch(/md5sum Caddyfile/);
        expect(code).toMatch(/md5sum \/etc\/caddy\/Caddyfile/);
    });

    it("valide la config AVANT de recréer le proxy", () => {
        const code = deployCd();
        const validate = code.indexOf("caddy validate --config");
        const recreate = code.indexOf("--force-recreate --no-deps caddy", validate);
        expect(validate).toBeGreaterThan(-1);
        expect(recreate).toBeGreaterThan(validate);
    });

    it("contrôle ce qui est réellement servi (robots.txt + sitemap.xml)", () => {
        const code = deployCd();
        expect(code).toMatch(/seo_check\(\)/);
        expect(code).toMatch(/\/robots\.txt/);
        expect(code).toMatch(/\/sitemap\.xml/);
    });

    it("les deux contrôles sont appelés par un déploiement", () => {
        const code = deployCd();
        expect(code).toMatch(/caddy_config_check "\$ENV_FILE"/);
        expect(code).toMatch(/seo_check "\$URL"/);
    });
});
