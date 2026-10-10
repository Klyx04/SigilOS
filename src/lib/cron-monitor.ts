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
