/**
 * Images d'un contenu riche — **une seule** règle : tout upload passe par nos pipelines.
 *
 * Les trois chemins d'écriture d'image du site rendent un chemin **interne** :
 *  - `/api/upload` (docs, guides, assets — super-admin) ;
 *  - `uploadGuildImage` (étendard/photo de présentation) ;
 *  - `uploadProofImage` (preuves de prêt / coffre / kamas).
 *
 * Une URL **externe** (`https://…`), un `data:` (base64) ou un chemin protocol-relative
 * (`//hôte`) n'a donc aucune raison légitime dans un contenu éditable : c'est exactement
 * par là qu'un éditeur Markdown acceptait un import d'image **hors contrôle** (constat du
 * 30/10/2026 : coller une image ou saisir une URL dans le règlement de guilde).
 */

/** Préfixes rendus par nos pipelines d'upload (ou assets du dépôt). */
export const CONTROLLED_IMAGE_PREFIXES = ["/uploads/", "/images/", "/assets/", "/game-data/"] as const;

/**
 * Vrai si `src` désigne une image **contrôlée** : chemin interne servi par le site.
 * Tout le reste est refusé (fail-closed : valeur absente, vide, relative nue, `data:`,
 * `blob:`, `http(s)://`, `//hôte`, `javascript:`).
 */
export function isControlledImageSrc(src: unknown): boolean {
    if (typeof src !== "string") return false;
    const value = src.trim();
    if (!value || value.startsWith("//")) return false;
    return CONTROLLED_IMAGE_PREFIXES.some((prefix) => value.startsWith(prefix));
}
