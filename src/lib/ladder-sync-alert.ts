/**
 * Règle PURE de l'alerte « Ladder General/Succès Sync » (cron `/api/cron/ladder-sync`).
 *
 * Mesure du 02/10/2026 (bêta, table `GodNotification`, 90 j) : **17 des 34 alertes**
 * « Ladder General/Succès Sync » étaient **vertes alors que des profils avaient échoué**
 * (`metadata.fail_count > 0`) — la moitié. Cause : la route posait
 * `success: results.some(r => r.success)`, donc « vert dès qu'un seul profil passe ».
 * En plus, le message ne disait **ni qui** avait échoué **ni pourquoi** (motif capturé
 * mais jamais affiché) → alerte **inactionnable**.
 *
 * Ici, tout est pur et testé : la couleur dit la vérité (`vert ⇔ aucun échec`), le
 * message liste les échecs (borné), et les champs d'embed sont en **français**.
 */

export type LadderSyncResult = {
    pseudo: string;
    success: boolean;
    /** Motif métier (ex. « Not found on ladder »). */
    reason?: string;
    /** Erreur technique éventuelle (déjà stringifiée par l'appelant). */
    error?: string;
};

export type LadderSyncFailure = { pseudo: string; reason: string };

export type LadderSyncSummary = {
    batchSize: number;
    successCount: number;
    failCount: number;
    failures: LadderSyncFailure[];
    /** **Vert uniquement si AUCUN échec** — la couleur ne doit jamais mentir. */
    allSucceeded: boolean;
};

/** Nombre maximal d'échecs détaillés dans le message (le reste est résumé). */
export const LADDER_SYNC_MAX_LISTED_FAILURES = 5;

function failureReason(result: LadderSyncResult): string {
    const raw = result.reason ?? result.error ?? "raison inconnue";
    const trimmed = String(raw).trim();
    return trimmed.length > 0 ? trimmed : "raison inconnue";
}

/** Réduit la liste des résultats bruts en un résumé exploitable (pur). */
export function summarizeLadderSync(results: LadderSyncResult[]): LadderSyncSummary {
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success).map((r) => ({ pseudo: r.pseudo, reason: failureReason(r) }));
    return {
        batchSize: results.length,
        successCount: successes.length,
        failCount: failures.length,
        failures,
        allSucceeded: failures.length === 0,
    };
}

/** Message humain : l'état, puis la liste bornée des échecs. */
export function buildLadderSyncMessage(summary: LadderSyncSummary): string {
    const head = summary.allSucceeded
        ? `Synchronisation ladder : ${summary.successCount}/${summary.batchSize} profils à jour.`
        : `Synchronisation ladder : ${summary.successCount}/${summary.batchSize} profils à jour — ${summary.failCount} échec(s) à regarder.`;
    if (summary.failures.length === 0) return head;

    const shown = summary.failures.slice(0, LADDER_SYNC_MAX_LISTED_FAILURES);
    const lines = shown.map((f) => `• ${f.pseudo} — ${f.reason}`);
    const remaining = summary.failures.length - shown.length;
    if (remaining > 0) lines.push(`• … et ${remaining} autre(s).`);
    return `${head}\n${lines.join("\n")}`;
}

/** Champs d'embed en français (fin du jargon `success_count` / `fail_count`). */
export function buildLadderSyncFields(summary: LadderSyncSummary): { name: string; value: string; inline?: boolean }[] {
    return [
        { name: "Profils traités", value: String(summary.batchSize), inline: true },
        { name: "À jour", value: String(summary.successCount), inline: true },
        { name: "Échecs", value: String(summary.failCount), inline: true },
    ];
}
