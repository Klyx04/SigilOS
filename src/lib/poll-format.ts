/**
 * Sondages — mise en forme de l'**échéance** (règle pure, testable).
 *
 * Pourquoi une règle unique : l'information « fin de vote » était rendue à **quatre** endroits
 * avec quatre comportements différents (fiche : heure seule **et masquée dès que le sondage est
 * clos** ; carte : temps restant ; liste : deux compteurs JS ; embed Discord : horodatage relatif
 * `<t:…:R>`), d'où le retour utilisateur du 13/10/2026 : « on ne le voit plus… date de fin ».
 *
 * Ici : **la même** date de fin, absolue (jour + heure) **et** relative, que le sondage soit en
 * direct ou clôturé — l'écart est calculé sur des instants, donc indépendant du fuseau.
 */

export interface PollEndLabel {
    /** « 16 oct. 2026 à 21:30 » (heure locale du lecteur). */
    absolute: string;
    /** « dans 3 jours » / « il y a 2 mois » / « à l'instant ». */
    relative: string;
    /** L'échéance est déjà passée. */
    expired: boolean;
}

/** Écart en minutes → « 3 jours », « 2 mois »… (jamais négatif, jamais vide). */
function humanizeMinutes(minutes: number): string {
    if (minutes < 1) return "moins d'une minute";
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} heure${hours > 1 ? "s" : ""}`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} jour${days > 1 ? "s" : ""}`;
    const months = Math.floor(days / 30);
    return `${months} mois`;
}

/**
 * Libellé d'échéance d'un sondage, ou `null` s'il n'y a pas de date de fin valide.
 * `now` est injectable : la règle est testable sans horloge réelle.
 */
export function formatPollEnd(
    expiresAt: Date | string | null | undefined,
    now: Date = new Date()
): PollEndLabel | null {
    if (!expiresAt) return null;
    const end = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (Number.isNaN(end.getTime())) return null;

    const absolute = `${end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} à ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

    const diffMs = end.getTime() - now.getTime();
    const minutes = Math.round(Math.abs(diffMs) / 60000);
    const expired = diffMs <= 0;
    const duration = humanizeMinutes(minutes);

    return {
        absolute,
        relative: minutes < 1 ? "à l'instant" : expired ? `il y a ${duration}` : `dans ${duration}`,
        expired,
    };
}
