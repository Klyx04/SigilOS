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

/**
 * Durées de vote **proposées** dans les deux modales de création (sondage
 * classique et sondage programmé) : la question « combien de temps le vote reste
 * ouvert » se répond d'un clic, jamais dans un champ libre à remplir.
 *
 * Les quatre valeurs restent dans `MIN_DURATION_HOURS`..`MAX_DURATION_HOURS`
 * (un preset hors bornes serait un bug affiché, pas une décision) : le verrou de
 * test le vérifie, comme il vérifie que les deux modales tirent leurs durées
 * d'ici — une seule source.
 */
export const DURATION_PRESETS = [
    { hours: 24, label: "24h", emoji: "⏳" },
    { hours: 48, label: "48h", emoji: "⌛" },
    { hours: 168, label: "7j", emoji: "📅" },
    { hours: 720, label: "30j", emoji: "📆" },
] as const;

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

export interface DurationChoice {
    hours: number;
    label: string;
    emoji: string;
}

/**
 * Choix affichés sous le réglage « Expiration » : les presets, **plus la valeur
 * courante** quand elle n'en fait pas partie.
 *
 * Pourquoi : la durée par défaut de la guilde (ou celle d'un créneau déjà
 * enregistré) est libre — elle peut valoir 12 h. Sans cette ligne, l'écran
 * afficherait « expiration activée » sans aucun choix surligné : on croirait
 * qu'aucune durée n'est posée alors que le serveur en applique une. On ne
 * remplace **jamais** une valeur par un preset — on la montre. La valeur
 * affichée passe par `resolveDurationHours` : jamais hors bornes, jamais un
 * libellé inventé (`12.4 h`).
 */
export function durationChoices(currentHours?: number | null): DurationChoice[] {
    const presets: DurationChoice[] = DURATION_PRESETS.map((preset) => ({ ...preset }));
    const current = resolveDurationHours(currentHours, null);
    if (current === null || presets.some((preset) => preset.hours === current)) return presets;
    return [...presets, { hours: current, label: `${current}h`, emoji: "⏱️" }]
        .sort((a, b) => a.hours - b.hours);
}

/** Un créneau est-il encore « en attente » (il occupe une place) ? */
/**
 * Fin de vote d'une occurrence de **série récurrente** : `now + durationHours`,
 * **jamais au-delà du déclenchement suivant**.
 *
 * Pourquoi : une série peut demander une durée de vote plus longue que son
 * intervalle (« tous les jours » avec un vote de 48 h). Sans ce plafond, deux
 * sondages de la même série resteraient ouverts en même temps, et le second
 * chasserait le premier sans que son résultat soit lisible. La clôture de
 * l'occurrence précédente est faite par le moteur au moment de publier la
 * suivante ; ce plafond est la **seconde ceinture** : la fin de vote annoncée
 * sur Discord et la clôture quotidienne (`close-old-polls`) tombent à la bonne
 * seconde même si la série s'arrête entre-temps.
 *
 * `durationHours` nul ⇒ aucune fin de vote (comportement historique : clôture
 * par le cron après 30 jours).
 */
export function expiryForOccurrence(
    now: Date,
    durationHours: number | null,
    nextScheduledAt?: Date | null,
): Date | null {
    if (!durationHours) return null;
    const natural = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    if (!nextScheduledAt) return natural;
    return nextScheduledAt.getTime() < natural.getTime() ? nextScheduledAt : natural;
}

/** Un créneau est-il encore « en attente » (il occupe une place) ? */
export function isPendingStatus(status: ScheduledPollStatus): boolean {
    return status === "SCHEDULED" || status === "PUBLISHING";
}

// ============================================================================
// Récurrence — « tous les N jours / semaines / mois », avec une fin facultative
// ============================================================================

export type ScheduledRepeatUnit = "DAYS" | "WEEKS" | "MONTHS";

/** Intervalle maximal d'une répétition (au-delà, ce n'est plus une série). */
export const MAX_REPEAT_EVERY = 90;
/** Horizon maximal d'une fin de répétition (un an, jamais « pour toujours » en base). */
export const MAX_REPEAT_UNTIL_DAYS = 365;
/** Nombre d'occurrences montrées dans l'aperçu du formulaire. */
export const REPEAT_PREVIEW_COUNT = 3;

/**
 * Occurrence suivante d'une série.
 *
 * ⚠️ **Heure locale, jamais UTC** : « chaque dimanche 21 h » doit rester 21 h
 * après le changement d'heure — un calcul en UTC glisserait d'une heure en
 * hiver. On avance donc sur les composantes locales (`setDate`/`setMonth`),
 * exactement comme un calendrier.
 *
 * ⚠️ Le cas des **mois** est l'autre piège : le 31 janvier + 1 mois n'existe pas
 * en février ⇒ on **plafonne au dernier jour du mois visé** (28 ou 29 février),
 * comme le font les calendriers. Jamais un report au 2 ou 3 mars.
 * L'heure et la minute d'origine sont conservées telles quelles.
 */
export function nextOccurrence(date: Date, every: number, unit: ScheduledRepeatUnit): Date {
    const step = Math.max(1, Math.round(every));
    const next = new Date(date.getTime());

    if (unit === "DAYS") {
        next.setDate(next.getDate() + step);
        return next;
    }
    if (unit === "WEEKS") {
        next.setDate(next.getDate() + step * 7);
        return next;
    }

    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + step);
    const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDayOfTargetMonth));
    return next;
}

export interface RepeatRule {
    every: number | null | undefined;
    unit: ScheduledRepeatUnit | null | undefined;
    until?: Date | string | null;
}

/** Libellé FR d'une répétition (« chaque semaine », « tous les 3 mois »…), ou `null`. */
export function repeatLabel(rule: RepeatRule): string | null {
    const every = rule.every == null ? null : Math.max(1, Math.round(rule.every));
    if (!every || !rule.unit) return null;

    if (every === 1) {
        if (rule.unit === "DAYS") return "chaque jour";
        if (rule.unit === "WEEKS") return "chaque semaine";
        return "chaque mois";
    }
    if (rule.unit === "DAYS") return `tous les ${every} jours`;
    if (rule.unit === "WEEKS") return `toutes les ${every} semaines`;
    return `tous les ${every} mois`;
}

/**
 * Occurrences **vraiment programmables** à partir de `from` : la première est le
 * créneau lui-même, les suivantes sont calculées tant qu'elles ne dépassent pas
 * `until` (si fourni). Sert à l'aperçu du formulaire **et** au moteur (qui ne
 * crée que la suivante).
 */
export function repeatOccurrences(rule: RepeatRule & { from: Date | string }, count = REPEAT_PREVIEW_COUNT): Date[] {
    const every = rule.every == null ? null : Math.max(1, Math.round(rule.every));
    if (!every || !rule.unit) return [];

    const until = rule.until ? (rule.until instanceof Date ? rule.until : new Date(rule.until)) : null;
    const untilTime = until && !Number.isNaN(until.getTime()) ? until.getTime() : null;

    let current = rule.from instanceof Date ? rule.from : new Date(rule.from);
    if (Number.isNaN(current.getTime())) return [];

    const out: Date[] = [];
    for (let i = 0; i < count; i++) {
        const next = nextOccurrence(current, every, rule.unit);
        if (untilTime !== null && next.getTime() > untilTime) break;
        out.push(next);
        current = next;
    }
    return out;
}

/** Bornes de saisie d'une fin de répétition (message unique, jamais recopié). */
export const REPEAT_EVERY_ERROR = `Intervalle invalide : de 1 à ${MAX_REPEAT_EVERY}.`;
export const REPEAT_UNTIL_ERROR = `La fin de répétition ne peut pas dépasser ${MAX_REPEAT_UNTIL_DAYS} jours.`;
