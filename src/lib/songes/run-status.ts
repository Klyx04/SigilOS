/**
 * Songes — l'état d'une run, en **une seule** règle.
 *
 * Constat mesuré le 05/11/2026 : le test « la run est-elle ouverte ? » était recopié
 * dans trois actions (`processRunJoin`, `updateRunCandidateClass`, `sendJoinRequest`)
 * et toutes répondaient « Cette run n'accepte plus de candidatures » — y compris pour
 * une run **archivée automatiquement**, que l'utilisateur ne voit même plus sur le
 * site. Le message ne disait donc pas la vraie cause.
 *
 * Le calendrier d'inactivité vivait, lui, dans une cascade de `if/else` du cron
 * (J+7 / J+15 / J+20 / J+21), impossible à tester sans base. Il est ici, pur.
 *
 * Aucune dépendance : ni Prisma, ni Discord, ni Next.
 */

/** Statuts pendant lesquels une run accepte encore des candidatures. */
export const RUN_OPEN_STATUSES = ["RECRUITING", "IN_PROGRESS"] as const;

/** Vrai si la run accepte encore des candidatures. */
export function isRunOpen(status: string | null | undefined): boolean {
    return status === "RECRUITING" || status === "IN_PROGRESS";
}

/**
 * Refus d'une candidature, **par cause** — jamais un message générique.
 * Utilisé par le service Discord et par l'action du dashboard : une seule formulation.
 */
export function runJoinRefusal(status: string | null | undefined): string {
    switch (status) {
        case "ABANDONED":
            return "Cette run a été archivée automatiquement après inactivité : elle n'accepte plus de candidatures.";
        case "COMPLETED":
            return "Cette run est terminée : elle n'accepte plus de candidatures.";
        case "FAILED":
            return "Cette run a échoué : elle n'accepte plus de candidatures.";
        default:
            return "Cette run n'accepte plus de candidatures.";
    }
}

/**
 * Refus court affiché dans Discord (bouton ou modale), **sans** le préfixe ❌.
 * `null` = la run accepte encore les interactions (aucun refus à opposer).
 */
export function runInteractionRefusal(status: string | null | undefined): string | null {
    if (isRunOpen(status)) return null;
    switch (status) {
        case "ABANDONED":
            return "Cette run a été archivée automatiquement : elle n'accepte plus d'interactions.";
        case "COMPLETED":
            return "Cette run est terminée.";
        case "FAILED":
            return "Cette run a échoué.";
        default:
            return "Cette run n'accepte plus d'interactions.";
    }
}

/** Paliers des rappels d'inactivité d'une run Songes, en jours. */
export const SONGES_REMINDER_DAYS = [7, 15, 20] as const;

/** Jour de la clôture automatique (après les trois rappels). */
export const SONGES_CLOSE_AFTER_DAYS = 21;

/** Délai minimal entre deux écritures du cron sur une même run (heures). */
export const SONGES_REMINDER_COOLDOWN_HOURS = 24;

export type SongesReminderStep = 1 | 2 | 3 | "close" | null;

/**
 * Décide ce que le cron doit faire d'une run inactive.
 *
 * - **Trois rappels avant toute clôture** (`reminderCount >= 3`) : jamais de disparition
 *   muette — c'était le défaut du worker `daily-cleanup`, qui abandonnait à J+3 ;
 * - clôture à **J+21 d'inactivité réelle** (et non « J+21 depuis le dernier rappel » :
 *   le cron écrivait `lastReminderAt`, ce qui avance `DreamRun.updatedAt` et repoussait
 *   chaque palier de plusieurs jours) ;
 * - **cooldown de 24 h** entre deux écritures : un second passage du cron le même jour
 *   ne doit pas brûler un rappel ;
 * - **stand-by** : aucun rappel, aucune clôture (la run est en pause).
 *
 * Un rattrapage reste sûr : une run très en retard reçoit d'abord son rappel 1, puis les
 * suivants aux passages quotidien suivants — elle n'est jamais close sans ses 3 rappels.
 */
export function resolveSongesReminderStep(input: {
    daysSinceActivity: number;
    reminderCount: number;
    hoursSinceLastReminder?: number;
    standBy?: boolean;
}): SongesReminderStep {
    if (input.standBy) return null;
    if ((input.hoursSinceLastReminder ?? Number.POSITIVE_INFINITY) < SONGES_REMINDER_COOLDOWN_HOURS) {
        return null;
    }

    const days = Math.max(0, Math.floor(input.daysSinceActivity));
    const reminders = Math.max(0, Math.floor(input.reminderCount));

    if (reminders >= 3 && days >= SONGES_CLOSE_AFTER_DAYS) return "close";
    if (reminders === 2 && days >= SONGES_REMINDER_DAYS[2]) return 3;
    if (reminders === 1 && days >= SONGES_REMINDER_DAYS[1]) return 2;
    if (reminders === 0 && days >= SONGES_REMINDER_DAYS[0]) return 1;
    return null;
}
