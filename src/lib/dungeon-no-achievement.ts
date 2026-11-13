/**
 * Pseudo-succès « Donjon validé ».
 *
 * **Historique** : retiré le 11/10/2026 (« supprime le succès Donjon validé, il sert à rien »),
 * puis **réintroduit de façon ciblée le 25/10/2026** : les doubles boss (« Comte et Klime »,
 * « Comte et Nileza », « Comte et Sylargh », « Comte et Missiz Frizz ») n'ont **aucun** succès
 * propre — DofusDB ne les liste pas — donc aucune coche n'était possible. Demande user :
 * « je peux pas cocher juste le fait d'avoir fait Comte + X ? ».
 *
 * **Règle** : ce pseudo-succès n'est rendu que s'il est le **seul** du donjon. Un donjon qui a
 * de vrais succès ne le voit **jamais** (le retrait du 11/10 reste donc vrai partout ailleurs).
 *
 * ⚠️ Ce module est **pur** (importable par un composant client) : les écritures vivent dans
 * `src/server/dungeon-completion.ts`.
 */

/** Slug du challenge système matérialisant « le donjon est validé ». */
export const NO_ACHIEVEMENT_CHALLENGE_SLUG = "donjon-valide";

/** Libellé affiché du pseudo-succès. */
export const NO_ACHIEVEMENT_CHALLENGE_NAME = "Donjon validé";

/** Explication affichée sous le succès (honnête : il n'y a rien d'autre à valider). */
export const NO_ACHIEVEMENT_CHALLENGE_DESCRIPTION =
    "Coche ce succès quand tu as terminé le donjon : aucun autre succès n'est connu pour lui.";

type AchievementLike = {
    challenge?: { slug?: string | null } | null;
    slug?: string | null;
};

function achievementSlug(achievement: AchievementLike): string | null {
    return achievement.challenge?.slug ?? achievement.slug ?? null;
}

/** Le donjon n'a-t-il **que** le pseudo-succès (ou aucune ligne) ? */
export function hasOnlyCompletionAchievement(achievements: readonly AchievementLike[]): boolean {
    return achievements.every((achievement) => achievementSlug(achievement) === NO_ACHIEVEMENT_CHALLENGE_SLUG);
}

/**
 * Succès à **rendre** : « Donjon validé » est écarté dès que le donjon a de vrais succès,
 * et conservé quand c'est la seule ligne (la coche « je l'ai fait »).
 */
export function visibleDungeonAchievements<T extends AchievementLike>(achievements: readonly T[]): T[] {
    const real = achievements.filter(
        (achievement) => achievementSlug(achievement) !== NO_ACHIEVEMENT_CHALLENGE_SLUG
    );
    return real.length > 0 ? real : [...achievements];
}
