/**
 * Palette « stricte » des Dofus — couleurs officielles par slug.
 *
 * Règle : la base de données reste la source de vérité pour la couleur de chaque
 * Dofus (renseignée via l'admin). Ce module ne fait que surcharger avec un hex
 * officiel quand le slug correspond ; sinon on retombe sur la couleur DB.
 * À utiliser partout (barres, badges, icônes) pour garantir la cohérence visuelle.
 */
export const DOFUS_OFFICIAL_COLORS: Record<string, string> = {
    "dofus-argente": "#2AB8A5",
    "dofus-argente-sombre": "#0f766e",
    "dofus-pourpre": "#9333ea",
    "dofus-ivoire": "#e7e5e4",
    "dofus-emeraude": "#10b981",
    "dofus-ocre": "#d97706",
    "dofus-vulbis": "#dc2626",
    "dofus-craqueleur": "#b45309",
    "dofus-dokoko": "#ec4899",
    "dofus-ebene": "#3f3f46",
    "dofus-azure": "#3b82f6",
    "dofus-sylvestre": "#10b981",
    "dofus-abyssal": "#0891b2",
    "dofus-obsidien": "#71717a",
    "dofus-eliacube": "#f59e0b",
    "dofus-nebuleux": "#6366f1",
    "dofus-tachete": "#ef4444",
    "dofoozbz": "#a855f7",
    "dokille": "#f59e0b",
    "dofus-dokille": "#f59e0b",
};

export function getDofusColor(slug?: string | null, fallback?: string | null): string {
    if (slug && DOFUS_OFFICIAL_COLORS[slug]) return DOFUS_OFFICIAL_COLORS[slug];
    return fallback || "#6366f1";
}
