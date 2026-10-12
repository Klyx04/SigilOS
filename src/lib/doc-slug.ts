/**
 * Slug d'une fiche de documentation — **jamais saisi à la main**.
 *
 * Demande user du 10/12/2026 : « je ne veux pas avoir à gérer des slug ou je ne sais quoi dans
 * la doc ». L'adresse se déduit donc du titre ; le serveur tranche les doublons.
 *
 * Règle **pure** (`src/lib/**`) : aucun accès base, testable seule.
 *
 * ⚠️ Distinct de `slugifyBossName` / `slugifyName` : ceux-là normalisent des noms de jeu
 * (boss, défis) avec leurs règles propres ; ici c'est un titre éditorial (« Audit Technique &
 * Gestion des Membres » → `audit-technique-gestion-des-membres`).
 */
export function docSlugFromTitle(title: string): string {
    return title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // « É » → « E », « ç » → « c »
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
        .replace(/-+$/g, ""); // la troncature ne doit pas laisser un tiret orphelin
}

/** Un titre 100 % ponctuation ne doit pas produire un slug vide (route `/docs/` cassée). */
export function docSlugOrFallback(title: string, fallback = "documentation"): string {
    return docSlugFromTitle(title) || fallback;
}
