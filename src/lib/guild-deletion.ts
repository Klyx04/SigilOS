/**
 * Suppression d'une guilde par son **propriétaire** — règles pures (aucune I/O).
 *
 * 📌 Décision du 01/11/2026 : le propriétaire peut retirer sa guilde du produit. Ce n'est **pas**
 * une suppression instantanée : la guilde est désactivée, les profils archivés, et une échéance est
 * posée. La suppression physique (`hardDeleteGuild`) reste réservée à God.
 *
 * 🐛 Pourquoi la confirmation est comparée au **nom** de la guilde : une action irréversible ne doit
 * pas partir d'un clic mal placé. La comparaison ignore casse, espaces multiples et accents — une
 * personne qui recopie « kamas  &  co » doit passer, pas celle qui tape « oui ».
 */
export const GUILD_DELETION_GRACE_DAYS = 30;

/** Normalisation utilisée **seulement** pour la confirmation (jamais pour un identifiant). */
export function normalizeGuildName(value: string): string {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/** La saisie correspond-elle au nom de la guilde ? Un nom vide ne peut jamais être confirmé. */
export function isDeletionConfirmationValid(typed: string, guildName: string): boolean {
    const expected = normalizeGuildName(guildName);
    if (expected.length === 0) return false;
    return normalizeGuildName(typed) === expected;
}

/**
 * La guilde est-elle arrivée à **échéance de suppression** ?
 *
 * Trois conditions, jamais deux : elle doit être supprimée (`deletedAt`), avoir une échéance, et
 * cette échéance doit être atteinte. Une date illisible ne purge **jamais** (fail-closed) — une
 * donnée qu'on ne sait pas lire ne justifie pas une suppression définitive.
 */
export function isGuildPurgeDue(
    input: { deletedAt: Date | string | null; scheduledDeletion: Date | string | null },
    now: Date = new Date(),
): boolean {
    if (!input.deletedAt || !input.scheduledDeletion) return false;

    const due = input.scheduledDeletion instanceof Date
        ? input.scheduledDeletion
        : new Date(input.scheduledDeletion);
    if (Number.isNaN(due.getTime())) return false;

    return due.getTime() <= now.getTime();
}
