/**
 * Sondages **programmés** (staff) — règles pures, une seule source.
 *
 * Un « créneau » n'est pas un sondage : c'est la consigne « publier ce sondage,
 * dans ce salon, à **cette minute-là** ». Les quatre règles qui décident d'un
 * créneau vivent ici, testables sans base ni horloge réelle :
 *
 * 1. **3 créneaux en attente maximum** par guilde (un créneau publié ou annulé
 *    libère immédiatement sa place) ;
 * 2. **jamais deux créneaux à la même minute** dans une guilde (la contrainte
 *    `@@unique([guildId, scheduledAt])` en base est la garantie, cette règle est
 *    le message) ;
 * 3. **bornes** : au moins `MIN_LEAD_MINUTES` dans le futur (le cron doit avoir
 *    le temps de passer) et au plus `MAX_HORIZON_DAYS` (au-delà, personne ne
 *    planifie rien de fiable) ;
 * 4. **durée de vote** bornée sur le plafond historique des sondages (30 jours).
 *
 * La comparaison « même minute » se fait sur des **instants** tronqués à la
 * minute (UTC) : elle est donc indépendante du fuseau du serveur, comme
 * `formatPollEnd`.
 */

/** Nombre maximal de créneaux **en attente** par guilde. */
export const MAX_SCHEDULED_POLLS = 3;

/** Délai minimal entre la création et la publication (min). */
export const MIN_LEAD_MINUTES = 5;

/** Horizon maximal de programmation (jours). */
export const MAX_HORIZON_DAYS = 30;

/** Durée de vote autorisée (heures) — même plafond que `MAX_POLL_DURATION_MS`. */
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 720;

/** Libellé unique du tag, partagé par la carte, la fiche et l'embed Discord. */
export const SCHEDULED_POLL_TAG = "Sondage programmé";

/** Statuts d'un créneau (miroir de l'enum Prisma, sans import côté client). */
export type ScheduledPollStatus = "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "CANCELLED" | "FAILED";

/** Instants tronqués à la minute (UTC) : deux créneaux « 21h30:12 » et « 21h30:58 » sont la même minute. */
export function floorToMinute(date: Date): number {
    return Math.floor(date.getTime() / 60_000);
}

/** Deux instants tombent-ils sur la **même minute** ? */
export function isSameMinute(a: Date | string, b: Date | string): boolean {
    const first = a instanceof Date ? a : new Date(a);
    const second = b instanceof Date ? b : new Date(b);
    if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return false;
    return floorToMinute(first) === floorToMinute(second);
}

export interface ScheduledSlotRef {
    id?: string;
    scheduledAt: Date | string;
}

/**
 * Créneau déjà pris à la même minute, ou `null`.
 * `ignoreId` permet de valider une **modification** sans se détecter soi-même.
 */
export function findMinuteConflict<T extends ScheduledSlotRef>(
    candidate: Date | string,
    existing: readonly T[],
    ignoreId?: string | null,
): T | null {
    for (const slot of existing) {
        if (ignoreId && slot.id === ignoreId) continue;
        if (isSameMinute(candidate, slot.scheduledAt)) return slot;
    }
    return null;
}

/** Créneaux restants (jamais négatif) pour un nombre de créneaux en attente. */
export function remainingSlots(pendingCount: number): number {
    return Math.max(0, MAX_SCHEDULED_POLLS - Math.max(0, pendingCount));
}

/** Un nouveau créneau est-il encore possible ? */
export function canScheduleAnotherPoll(pendingCount: number): boolean {
    return remainingSlots(pendingCount) > 0;
}

/** Message unique quand le plafond est atteint (jamais un compteur inventé côté UI). */
export const SLOT_LIMIT_ERROR = `Limite atteinte : ${MAX_SCHEDULED_POLLS} sondages programmés en attente au maximum. Publication ou annulation d'un créneau pour libérer une place.`;

export interface ScheduledAtCheck {
    ok: boolean;
    error?: string;
}

/**
 * Bornes d'un instant de programmation. `now` est injectable : la règle est
 * testable sans horloge réelle.
 */
export function validateScheduledAt(at: Date | string, now: Date = new Date()): ScheduledAtCheck {
    const when = at instanceof Date ? at : new Date(at);
    if (Number.isNaN(when.getTime())) {
        return { ok: false, error: "Date de programmation invalide." };
    }

    const diffMinutes = (when.getTime() - now.getTime()) / 60_000;
    if (diffMinutes < MIN_LEAD_MINUTES) {
        return { ok: false, error: `La date doit être au moins ${MIN_LEAD_MINUTES} minutes dans le futur.` };
    }

    const diffDays = diffMinutes / (60 * 24);
    if (diffDays > MAX_HORIZON_DAYS) {
        return { ok: false, error: `La date ne peut pas dépasser ${MAX_HORIZON_DAYS} jours.` };
    }

    return { ok: true };
}

/**
 * Durée du vote réellement appliquée : celle du créneau si fournie, sinon la
 * durée par défaut des paramètres, sinon `null` (sondage « sans date », fermé
 * par le cron close-old-polls après 30 jours). Jamais une valeur hors bornes.
 */
export function resolveDurationHours(
    slotHours: number | null | undefined,
    defaultHours: number | null | undefined,
): number | null {
    const candidate = slotHours ?? defaultHours;
    if (candidate === null || candidate === undefined) return null;
    if (!Number.isFinite(candidate)) return null;
    return Math.min(MAX_DURATION_HOURS, Math.max(MIN_DURATION_HOURS, Math.round(candidate)));
}

/** Un créneau est-il encore « en attente » (il occupe une place) ? */
export function isPendingStatus(status: ScheduledPollStatus): boolean {
    return status === "SCHEDULED" || status === "PUBLISHING";
}
