/**
 * Nettoyage d'un libellé d'effet de combat (données Dofensive).
 *
 * 🐛 Mesure du 20/10/2026 (fiche du Comte Harebourg) : les descriptions contenaient des
 * **balises de variables de jeu** et s'affichaient telles quelles — par exemple
 * `Dommages Eau : 7% «<span name="erosion">PV manquants du lanceur`. On retire les balises
 * en **gardant leur contenu**, on décode les entités HTML, on tasse les espaces.
 *
 * Règle **pure** (aucune dépendance, aucun accès base/réseau) : utilisable au siphon comme
 * au rendu. Elle ne traduit ni ne réécrit jamais le sens de l'effet.
 */
export function cleanGameEffectText(value: unknown): string {
    if (typeof value !== "string") return "";

    const decoded = value
        // Balises de variables du client de jeu (`<span name="erosion">…</span>`).
        .replace(/<\/?span[^>]*>/gi, "")
        // Mise en forme résiduelle : le texte reste, la balise part.
        .replace(/<\/?(?:b|strong|i|em|u|br)\s*\/?>/gi, " ")
        // Entités HTML (le rendu React échappe ensuite le texte : aucun HTML ne repasse).
        .replace(/&nbsp;/gi, " ")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&amp;/gi, "&");

    return decoded.replace(/\s+/g, " ").trim();
}
