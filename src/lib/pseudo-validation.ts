/**
 * Règle de PSEUDO Dofus — SOURCE UNIQUE.
 *
 * Une seule définition, consommée par les DEUX surfaces :
 *   · le profil interne (`profile-actions.ts` : pseudos de mules, Zod) ;
 *   · le guide public (`GuestCharacterModal` : personnage invité du navigateur).
 *
 * Pourquoi un module à part : `profile-actions.ts` est un fichier `"use server"`
 * (il ne peut exporter que des fonctions async) — un composant client ne peut donc
 * pas y lire la règle. La validation vit ici, le serveur s'y branche.
 *
 * Règle : 1ʳᵉ lettre MAJUSCULE obligatoire, 2 à 20 caractères, lettres (accents
 * compris) et tirets internes uniquement — pas de chiffres, pas d'espaces.
 * La saisie est normalisée par `formatDofusPseudo` (`lib/utils`) : la casse suit,
 * la règle valide.
 */

export const PSEUDO_MIN_LENGTH = 2;
export const PSEUDO_MAX_LENGTH = 20;

/** `Pseudo` · `Pseudo-mule` — majuscule initiale, pas de chiffre, pas d'espace. */
export const PSEUDO_PATTERN = /^[A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F]*(-[a-zA-Z\u00C0-\u017F]+)*$/;

export const PSEUDO_TOO_SHORT_MESSAGE = "Pseudo trop court";
export const PSEUDO_TOO_LONG_MESSAGE = "Pseudo trop long";
export const PSEUDO_FORMAT_MESSAGE =
  "Format invalide (Ex: Pseudo, Pseudo-mule - Pas de chiffres ni caractères spéciaux)";

/**
 * Message d'erreur d'un pseudo, ou `null` s'il est valide. Un champ VIDE n'est pas
 * une erreur ici (l'appelant décide si le pseudo est obligatoire).
 */
export function pseudoError(value: string | null | undefined): string | null {
  const pseudo = (value ?? "").trim();
  if (!pseudo) return null;
  if (pseudo.length < PSEUDO_MIN_LENGTH) return PSEUDO_TOO_SHORT_MESSAGE;
  if (pseudo.length > PSEUDO_MAX_LENGTH) return PSEUDO_TOO_LONG_MESSAGE;
  if (!PSEUDO_PATTERN.test(pseudo)) return PSEUDO_FORMAT_MESSAGE;
  return null;
}
