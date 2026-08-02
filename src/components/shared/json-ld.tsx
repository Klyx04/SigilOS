import Script from "next/script";

/**
 * Composant JsonLd — injecte un bloc JSON-LD (schema.org) dans le <head>.
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
        <Script
            id={id}
            type="application/ld+json"
            nonce={nonce}
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}