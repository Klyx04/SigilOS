import { guide as creerGererGuideDofus2026 } from "./creer-gerer-guilde-dofus-2026";

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
];

// Guides visibles publiquement (hors brouillons)
export const publishedGuides = allGuides.filter((guide) => !guide.draft);

export function getGuideBySlug(slug: string) {
    return allGuides.find((guide) => guide.slug === slug) ?? null;
}

// Contenu complet d'un guide (utilisé uniquement sur la page détail)
export async function getGuideContent(slug: string) {
    if (slug === "creer-gerer-guilde-dofus-2026") {
        return creerGererGuideDofus2026;
    }
    return null;
}