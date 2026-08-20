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
    category?: string;
    coverImage?: string;
    readingTime?: string;
    badgeColor?: "emerald" | "amber" | "cyan" | "purple" | "rose" | "teal";
};

export const allGuides: readonly Guide[] = [
    {
        slug: guideGigalodonDofus.slug,
        title: guideGigalodonDofus.title,
        description: guideGigalodonDofus.description,
        publishedAt: guideGigalodonDofus.publishedAt,
        updatedAt: guideGigalodonDofus.updatedAt,
        draft: guideGigalodonDofus.draft,
        category: "Raid de Guilde",
        coverImage: "/images/guides/gigalodon/118-boss-gigalodon.jpg",
        readingTime: "12 min",
        badgeColor: "cyan",
    },
    {
        slug: guideSanctuaireJardinsEternels.slug,
        title: guideSanctuaireJardinsEternels.title,
        description: guideSanctuaireJardinsEternels.description,
        publishedAt: guideSanctuaireJardinsEternels.publishedAt,
        updatedAt: guideSanctuaireJardinsEternels.updatedAt,
        draft: guideSanctuaireJardinsEternels.draft,
        category: "Raid de Guilde",
        coverImage: "/images/guides/sanctuaire/110-95reine.jpg",
        readingTime: "15 min",
        badgeColor: "rose",
    },
    {
        slug: creerGererGuideDofus2026.slug,
        title: creerGererGuideDofus2026.title,
        description: creerGererGuideDofus2026.description,
        publishedAt: creerGererGuideDofus2026.publishedAt,
        updatedAt: creerGererGuideDofus2026.updatedAt,
        draft: creerGererGuideDofus2026.draft,
        category: "Gestion de Guilde",
        coverImage: "/images/guides/guilde/guild_hall.jpg",
        readingTime: "8 min",
        badgeColor: "emerald",
    },
    {
        slug: poidsRunesForgemagieDofus.slug,
        title: poidsRunesForgemagieDofus.title,
        description: poidsRunesForgemagieDofus.description,
        publishedAt: poidsRunesForgemagieDofus.publishedAt,
        updatedAt: poidsRunesForgemagieDofus.updatedAt,
        draft: poidsRunesForgemagieDofus.draft,
        category: "Forgemagie",
        coverImage: "/images/guides/fm/rune_ga_pa.png",
        readingTime: "10 min",
        badgeColor: "amber",
    },
    {
        slug: guideBrisageRentabiliteRunes.slug,
        title: guideBrisageRentabiliteRunes.title,
        description: guideBrisageRentabiliteRunes.description,
        publishedAt: guideBrisageRentabiliteRunes.publishedAt,
        updatedAt: guideBrisageRentabiliteRunes.updatedAt,
        draft: guideBrisageRentabiliteRunes.draft,
        category: "Économie & Métiers",
        coverImage: "/images/guides/fm/rune_pa_pui.png",
        readingTime: "7 min",
        badgeColor: "purple",
    },
    {
        slug: guideElevageEnclosGuildeDofus.slug,
        title: guideElevageEnclosGuildeDofus.title,
        description: guideElevageEnclosGuildeDofus.description,
        publishedAt: guideElevageEnclosGuildeDofus.publishedAt,
        updatedAt: guideElevageEnclosGuildeDofus.updatedAt,
        draft: guideElevageEnclosGuildeDofus.draft,
        category: "Élevage & Enclos",
        coverImage: "/images/guides/elevage/dragodindes.png",
        readingTime: "9 min",
        badgeColor: "teal",
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