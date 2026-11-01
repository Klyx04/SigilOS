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
