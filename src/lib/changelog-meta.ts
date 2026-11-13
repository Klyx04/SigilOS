/**
 * Changelog — référentiel d'affichage unique (source unique, pure).
 *
 * Les libellés de catégories existaient en 3 variantes (« Fonctionnalité » /
 * « Nouveauté » / « Nouveau ») selon l'écran : une seule vérité ici,
 * consommée par la page God, la modale, la page guilde et les embeds Discord.
 * Importable côté client comme côté serveur (aucun import prisma/auth).
 */

import type { ChangelogCategory } from "@prisma/client";

/** Libellé FR d'une catégorie (le God disait « Fonctionnalité », la modale « Nouveauté » : tranché ici). */
export const CHANGELOG_CATEGORY_LABELS: Record<ChangelogCategory, string> = {
    FEATURE: "Fonctionnalité",
    BUGFIX: "Correction",
    SECURITY: "Sécurité",
    PERFORMANCE: "Performance",
    DOCUMENTATION: "Documentation",
};

/** Ordre canonique des catégories (filtres God). */
export const CHANGELOG_CATEGORY_ORDER: ChangelogCategory[] = [
    "FEATURE",
    "BUGFIX",
    "SECURITY",
    "PERFORMANCE",
    "DOCUMENTATION",
];

/** Pictos des embeds Discord (Discord uniquement : jamais dans l'UI du dashboard). */
export const CHANGELOG_CATEGORY_EMOJI: Record<ChangelogCategory, string> = {
    FEATURE: "✨",
    BUGFIX: "🐛",
    SECURITY: "🔒",
    PERFORMANCE: "⚡",
    DOCUMENTATION: "📄",
};

/** Couleurs des embeds Discord (entiers Discord). */
export const CHANGELOG_CATEGORY_COLORS: Record<ChangelogCategory, number> = {
    FEATURE: 0x22c55e,
    BUGFIX: 0xf59e0b,
    SECURITY: 0xef4444,
    PERFORMANCE: 0x3b82f6,
    DOCUMENTATION: 0xa855f7,
};

export function changelogCategoryLabel(category: string | null | undefined): string {
    return (
        CHANGELOG_CATEGORY_LABELS[category as ChangelogCategory] ?? category ?? "Mise à jour"
    );
}
