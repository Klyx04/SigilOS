/**
 * Métriques des crons — **une seule façon de dire « N éléments, les voici »**.
 *
 * Mesure du 18/10/2026 : chaque cron coupait ses listes **avant** d'émettre l'alerte
 * (cartes Dofensive `slice(0, 10)`, erreurs `slice(0, 5)`, boss en erreur `slice(0, 20)`),
 * et certains n'envoyaient que des clés techniques (`localDungeons`, `success_count`).
 * Conséquence : ni la fiche persistée (`GodNotification.details`, lot C1) ni le journal
 * des tâches (lot C2) ne pouvaient récupérer ce qui avait été jeté.
 *
 * Ici, on **garde tout** jusqu'à un plafond explicite, et le reste est **dit** (`(+N)`).
 * L'embed Discord reste borné par la projection du lot C1 — jamais par une coupe muette
 * décidée dans chaque route.
 */

/** Plafond par défaut d'une liste de métrique (au-delà, la perte est dite). */
export const CRON_METRICS_MAX_LIST = 200;

export type CronMetricList = {
    /** Éléments conservés, dans l'ordre fourni. */
    shown: string[];
    /** Éléments au-delà du plafond (jamais silencieux). */
    hidden: number;
    /** Rendu texte : « a, b, c … (+N autre(s)) ». */
    text: string;
};

/**
 * Borne une liste de métrique en gardant l'ordre et en disant ce qui manque.
 * Les valeurs vides sont retirées (une entrée vide n'apprend rien).
 */
export function boundCronList(
    values: readonly unknown[],
    max: number = CRON_METRICS_MAX_LIST,
): CronMetricList {
    const normalized = values
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0);

    if (normalized.length === 0) {
        return { shown: [], hidden: 0, text: "" };
    }

    const limit = Math.max(1, Math.trunc(max));
    const shown = normalized.slice(0, limit);
    const hidden = normalized.length - shown.length;

    return {
        shown,
        hidden,
        text: hidden > 0 ? `${shown.join(", ")} … (+${hidden} autre(s))` : shown.join(", "),
    };
}
