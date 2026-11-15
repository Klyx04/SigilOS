/**
 * 🎫 God — construction du panneau Discord à partir des catégories réglées.
 *
 * Règle pure : le panneau publié et le menu « Ouvrir un ticket » lisent la même
 * liste, dans le même ordre. Aucune catégorie codée en dur, aucun libellé
 * dupliqué entre la route d'interactions et l'action de publication.
 */

import type { GodTicketCategoryRow } from "./god-config";

export type SupportSelectOption = {
    label: string;
    value: string;
    description: string;
    emoji: { name: string };
};

export type SupportPanelContent = {
    embedTitle: string;
    embedColor: number;
    embedDescription: string;
    embedFooter: string;
};

export function buildSupportPanelContent(
    categories: readonly GodTicketCategoryRow[]
): SupportPanelContent {
    const lines = categories.map((category) => `${category.emoji} **${category.label}**`);
    return {
        embedTitle: "📬 Support SigilOS",
        embedColor: 0x10b981,
        embedDescription: [
            "Besoin d'aide ? Ouvrez un ticket et notre équipe vous répondra rapidement.",
            "",
            "**Catégories disponibles :**",
            ...(lines.length > 0 ? lines : ["Aucune catégorie active pour le moment."]),
            "",
            "▸ Cliquez sur le bouton ci-dessous pour créer votre ticket.",
        ].join("\n"),
        embedFooter: "SigilOS · Support",
    };
}

export function buildSupportSelectOptions(
    categories: readonly GodTicketCategoryRow[]
): SupportSelectOption[] {
    return categories.map((category) => ({
        label: category.label.slice(0, 100),
        value: category.key,
        description: category.legacyCategory
            ? "Formulaire dédié"
            : "Formulaire générique (sujet + description)",
        emoji: { name: category.emoji },
    }));
}
