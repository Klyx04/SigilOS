/**
 * Clôture **automatique** des événements terminés — règle pure, une seule source.
 *
 * Constat du 30/09/2026 : la passe de fond (ouverture du calendrier, cron, ouverture
 * d'une fiche) basculait **tout** événement `PUBLISHED` en `COMPLETED` dès que sa date
 * de fin était passée — et supprimait l'embed Discord au passage. Conséquence : à J+1,
 * un raid terminé n'était plus « à clôturer » nulle part, donc le rappel de clôture
 * (24 h après la fin, `@/lib/raid-reminder`) ne partait **jamais**.
 *
 * Règle retenue (décision user du 25/10/2026) :
 *  - un **raid** n'est clôturé d'office qu'après **48 h** (le rappel de clôture part à
 *    24 h, le capitaine a donc 24 h pour saisir présents + score) ; la clôture d'office
 *    est **traçable** (`metadata.closedBySystem`) et **rattrapable** (`completeRaidEvent`
 *    accepte un raid `COMPLETED` sans `metadata.completedAt`) ;
 *  - tous les autres types gardent le comportement historique (clôture dès la fin) ;
 *  - un **miroir agenda** DJ/Songes (lecture seule, `metadata.source`) n'est **jamais**
 *    clôturé d'office : la copie suit sa source (`syncDjMirror` / `syncSongesMirror`).
 *
 * ⚠️ Cette règle ne décide **que** de l'affichage et du travail de fond : aucune page
 * n'écrit en base. Seule la passe `/api/cron/calendar-auto-close`
 * (`@/server/calendar-auto-close-core`) applique la clôture, avec la purge Discord.
 */

/** Délai avant clôture d'office d'un raid terminé (le rappel de clôture part à 24 h). */
export const RAID_AUTO_CLOSE_DELAY_MS = 48 * 60 * 60 * 1000;

/** Date de fin exploitable, sinon `null` (valeur absente ou corrompue). */
function toDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export type AutoCloseCandidate = {
    type: string;
    endDate: Date | string | null | undefined;
    now: Date;
    /**
     * Miroir agenda DJ/Songes (`isAgendaMirror(metadata)`). Sa date de fin n'est
     * qu'une **projection** de la date du post d'origine : le fermer ici ferait
     * afficher « Terminé » un post encore ouvert.
     */
    isMirror?: boolean;
};

/**
 * Faut-il clôturer d'office cet événement ? Miroir **JavaScript** de
 * `blindAutoCloseWhere` (une seule règle, deux usages : un événement déjà chargé ici,
 * un lot en base là-bas). Le test vérifie que les deux répondent pareil aux bornes.
 */
export function shouldBlindAutoClose({ type, endDate, now, isMirror }: AutoCloseCandidate): boolean {
    // Un miroir suit sa source : jamais de clôture d'office côté calendrier.
    if (isMirror) return false;
    const end = toDate(endDate);
    if (!end) return false;
    const delay = type === "RAID_OFFICIAL" ? RAID_AUTO_CLOSE_DELAY_MS : 0;
    return end.getTime() < now.getTime() - delay;
}

/**
 * Miroir **SQL** de `shouldBlindAutoClose` : filtre des événements à clôturer d'office.
 * Deux branches disjointes, pour rester lisible au même endroit que la règle.
 *
 * `guildId = null` ⇒ toutes les guildes : c'est le **pré-filtre** de la passe de fond
 * (`@/server/calendar-auto-close-core`), qui retranche ensuite les miroirs en JS.
 * On ne peut **pas** exclure les miroirs ici : un `NOT` sur un chemin JSON Prisma
 * écarte silencieusement les lignes **sans** `metadata.source` (comparaison NULL en
 * Postgres) — le filtre JS est la seule forme sûre, et il est borné (`take`).
 */
export function blindAutoCloseWhere(guildId: string | null, now: Date) {
    return {
        ...(guildId ? { guildId } : {}),
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