/**
 * Bonus 10/10/2026 — onglet Guides : **filtre par type**, dérivé des données.
 *
 * Fichier **PUR** (zéro React) : `Raid` = guide branché sur un overlay/studio (registre
 * des slugs), `Guide` = les autres. Options, compteurs et filtrage combiné (recherche +
 * catégorie + type) calculés depuis le registre souverain — jamais de liste en dur.
 */

/** Slugs branchés sur un overlay/studio (miroir de `RAID_GUIDE_CONFIG`, sans l'UI). */
const RAID_GUIDE_SLUGS: ReadonlySet<string> = new Set([
    "raid-gigalodon-dofus-guide",
    "raid-sanctuaire-jardins-eternels-dofus-guide",
]);

/** Filtre par type : `all` (défaut, rien masqué), `Raid` ou `Guide`. */
export type GuideTypeFilter = "all" | "Raid" | "Guide";

export type GuideType = Exclude<GuideTypeFilter, "all">;

export function guideTypeOf(slug: string): GuideType {
    return RAID_GUIDE_SLUGS.has(slug) ? "Raid" : "Guide";
}

export function guideTypeCounts(guides: readonly { slug: string }[]): { type: GuideType; count: number }[] {
    const counts = new Map<GuideType, number>();
    for (const guide of guides) {
        const type = guideTypeOf(guide.slug);
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
}

export function filterGuides<T extends { slug: string; title: string; description: string; category?: string }>(
    guides: readonly T[],
    filters: { query: string; category: string; type: GuideTypeFilter }
): T[] {
    const q = filters.query.trim().toLowerCase();
    return guides.filter((guide) => {
        if (filters.category !== "all" && guide.category !== filters.category) return false;
        if (filters.type !== "all" && guideTypeOf(guide.slug) !== filters.type) return false;
        if (!q) return true;
        return (
            guide.title.toLowerCase().includes(q) ||
            guide.description.toLowerCase().includes(q)
        );
    });
}
