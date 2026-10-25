/**
 * 🎓 **Fin d'essai** — règles pures (aucune I/O).
 *
 * Demande user du 25/10/2026 : « la fin d'essai est-elle basculée auto en essai validé ?
 * pourquoi pas un petit ajout côté settings salon avec envoi d'un embed fin d'essai pour
 * tel pseudo ? » → réponse : **aucune** validation automatique (une décision humaine), et
 * un embed publié **une seule fois** par membre quand l'échéance est passée.
 */

/** Un essai est **échu** quand une échéance existe, qu'elle est passée et qu'il n'est pas validé. */
export function isTrialEnded(input: {
    validated: boolean;
    endsAt: Date | string | null | undefined;
    now?: Date;
}): boolean {
    if (input.validated) return false;
    if (!input.endsAt) return false;

    const endsAt = input.endsAt instanceof Date ? input.endsAt : new Date(input.endsAt);
    if (Number.isNaN(endsAt.getTime())) return false;

    const now = input.now ?? new Date();
    return endsAt.getTime() <= now.getTime();
}

/**
 * Clé d'idempotence d'un embed de fin d'essai : un envoi par membre **et par échéance**
 * (reprogrammer l'essai réautorise donc un nouvel embed à la nouvelle date).
 */
export function trialEndNoticeKey(guildId: string, memberKey: string, endsAt: Date | string): string {
    const date = endsAt instanceof Date ? endsAt : new Date(endsAt);
    const day = Number.isNaN(date.getTime()) ? "unknown" : date.toISOString().slice(0, 10);
    return `trial-end:${guildId}:${memberKey}:${day}`;
}
