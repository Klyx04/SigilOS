import { guide as creerGererGuideDofus2026 } from "./creer-gerer-guilde-dofus-2026";
import { guide as poidsRunesForgemagieDofus } from "./poids-runes-forgemagie-dofus";
import { guide as guideElevageEnclosGuildeDofus } from "./guide-elevage-enclos-guilde-dofus";
import { guide as guideBrisageRentabiliteRunes } from "./guide-brisage-rentabilite-runes";
import { guide as guideGigalodonDofus } from "./guide-gigalodon-dofus";
import { guide as guideSanctuaireJardinsEternels } from "./guide-sanctuaire-jardins-eternels";

export type Guide = {
    slug: string;
    title: string;
    description: string;
    publishedAt: string;
    updatedAt: string;
    draft: boolean;
};

export const allGuides: readonly Guide[] = [
    {
        slug: creerGererGuideDofus2026.slug,
        title: creerGererGuideDofus2026.title,
        description: creerGererGuideDofus2026.description,
        publishedAt: creerGererGuideDofus2026.publishedAt,
        updatedAt: creerGererGuideDofus2026.updatedAt,
        draft: creerGererGuideDofus2026.draft,
    },
    {
        slug: poidsRunesForgemagieDofus.slug,
        title: poidsRunesForgemagieDofus.title,
        description: poidsRunesForgemagieDofus.description,
        publishedAt: poidsRunesForgemagieDofus.publishedAt,
        updatedAt: poidsRunesForgemagieDofus.updatedAt,
        draft: poidsRunesForgemagieDofus.draft,
    },
    {
        slug: guideElevageEnclosGuildeDofus.slug,
        title: guideElevageEnclosGuildeDofus.title,
        description: guideElevageEnclosGuildeDofus.description,
        publishedAt: guideElevageEnclosGuildeDofus.publishedAt,
        updatedAt: guideElevageEnclosGuildeDofus.updatedAt,
        draft: guideElevageEnclosGuildeDofus.draft,
    },
    {
        slug: guideBrisageRentabiliteRunes.slug,
        title: guideBrisageRentabiliteRunes.title,
        description: guideBrisageRentabiliteRunes.description,
        publishedAt: guideBrisageRentabiliteRunes.publishedAt,
        updatedAt: guideBrisageRentabiliteRunes.updatedAt,
        draft: guideBrisageRentabiliteRunes.draft,
    },
    {
        slug: guideGigalodonDofus.slug,
        title: guideGigalodonDofus.title,
        description: guideGigalodonDofus.description,
        publishedAt: guideGigalodonDofus.publishedAt,
        updatedAt: guideGigalodonDofus.updatedAt,
        draft: guideGigalodonDofus.draft,
    },
    {
        slug: guideSanctuaireJardinsEternels.slug,
        title: guideSanctuaireJardinsEternels.title,
        description: guideSanctuaireJardinsEternels.description,
        publishedAt: guideSanctuaireJardinsEternels.publishedAt,
        updatedAt: guideSanctuaireJardinsEternels.updatedAt,
        draft: guideSanctuaireJardinsEternels.draft,
    },
];

// Guides visibles publiquement (hors brouillons)
export const publishedGuides = allGuides.filter((guide) => !guide.draft);

export function getGuideBySlug(slug: string) {
    return allGuides.find((guide) => guide.slug === slug) ?? null;
}

// Contenu complet d'un guide (utilisé uniquement sur la page détail)
export async function getGuideContent(slug: string) {
    switch (slug) {
        case "creer-gerer-guilde-dofus-2026":
            return creerGererGuideDofus2026;
        case "poids-runes-forgemagie-dofus":
            return poidsRunesForgemagieDofus;
        case "guide-elevage-enclos-guilde-dofus":
            return guideElevageEnclosGuildeDofus;
        case "guide-brisage-rentabilite-runes":
            return guideBrisageRentabiliteRunes;
        case "raid-gigalodon-dofus-guide":
            return guideGigalodonDofus;
        case "raid-sanctuaire-jardins-eternels-dofus-guide":
            return guideSanctuaireJardinsEternels;
        default:
            return null;
    }
}