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

/** Texte qui commence par « Vaincre tel boss » (casse comprise : `compagnon` = « Vaincre Tel Boss »). */
export function isPlaceholderChallengeDescription(value: unknown): boolean {
    return /^vaincre tel boss\b/i.test(String(value ?? "").trim());
}

/** Slugs du challenge placeholder partagé (seed : `sp-cial` ; normalisé : `special`). */
const PLACEHOLDER_SLUGS = ["sp-cial", "special"];

/**
 * Ce que l'écran doit afficher :
 *  - `null` si la description est vide (l'appelant décide de la suite) ;
 *  - « Mécanique non documentée pour ce donjon. » pour le succès **Spécial** encore au gabarit ;
 *  - le texte réel sinon.
 */
export function displayAchievementDescription(input: {
    description: string | null;
    slug: string | null;
}): string | null {
    const text = String(input.description ?? "").trim();
    if (!text) return null;
    const slug = String(input.slug ?? "").trim().toLowerCase();
    if (PLACEHOLDER_SLUGS.includes(slug) && isPlaceholderChallengeDescription(text)) {
        return "Mécanique non documentée pour ce donjon.";
    }
    return text;
}
