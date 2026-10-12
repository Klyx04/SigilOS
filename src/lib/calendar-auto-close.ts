/**
 * Clôture **automatique** des événements terminés — règle pure, une seule source.
 *
 * Constat du 30/09/2026 : la passe de fond (ouverture du calendrier, cron, ouverture
 * d'une fiche) basculait **tout** événement `PUBLISHED` en `COMPLETED` dès que sa date
 * de fin était passée — et supprimait l'embed Discord au passage. Conséquence : à J+1,
 * un raid terminé n'était plus « à clôturer » nulle part, donc le rappel de clôture
 * (24 h après la fin, `@/lib/raid-reminder`) ne partait **jamais**.
 *
 * Règle retenue : un **raid** n'est clôturé d'office qu'après **48 h** (le rappel de
 * 24 h a le temps de partir, et un raid vraiment oublié finit quand même par se ranger) ;
 * tous les autres types d'événement gardent le comportement historique (clôture dès la fin).
 */

/** Délai avant clôture d'office d'un raid terminé (le rappel de clôture part à 24 h). */
export const RAID_AUTO_CLOSE_DELAY_MS = 48 * 60 * 60 * 1000;

/** Date de fin exploitable, sinon `null` (valeur absente ou corrompue). */
function toDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Faut-il clôturer d'office cet événement ? Miroir **JavaScript** de
 * `blindAutoCloseWhere` (une seule règle, deux usages : un événement déjà chargé ici,
 * un lot en base là-bas). Le test vérifie que les deux répondent pareil aux bornes.
 */
export function shouldBlindAutoClose(
    type: string,
    endDate: Date | string | null | undefined,
    now: Date
): boolean {
    const end = toDate(endDate);
    if (!end) return false;
    const delay = type === "RAID_OFFICIAL" ? RAID_AUTO_CLOSE_DELAY_MS : 0;
    return end.getTime() < now.getTime() - delay;
}

/**
 * Miroir **SQL** de `shouldBlindAutoClose` : filtre des événements à clôturer d'office.
 * Deux branches disjointes, pour rester lisible au même endroit que la règle.
 */
export function blindAutoCloseWhere(guildId: string, now: Date) {
    return {
        guildId,
        status: "PUBLISHED" as const,
        OR: [
            // Raid : seulement après le délai (le rappel de clôture est passé avant).
            {
                type: "RAID_OFFICIAL" as const,
                endDate: { lt: new Date(now.getTime() - RAID_AUTO_CLOSE_DELAY_MS) },
            },
            // Tout le reste : dès la fin (comportement historique).
            { type: { not: "RAID_OFFICIAL" as const }, endDate: { lt: now } },
        ],
    };
}