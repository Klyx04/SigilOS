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

/**
 * Durée de la clé d'idempotence **durable** (90 jours).
 *
 * Elle n'est écrite qu'**après** un envoi réussi : la poser avant rendait un crash pendant
 * l'envoi définitif (le membre n'était plus jamais notifié pour cette échéance).
 */
export const TRIAL_END_NOTICE_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * Verrou d'envoi **court** (5 min) : deux crons concurrents ne doublent pas l'embed, et un
 * processus tué pendant l'envoi libère la place au passage suivant au lieu de bloquer 90 j.
 */
export const TRIAL_END_LOCK_TTL_SECONDS = 5 * 60;

/** Clé du verrou court dérivée de la clé d'idempotence. */
export function trialEndLockKey(noticeKey: string): string {
    return `${noticeKey}:lock`;
}

export interface TrialEndNoticeInput {
    displayName: string;
    /** Échéance déjà formatée pour le staff (le fuseau reste à l'appelant). */
    endsAtLabel: string;
    /**
     * Le membre a un **profil dashboard** (par opposition à une simple ligne de registre) :
     * c'est le seul état binaire demandé par le staff dans l'embed.
     */
    hasDashboardProfile: boolean;
    scope: string;
    /** Mentions de rôles staff (déjà résolues depuis `rolesMapping`), jamais un id en dur. */
    staffMentions?: string;
}

export interface TrialEndNotice {
    title: string;
    description: string;
    color: number;
}

/**
 * Contenu de l'embed « fin d'essai » — **source unique**, testable sans Discord.
 *
 * L'embed ne valide jamais rien : il signale l'échéance et dit qui doit trancher.
 */
export function buildTrialEndNotice(input: TrialEndNoticeInput): TrialEndNotice {
    return {
        title: "⏳ Fin d'essai",
        description: [
            ...(input.staffMentions ? [input.staffMentions] : []),
            `**Membre :** ${input.displayName}`,
            `**Échéance :** ${input.endsAtLabel}`,
            `**Dashboard :** ${
                input.hasDashboardProfile ? "🟢 Présent sur le dashboard" : "🔴 Pas de compte dashboard"
            }`,
            `**Source :** ${input.scope}`,
            "",
            "L'essai n'est **pas** validé automatiquement : le staff tranche (valider ou reprogrammer).",
        ].join("\n"),
        color: 0xf59e0b,
    };
}
