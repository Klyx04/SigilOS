/**
 * Nettoyage des textes libres du Marché (§16.4 — anti-phishing / anti-slop).
 *
 * **Fonction pure**, partagée par les server actions (`market-actions`,
 * `market-admin-actions`) et par les interactions Discord : la règle de
 * nettoyage n'existe qu'**une fois** (§13.4), et un module pur ne peut pas
 * importer un module `"use server"` — d'où cet emplacement.
 *
 * Retire les liens (anti-phishing), compacte les espaces et renvoie `null`
 * quand il ne reste rien : jamais une chaîne vide en base (§0.1).
 */
export function sanitizeMarketText(value: string | null | undefined): string | null {
    if (!value) return null;
    const cleaned = value
        .replace(/https?:\/\/\S+/gi, "[lien retiré]")
        .replace(/\bdiscord\.gg\/\S+/gi, "[invitation retirée]")
        .replace(/\s{3,}/g, "  ")
        .trim();
    return cleaned.length > 0 ? cleaned : null;
}
