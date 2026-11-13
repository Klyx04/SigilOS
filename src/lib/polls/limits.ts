/**
 * Sondages — **bornes partagées** (une seule source pour le serveur, les
 * formulaires et l'embed Discord).
 *
 * Pourquoi ce fichier existe : le titre était plafonné à **80 caractères**
 * (serveur Zod, compteur et `maxLength` du formulaire, trois fois la même
 * valeur recopiée) — une vraie question de guilde ne tenait pas (« Est-ce que
 * ça vous chaufferait de faire des sessions de drop hebdomadaires ? » = 76
 * caractères, on était déjà à la limite). Idem pour la description : bornée à
 * 2 000 côté serveur mais à 500 côté formulaire, et rendue en italique sur une
 * seule ligne dans l'embed, ce qui écrasait les retours à la ligne.
 *
 * Ici : **les bornes**, importables côté client (aucun import serveur) et
 * côté serveur, donc un seul endroit à changer le jour où l'on veut plus long.
 */

export const POLL_TITLE_MIN_LENGTH = 3;
/** Titre : 150 caractères (limite Discord en titre d'embed : 256). */
export const POLL_TITLE_MAX_LENGTH = 150;

export const POLL_DESCRIPTION_MIN_LENGTH = 5;
export const POLL_DESCRIPTION_MAX_LENGTH = 2000;
/** Part de la description rendue dans l'embed Discord (le reste renvoie à SigilOS). */
export const POLL_EMBED_DESCRIPTION_MAX_LENGTH = 1200;

export const POLL_OPTION_MIN_COUNT = 2;
export const POLL_OPTION_MAX_COUNT = 10;
export const POLL_OPTION_LABEL_MAX_LENGTH = 200;

/** Message unique des bornes du titre (jamais un « max 80 » recopié dans un coin). */
export function pollTitleLengthError(title: string): string | null {
    const value = title.trim();
    if (value.length < POLL_TITLE_MIN_LENGTH) return `Titre trop court (min ${POLL_TITLE_MIN_LENGTH} caractères)`;
    if (value.length > POLL_TITLE_MAX_LENGTH) return `Titre trop long (max ${POLL_TITLE_MAX_LENGTH} caractères)`;
    return null;
}
