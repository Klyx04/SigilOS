/**
 * Description d'un succès **côté écran** — module **client-safe** (aucune IO, aucun import serveur).
 *
 * 🐛 Mesure du 30/10/2026 : 3 donjons (`dechireuse`, `blop-indigo-royal`, `dramak`) affichaient
 * encore le gabarit de seed « Vaincre tel boss dans son donjon en validant le challenge dédié. »
 * alors que le vrai succès existe chez DofusDB (résolu désormais par
 * `siphonSpecialAchievements`). Quand la donnée n'est **pas** encore résolue, l'écran doit le
 * **dire** — pas recracher un gabarit qui ressemble à une mécanique.
 */

/** Gabarit du seed (`sp-cial` et ses variantes) : ce n'est pas une mécanique. */
export const PLACEHOLDER_CHALLENGE_DESCRIPTION =
    "Vaincre tel boss dans son donjon en validant le challenge dédié.";

/**
 * Texte du seed quand **aucun vrai challenge** n'a été résolu (mesure du 21/11/2026 :
 * le challenge « Liberte » porte ce texte sur sa propre fiche, donc il s'affiche partout).
 * Ce n'est pas une description : l'écran ne doit jamais le présenter comme telle.
 */
export const GENERIC_CHALLENGE_DESCRIPTION = "Challenge généré automatiquement";

const GENERIC_NORMALIZED = "challenge genere automatiquement";

/** Texte qui commence par « Vaincre tel boss » (casse comprise : `compagnon` = « Vaincre Tel Boss »). */
export function isPlaceholderChallengeDescription(value: unknown): boolean {
    return /^vaincre tel boss\b/i.test(String(value ?? "").trim());
}

/** Texte générique du seed, accents et casse ignorés, point final toléré. */
export function isGenericChallengeDescription(value: unknown): boolean {
    const normalized = String(value ?? "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\.$/, "");
    return normalized === GENERIC_NORMALIZED;
}

/** Slugs du challenge placeholder partagé (seed : `sp-cial` ; normalisé : `special`). */
const PLACEHOLDER_SLUGS = ["sp-cial", "special"];

/**
 * Ce que l'écran doit afficher :
 *  - `null` si la description est vide (l'appelant décide de la suite) ;
 *  - « Mécanique non documentée pour ce donjon. » pour le succès **Spécial** encore au gabarit ;
 *  - la **description partagée du challenge** (`fallback`) quand la ligne porte seulement le
 *    texte générique du seed, si elle est réellement documentée ;
 *  - « Description pas encore disponible pour ce succès. » quand rien n'est résolu ;
 *  - le texte réel sinon.
 */
export function displayAchievementDescription(input: {
    description: string | null;
    slug: string | null;
    /** Description **partagée** du challenge (même texte pour tous les donjons). */
    fallback?: string | null;
}): string | null {
    const text = String(input.description ?? "").trim();
    if (!text) return null;
    const slug = String(input.slug ?? "").trim().toLowerCase();
    const generic = isGenericChallengeDescription(text);
    const placeholder = isPlaceholderChallengeDescription(text);

    if (placeholder || generic) {
        if (PLACEHOLDER_SLUGS.includes(slug)) return "Mécanique non documentée pour ce donjon.";
        if (generic) {
            const fallback = String(input.fallback ?? "").trim();
            if (
                fallback
                && !isGenericChallengeDescription(fallback)
                && !isPlaceholderChallengeDescription(fallback)
            ) {
                return fallback;
            }
            return "Description pas encore disponible pour ce succès.";
        }
    }

    return text;
}
