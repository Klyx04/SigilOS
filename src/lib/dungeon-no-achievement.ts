/**
 * Pseudo-succès « Donjon validé » — **retiré le 11/10/2026** (demande user : « supprime le succès
 * "Donjon validé" il sert à rien, et plus de rendu de ce succès dans les fiches boss »).
 *
 * ⚠️ Ce module ne **crée** plus rien. Il ne conserve que l'identité du pseudo-succès, utilisée par
 *  - la **mémoire anti-résurrection** (`game-data-ignores`, qui doit toujours reconnaître le slug),
 *  - l'outil d'exploitation `scripts/succes-speciaux.ts retirer-donjon-valide` (purge des lignes).
 *
 * Le drapeau `Dungeon.isNoAchievement` reste : il dit honnêtement « ce donjon n'a pas de succès »
 * (un tel donjon n'affiche simplement **aucun** succès — plus de ligne générique).
 */

/** Slug du challenge système matérialisant « le donjon est validé » (retiré : purge seulement). */
export const NO_ACHIEVEMENT_CHALLENGE_SLUG = "donjon-valide";

/** Libellé affiché du pseudo-succès (utilisé par l'outil de purge). */
export const NO_ACHIEVEMENT_CHALLENGE_NAME = "Donjon validé";

// ─────────────────────────────────────────────────────────────────────────────
// Plus AUCUNE création/rattachement ici (11/10/2026) : `ensureNoAchievementChallengeId()` et
// `attachNoAchievementToDungeon()` ont été supprimés avec le pseudo-succès. Ce qui le recréait
// (siphon d'anomalie, enregistrement God d'un donjon sans succès) ne le fait plus — la seule
// opération restante est sa **purge** (`scripts/succes-speciaux.ts retirer-donjon-valide`).
// ─────────────────────────────────────────────────────────────────────────────

