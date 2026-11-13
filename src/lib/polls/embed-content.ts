/**
 * Sondages — contenu de l'embed Discord (règle pure, sans dépendance serveur).
 *
 * Le titre de l'embed est **déjà la question** (`📊 QUESTION EN MAJUSCULES`).
 * Quand le créateur saisit dans « Description » exactement la même phrase que
 * dans « Question », l'embed la répétait en citation : deux fois la même
 * information, pour un embed plus long et plus bruyant. On ne la répète donc
 * pas — le texte reste intégral en base et dans le dashboard.
 *
 * La comparaison ignore la casse, les espaces multiples et la ponctuation
 * finale : « Quelle refonte ? » et « quelle refonte » sont la même phrase.
 */

/** Normalise un texte de sondage pour comparer question et description. */
export function normalizePollText(value: string | null | undefined): string {
    return String(value ?? "")
        .normalize("NFC")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[.!?…]+$/u, "")
        .trim()
        .toLowerCase();
}

/** Vrai quand la description ne fait que répéter la question (titre de l'embed). */
export function isPollDescriptionRedundant(
    title: string | null | undefined,
    description: string | null | undefined
): boolean {
    const normalizedTitle = normalizePollText(title);
    const normalizedDescription = normalizePollText(description);
    return (
        normalizedTitle.length > 0 &&
        normalizedDescription.length > 0 &&
        normalizedTitle === normalizedDescription
    );
}
