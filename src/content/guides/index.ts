import type { Locale } from "@/lib/i18n/types";

// Contenus FR (langue source)
import { guide as gererDiscordGuildeDofusFr } from "./gerer-discord-guilde-dofus";
import { guide as guideGigalodonDofusFr } from "./guide-gigalodon-dofus";
import { guide as guideSanctuaireJardinsEternelsFr } from "./guide-sanctuaire-jardins-eternels";
import { guide as creerGererGuildeDofus2026Fr } from "./creer-gerer-guilde-dofus-2026";
import { guide as poidsRunesForgemagieDofusFr } from "./poids-runes-forgemagie-dofus";
import { guide as guideBrisageRentabiliteRunesFr } from "./guide-brisage-rentabilite-runes";
import { guide as guideElevageEnclosGuildeDofusFr } from "./guide-elevage-enclos-guilde-dofus";

// Contenus EN (traductions, vocabulaire officiel du client anglais — voir GLOSSARY-EN.md)
import { guide as gererDiscordGuildeDofusEn } from "./en/gerer-discord-guilde-dofus";
import { guide as guideGigalodonDofusEn } from "./en/guide-gigalodon-dofus";
import { guide as guideSanctuaireJardinsEternelsEn } from "./en/guide-sanctuaire-jardins-eternels";
import { guide as creerGererGuildeDofus2026En } from "./en/creer-gerer-guilde-dofus-2026";
import { guide as poidsRunesForgemagieDofusEn } from "./en/poids-runes-forgemagie-dofus";
import { guide as guideBrisageRentabiliteRunesEn } from "./en/guide-brisage-rentabilite-runes";
import { guide as guideElevageEnclosGuildeDofusEn } from "./en/guide-elevage-enclos-guilde-dofus";

/** Métadonnées localisées d'un guide (index + en-tête de la fiche). */
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

/** Contenu complet d'un guide (corps HTML) : un module par locale. */
export type GuideModule = {
    slug: string;
    title: string;
    description: string;
    publishedAt: string;
    updatedAt: string;
    draft: boolean;
    body: string;
};

type GuideEntry = {
    slug: string;
    /** Libellé de catégorie affiché (une valeur par locale). */
    category: Record<Locale, string>;
    coverImage: string;
    readingTime: string;
    badgeColor: NonNullable<Guide["badgeColor"]>;
    fr: GuideModule;
    en: GuideModule;
};

const GUIDE_REGISTRY: readonly GuideEntry[] = [
    {
        slug: gererDiscordGuildeDofusFr.slug,
        category: { fr: "Gestion de Guilde", en: "Guild Management" },
        coverImage: "/images/guides/guilde/guild_hall.jpg",
        readingTime: "11 min",
        badgeColor: "emerald",
        fr: gererDiscordGuildeDofusFr,
        en: gererDiscordGuildeDofusEn,
    },
    {
        slug: guideGigalodonDofusFr.slug,
        category: { fr: "Raid de Guilde", en: "Guild Raid" },
        coverImage: "/images/guides/gigalodon/118-boss-gigalodon.jpg",
        readingTime: "12 min",
        badgeColor: "cyan",
        fr: guideGigalodonDofusFr,
        en: guideGigalodonDofusEn,
    },
    {
        slug: guideSanctuaireJardinsEternelsFr.slug,
        category: { fr: "Raid de Guilde", en: "Guild Raid" },
        coverImage: "/images/guides/sanctuaire/110-95reine.jpg",
        readingTime: "15 min",
        badgeColor: "rose",
        fr: guideSanctuaireJardinsEternelsFr,
        en: guideSanctuaireJardinsEternelsEn,
    },
    {
        slug: creerGererGuildeDofus2026Fr.slug,
        category: { fr: "Gestion de Guilde", en: "Guild Management" },
        coverImage: "/images/guides/guilde/guild_hall.jpg",
        readingTime: "8 min",
        badgeColor: "teal",
        fr: creerGererGuildeDofus2026Fr,
        en: creerGererGuildeDofus2026En,
    },
    {
        slug: poidsRunesForgemagieDofusFr.slug,
        category: { fr: "Forgemagie", en: "Smithmagic" },
        coverImage: "/images/guides/fm/rune_ga_pa.png",
        readingTime: "10 min",
        badgeColor: "amber",
        fr: poidsRunesForgemagieDofusFr,
        en: poidsRunesForgemagieDofusEn,
    },
    {
        slug: guideBrisageRentabiliteRunesFr.slug,
        category: { fr: "Économie & Métiers", en: "Economy & Jobs" },
        coverImage: "/images/guides/fm/rune_pa_pui.png",
        readingTime: "7 min",
        badgeColor: "purple",
        fr: guideBrisageRentabiliteRunesFr,
        en: guideBrisageRentabiliteRunesEn,
    },
    {
        slug: guideElevageEnclosGuildeDofusFr.slug,
        category: { fr: "Élevage & Enclos", en: "Breeding & Paddocks" },
        coverImage: "/images/guides/elevage/dragodindes.png",
        readingTime: "9 min",
        badgeColor: "teal",
        fr: guideElevageEnclosGuildeDofusFr,
        en: guideElevageEnclosGuildeDofusEn,
    },
];


function findEntry(slug: string): GuideEntry | null {
    return GUIDE_REGISTRY.find((entry) => entry.slug === slug) ?? null;
}

function toGuide(entry: GuideEntry, locale: Locale): Guide {
    const source = locale === "en" ? entry.en : entry.fr;
    return {
        slug: entry.slug,
        title: source.title,
        description: source.description,
        publishedAt: source.publishedAt,
        updatedAt: source.updatedAt,
        draft: source.draft,
        category: entry.category[locale],
        coverImage: entry.coverImage,
        readingTime: entry.readingTime,
        badgeColor: entry.badgeColor,
    };
}

/** Registre complet des guides, localisé. */
export function getAllGuides(locale: Locale = "fr"): readonly Guide[] {
    return GUIDE_REGISTRY.map((entry) => toGuide(entry, locale));
}

/** Guides visibles publiquement (hors brouillons), localisés. */
export function getPublishedGuides(locale: Locale = "fr"): readonly Guide[] {
    return getAllGuides(locale).filter((guide) => !guide.draft);
}

/**
 * Registre FR : conservé pour les consommateurs indépendants de la langue
 * (sitemap, grilles internes). Les pages publiques utilisent les fonctions localisées.
 */
export const allGuides: readonly Guide[] = getAllGuides("fr");
export const publishedGuides: readonly Guide[] = getPublishedGuides("fr");

export function getGuideBySlug(slug: string, locale: Locale = "fr"): Guide | null {
    const entry = findEntry(slug);
    return entry ? toGuide(entry, locale) : null;
}

/** Contenu complet d'un guide (utilisé uniquement sur la page détail). */
export async function getGuideContent(slug: string, locale: Locale = "fr"): Promise<GuideModule | null> {
    const entry = findEntry(slug);
    if (!entry) return null;
    return locale === "en" ? entry.en : entry.fr;
}
