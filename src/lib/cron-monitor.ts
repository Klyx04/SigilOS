/**
 * Surveillance des tâches automatiques (crons) — **règle pure, zéro effet de bord**.
 *
 * 🐛 Besoin mesuré le 11/10/2026 : **aucun** des 25 crons n'était surveillé. Le panneau God
 * sait déjà dire « cette tâche a échoué » (Redis, `cron-telemetry`), mais **rien ne dit
 * « cette tâche ne tourne plus du tout »** — exactement le trou de l'incident du 06/10 :
 * aucune alerte, aucune trace, on l'a découvert par un utilisateur.
 *
 * 🎯 **Pourquoi ici et pas dans les 25 routes** : toutes les routes `/api/cron/*` appellent
 * `recordCronExecution()` (vérifié : 25/25). Le branchement se fait donc **une seule fois**
 * (cf. `cron-telemetry.ts`) : toute route future qui passe par là est surveillée d'office,
 * impossible d'en oublier une.
 *
 * 🔒 **Pourquoi une cadence « à peu près », jamais une heure précise** : Sentry sait exiger
 * « tous les jours à 04h00 » (crontab), mais l'heure dépend du **fuseau** du VPS — un écart
 * d'une heure suffirait à déclencher une **fausse alerte**. On décrit donc la cadence en
 * **intervalle** (`1 jour`, `10 minutes`), déduite du libellé **déjà déclaré** dans
 * `KNOWN_CRON_TASKS` (celui que God affiche) : la question posée est « est-ce que ça tourne
 * encore ? », pas « est-ce que c'est parti pile à 04h00 ? ».
 *
 * ⚠️ Conséquence voulue : Sentry crée le moniteur au **premier** check-in reçu. Une tâche
 * qui n'a **jamais** tourné ne crée donc **aucun** moniteur — pas de fausse alerte pour une
 * ligne de crontab absente (constaté dans la doc : deux tâches n'avaient aucune ligne).
 */

export type CronMonitorSchedule =
    | { type: "crontab"; value: string }
    | { type: "interval"; value: number; unit: "minute" | "hour" | "day" | "week" };

/** Configuration de surveillance envoyée à Sentry avec chaque check-in. */
export interface CronMonitorConfig {
    schedule: CronMonitorSchedule;
    /** Marge (minutes) après l'échéance avant que Sentry crie « manqué ». */
    checkinMargin: number;
    /** Durée (minutes) au-delà de laquelle une exécution est considérée bloquée. */
    maxRuntime: number;
}

/**
 * Marge volontairement large : on veut apprendre qu'une tâche **s'arrête**, pas qu'elle a
 * dix minutes de retard (un VPS chargé, un redéploiement, et l'alerte part).
 */
export const CRON_CHECKIN_MARGIN_MINUTES = 30;
/** Les crons de ce dépôt répondent en quelques minutes ; 15 est déjà généreux. */
export const CRON_MAX_RUNTIME_MINUTES = 15;

/**
 * Cadence Sentry déduite du libellé lisible de `KNOWN_CRON_TASKS`.
 *
 * Format **attendu** (c'est celui du dépôt) : `Toutes les N min`, `Toutes les Nh`,
 * `Quotidien …`, `Mardi …`, `Dimanches …`, `Hebdo …`, `Dans maintenance …`.
 * Un libellé non reconnu rend `null` ⇒ **pas de moniteur** (on ne surveille pas au hasard),
 * et le test de couverture casse dès qu'une tâche sans cadence reconnaissable est ajoutée.
 */
export function cronMonitorScheduleFromLabel(label: string): CronMonitorSchedule | null {
    const text = String(label ?? "").trim();
    if (!text) return null;

    // « Toutes les 10 min » (avec ou sans suffixe : « … (garde-fou fréquence God) »).
    const everyMinutes = text.match(/toutes les\s+(\d+)\s*min/i);
    if (everyMinutes) return { type: "interval", value: Number(everyMinutes[1]), unit: "minute" };

    // « Toutes les 12h »
    const everyHours = text.match(/toutes les\s+(\d+)\s*h/i);
    if (everyHours) return { type: "interval", value: Number(everyHours[1]), unit: "hour" };

    // Hebdomadaire : « Mardi 08h00 », « Dimanches 04h15 (UTC) », « Hebdo dimanches 05h00 ».
    if (/hebdo|mardi|dimanche|semaine/i.test(text)) return { type: "interval", value: 1, unit: "week" };

    // Quotidien — « Quotidien 04h00 » et « Dans maintenance 04h00 » (lancé par la passe du jour).
    if (/quotidien|maintenance|jour/i.test(text)) return { type: "interval", value: 1, unit: "day" };

    return null;
}

/** Configuration complète, ou `null` si la cadence n'est pas exploitable. */
export function cronMonitorConfigFor(label: string): CronMonitorConfig | null {
    const schedule = cronMonitorScheduleFromLabel(label);
    if (!schedule) return null;
    return {
        schedule,
        checkinMargin: CRON_CHECKIN_MARGIN_MINUTES,
        maxRuntime: CRON_MAX_RUNTIME_MINUTES,
    };
}

/**
 * Payload d'un check-in (« je viens de tourner »). **Pur** : l'identifiant unique exigé par
 * le protocole Sentry est ajouté par l'appelant (effet de bord = côté serveur).
 */
export function buildCronCheckIn(
    cronId: string,
    result: { success: boolean; durationMs?: number | null }
): { monitorSlug: string; status: "ok" | "error"; duration?: number } {
    const ms = result.durationMs;
    const duration = typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? ms / 1000 : undefined;
    return {
        monitorSlug: cronId,
        status: result.success ? "ok" : "error",
        ...(duration !== undefined ? { duration } : {}),
    };
}

/**
 * 🕰️ **Tâche muette** — « cette tâche ne tourne plus » (constat user du 12/10/2026).
 *
 * 🐛 Mesure du 12/10/2026 : **23 des 25 moniteurs Sentry sont désactivés** — plafond
 * d'abonnement, message officiel : « *A check-in was sent but dropped due to the monitor being
 * disabled* » ⇒ les check-ins sont **jetés** et **aucune alerte ne partira jamais** de ce côté.
 * Le panneau God « Tâches CRON » connaît pourtant la **dernière exécution** de chaque tâche
 * (télémétrie Redis) *et* sa **cadence déclarée** (`KNOWN_CRON_TASKS`) : comparer les deux suffit
 * à crier quand une tâche s'arrête — **sans aucune dépendance** à un quota externe.
 *
 * 🔒 On ne crie jamais au hasard :
 *  • cadence non reconnue (`Automatique`) ⇒ **aucune** alerte ;
 *  • tâche qui n'a **jamais** tourné ⇒ **aucune** alerte (ligne de crontab absente = cas connu,
 *    et le panneau affiche déjà « Jamais »).
 * Seuil = **double** de la cadence + la marge déjà utilisée côté Sentry (30 min) : une tâche
 * quotidienne n'est muette qu'après ~2 jours, une tâche de 10 min après ~50 min.
 */
export const CRON_SILENT_FACTOR = 2;

export interface CronStaleness {
    /** Vrai seulement si la tâche a **déjà** tourné **et** dépasse le seuil. */
    silent: boolean;
    /** Cadence attendue, en minutes (`null` : libellé non exploitable ⇒ jamais d'alerte). */
    expectedMinutes: number | null;
    /** Minutes écoulées depuis la dernière exécution (`null` : jamais tourné). */
    elapsedMinutes: number | null;
    /** Seuil appliqué, en minutes (`null` : pas de seuil). */
    thresholdMinutes: number | null;
}

const MINUTES_PER_UNIT = { minute: 1, hour: 60, day: 24 * 60, week: 7 * 24 * 60 } as const;

/** Verdict de silence d'une tâche — **pur** (aucune IO, `now` injectable). */
export function cronStaleness(
    scheduleLabel: string,
    lastRunIso: string | null | undefined,
    now: Date = new Date()
): CronStaleness {
    const schedule = cronMonitorScheduleFromLabel(scheduleLabel);
    const expectedMinutes =
        schedule?.type === "interval" ? schedule.value * MINUTES_PER_UNIT[schedule.unit] : null;
    if (!expectedMinutes) {
        return { silent: false, expectedMinutes: null, elapsedMinutes: null, thresholdMinutes: null };
    }

    const thresholdMinutes = expectedMinutes * CRON_SILENT_FACTOR + CRON_CHECKIN_MARGIN_MINUTES;
    const last = lastRunIso ? new Date(lastRunIso).getTime() : Number.NaN;
    if (!Number.isFinite(last)) {
        return { silent: false, expectedMinutes, elapsedMinutes: null, thresholdMinutes };
    }

    const elapsedMinutes = Math.max(0, (now.getTime() - last) / 60_000);
    return {
        silent: elapsedMinutes > thresholdMinutes,
        expectedMinutes,
        elapsedMinutes,
        thresholdMinutes,
    };
}
