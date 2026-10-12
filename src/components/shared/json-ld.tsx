/**
 * Composant JsonLd — rend un bloc JSON-LD (schema.org) directement dans le HTML servi.
 *
 * Pourquoi un `<script>` rendu par le serveur et non `next/script` : `next/script`
 * injecte la balise côté client, après hydratation. Relevé d'audit (16/09/2026) :
 * 0 balise `ld+json` dans la réponse du serveur, 1 seule dans le DOM après JS.
 * Googlebot exécute le JS et voyait donc le balisage, mais tout ce qui lit la
 * source (Bing, aperçus de partage, outils d'audit SEO) ne voyait rien. Le JSON-LD
 * n'est pas du JavaScript exécutable : le rendu direct est la recommandation
 * Next.js et rend le balisage lisible par tous les consommateurs.
 *
 * Sécurité : les données passées ici sont des objets JS contrôlés côté serveur
 * (metadata, config, contenu éditorial), sérialisés en JSON via JSON.stringify.
 * Il ne s'agit JAMAIS de HTML brut issu d'input utilisateur, donc pas de risque XSS.
 *
 * Le nosemgrep est justifié : cette encapsulation centralise l'usage de
 * dangerouslySetInnerHTML pour tout le JSON-LD du projet et évite de le
 * répéter non-audité dans chaque page.
 */
export function JsonLd({
    id,
    data,
    nonce,
}: {
    id: string;
    data: unknown;
    nonce?: string;
}) {
    return (
        <script
            id={id}
            type="application/ld+json"
            nonce={nonce}
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
        />
    );
}