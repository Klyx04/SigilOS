/**
 * Résout l'icône d'un succès DofusDB depuis les assets locaux.
 * Priorité : iconUrl API > asset local slug > null
 */
export function getAchievementIconUrl(slug: string | null | undefined, apiIconUrl?: string | null): string | null {
    // Asset local — nommé d'après le slug (ex: duo.png, statue.png)
    if (slug) {
        return `/game-data/achievements/${slug}.png`;
    }
    // Fallback API si slug absent
    return apiIconUrl ?? null;
}
