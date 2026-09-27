/**
 * Module « Songes » — **tag de forum Discord par palier** (design A : aucun réglage, aucune migration).
 *
 * Objectif : pouvoir **filtrer les runs par palier** depuis Discord (cliquer un tag dans le forum)
 * sans ouvrir le site.
 *
 * Règles (mêmes principes que le Marché, `src/lib/market/forum-tags.ts`, décision D20/§9.4) :
 *  · source = `available_tags` du salon forum (les tags sont créés **côté Discord par un admin**) ;
 *  · SigilOS **ne crée jamais** de tag ;
 *  · le tag est retrouvé par son **NOM**, tolérant : accents, casse, séparateurs et **chiffres
 *    romains ou arabes** (« Paradoxe II », « PARADOXE_II », « paradoxe 2 » = le même palier) ;
 *  · aucun tag correspondant ⇒ **aucun tag appliqué** (publication normale, jamais d'erreur) ;
 *  · 1 tag par sujet : le palier d'une run ne change jamais, il est donc posé à la création ;
 *  · salon **textuel** ⇒ la notion n'existe pas (aucun tag).
 *
 * ⚠️ Fichier **pur** (aucune I/O, aucun import serveur) : partagé entre le moteur Discord,
 * l'écran de réglages (qui liste les noms attendus) et les tests.
 */
import { DIFFICULTIES } from "@/lib/songes/types";

/** Forme exploitable d'une entrée d'`available_tags` (id + nom). */
export type ForumTagLike = { id?: string | null; name?: string | null };

/** Chiffres romains utilisés par le référentiel des paliers (I à IV, jamais plus). */
const ROMAN_NUMERALS: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4" };

/**
 * Normalise un nom de tag : sans accent, minuscules, **token par token** (un mot qui vaut un
 * chiffre romain devient le chiffre arabe), et sans séparateur. Normaliser les DEUX côtés
 * (nom attendu et tag réel) rend la correspondance insensible à la mise en forme.
 */
export function normalizeForumTagName(value: string | null | undefined): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .map((token) => ROMAN_NUMERALS[token] ?? token)
        .join("");
}

/** Libellé du palier dans le référentiel (« Paradoxe II ») — `null` si la clé est inconnue. */
export function songesLevelTagName(difficulty: string | null | undefined): string | null {
    if (!difficulty) return null;
    const config = DIFFICULTIES[difficulty as keyof typeof DIFFICULTIES];
    return config?.label ?? null;
}

/**
 * Id du tag de forum correspondant au **palier** de la run, ou `null` quand aucun ne correspond
 * (tag non créé dans le salon, salon sans tag, palier inconnu) → aucun tag appliqué.
 */
export function resolveSongesForumTag(
    tags: ForumTagLike[] | null | undefined,
    difficulty: string | null | undefined
): string | null {
    const expected = songesLevelTagName(difficulty);
    if (!expected || !Array.isArray(tags) || tags.length === 0) return null;

    const wanted = normalizeForumTagName(expected);
    for (const tag of tags) {
        if (!tag?.id) continue;
        if (normalizeForumTagName(tag.name) === wanted) return tag.id.trim();
    }
    return null;
}
