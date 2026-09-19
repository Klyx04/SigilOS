/**
 * Accès à la feuille de route publique — décision **pure** (testable en isolation).
 *
 * ⚠️ Historique : la condition exigeait aussi d'appartenir à une guilde. Un crawler
 * (Googlebot n'a ni session ni guilde) était donc **toujours** redirigé vers `/`
 * alors que `/roadmap` est annoncée dans le sitemap et autorisée dans robots.txt
 * ⇒ Search Console remontait « Page avec redirection » (constat du 19/09/2026).
 *
 * Règle : un super-admin voit toujours la page (prévisualisation avant activation) ;
 * sinon le toggle God `roadmapEnabled` fait foi — la page est publique, donc
 * indexable, dès qu'il est actif.
 */
export function canViewRoadmap(options: { isAdmin: boolean; roadmapEnabled: boolean }): boolean {
    return options.isAdmin || options.roadmapEnabled;
}
