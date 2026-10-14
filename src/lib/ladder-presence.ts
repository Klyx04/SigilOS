/**
 * Présence Discord — règle pure (onglet Discord du ladder).
 *
 * Intention produit : voir qui vit sur le Discord (voix croisées en vocal,
 * silencieux à inviter) — **jamais un blâme**. Les seuils sont publics et
 * affichés dans l'interface, pas devinés.
 *
 * La présence suit la PÉRIODE choisie (semaine / mois en cours / global) :
 * même filtre, même statistique, champ et seuil adaptés. « Jamais en vocal »
 * et « Sans interaction » restent absolus (cumul + horodatages), quelle que
 * soit la période.
 *
 * Données d'entrée : compteurs EXISTANTS de `UserProfile` (aucune migration) —
 * `discordVoiceTimeWeekly/Monthly/Total`, totaux messages/caractères/réponses/
 * réactions reçues/stream, `lastDiscordMessageAt/VoiceAt/ReactionAt`.
 *
 * Limites honnêtes (rappelées en interface) : semaine = mardi 07:00 → mardi
 * (reset du bot), mois = 1er → aujourd'hui, minutes arrondies (`< 1 min`
 * invisible), remise à zéro destructive (période passée irrécupérable),
 * membres jamais connectés au dashboard non mesurés (`0` ambigu — d'où le
 * libellé « mesurée »).
 */

export type PresencePeriod = "weekly" | "monthly" | "alltime";

export const PRESENCE_PERIOD_LABELS: Record<PresencePeriod, string> = {
    weekly: "cette semaine",
    monthly: "ce mois-ci",
    alltime: "au total",
};

/** Seuil « habitué » par période (minutes de vocal mesurées). Affiché en UI. */
export const HABITUE_VOICE_MINUTES_WEEKLY = 60;
export const HABITUE_VOICE_MINUTES_MONTHLY = 240;
export const HABITUE_VOICE_MINUTES_ALLTIME = 480;

export function habitueThreshold(period: PresencePeriod): number {
    if (period === "monthly") return HABITUE_VOICE_MINUTES_MONTHLY;
    if (period === "alltime") return HABITUE_VOICE_MINUTES_ALLTIME;
    return HABITUE_VOICE_MINUTES_WEEKLY;
}

/** « 60 » → « 1 h », « 240 » → « 4 h » — tel qu'affiché dans l'interface. */
export function formatThreshold(minutes: number): string {
    if (minutes % 60 === 0) return `${minutes / 60} h`;
    return `${minutes} min`;
}

export type DiscordPresenceProfile = "habitue" | "present" | "discret" | "silencieux";

export const DISCORD_PRESENCE_LABELS: Record<DiscordPresenceProfile, string> = {
    habitue: "Habitué du vocal",
    present: "De passage",
    discret: "Discret",
    silencieux: "Silencieux",
};

export type DiscordPresenceFilter =
    | "all"
    | "habitue"
    | "enVocal"
    | "sansVocal"
    | "jamaisEnVocal"
    | "sansInteraction";

/** Libellés du filtre adaptés à la période (« En vocal ce mois-ci », …). */
export function presenceFilterLabels(period: PresencePeriod): Record<DiscordPresenceFilter, string> {
    const when = PRESENCE_PERIOD_LABELS[period];
    return {
        all: "Toute présence",
        habitue: "Habitués du vocal",
        enVocal: `En vocal ${when}`,
        sansVocal: `Sans vocal ${when}`,
        jamaisEnVocal: "Jamais en vocal",
        sansInteraction: "Sans interaction",
    };
}

export type PresenceCounters = {
    voiceWeekly: number;
    voiceMonthly: number;
    voiceTotal: number;
    messagesTotal: number;
    charactersTotal: number;
    repliesTotal: number;
    reactionsReceivedTotal: number;
    streamTotal: number;
    lastMessageAt: string | Date | null;
    lastVoiceAt: string | Date | null;
    lastReactionAt: string | Date | null;
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Minutes de vocal mesurées sur la période choisie. */
export function voiceInPeriod(c: PresenceCounters, period: PresencePeriod): number {
    if (period === "monthly") return num(c.voiceMonthly);
    if (period === "alltime") return num(c.voiceTotal);
    return num(c.voiceWeekly);
}

/** Vrai si AUCUNE interaction Discord n'a jamais été mesurée pour ce membre. */
export function hasNoInteraction(c: PresenceCounters): boolean {
    return (
        num(c.voiceTotal) === 0 &&
        num(c.messagesTotal) === 0 &&
        num(c.charactersTotal) === 0 &&
        num(c.repliesTotal) === 0 &&
        num(c.reactionsReceivedTotal) === 0 &&
        num(c.streamTotal) === 0 &&
        !c.lastMessageAt &&
        !c.lastVoiceAt &&
        !c.lastReactionAt
    );
}

/** Vrai si le vocal n'a JAMAIS été mesuré (ni minutes totales, ni venue). */
export function neverVoiced(c: PresenceCounters): boolean {
    return num(c.voiceTotal) === 0 && !c.lastVoiceAt;
}

/**
 * Profil unique d'un membre sur la période (priorité : silencieux > habitué >
 * de passage > discret). Un badge neutre, pas un blâme.
 */
export function resolveDiscordPresenceProfile(
    c: PresenceCounters,
    period: PresencePeriod = "weekly"
): DiscordPresenceProfile {
    if (hasNoInteraction(c)) return "silencieux";
    if (voiceInPeriod(c, period) >= habitueThreshold(period)) return "habitue";
    if (voiceInPeriod(c, period) > 0) return "present";
    return "discret";
}

/** Le membre passe-t-il le filtre choisi sur la période (inconnu → `all`, fail-soft) ? */
export function matchPresenceFilter(
    c: PresenceCounters,
    filter: string | null | undefined,
    period: PresencePeriod = "weekly"
): boolean {
    switch (filter) {
        case "habitue":
            return voiceInPeriod(c, period) >= habitueThreshold(period);
        case "enVocal":
            return voiceInPeriod(c, period) > 0;
        case "sansVocal":
            return voiceInPeriod(c, period) === 0;
        case "jamaisEnVocal":
            return neverVoiced(c);
        case "sansInteraction":
            return hasNoInteraction(c);
        default:
            return true;
    }
}

export type DiscordPresenceStats = {
    total: number;
    enVocal: number;
    habitues: number;
    jamaisEnVocal: number;
    sansInteraction: number;
};

/** Agrège les compteurs d'une guilde sur la période (zéro division, zéro hypothèse). */
export function computeDiscordPresenceStats(
    counters: PresenceCounters[],
    period: PresencePeriod = "weekly"
): DiscordPresenceStats {
    let enVocal = 0;
    let habitues = 0;
    let jamaisEnVocal = 0;
    let sansInteraction = 0;
    for (const c of counters) {
        if (voiceInPeriod(c, period) > 0) enVocal += 1;
        if (voiceInPeriod(c, period) >= habitueThreshold(period)) habitues += 1;
        if (neverVoiced(c)) jamaisEnVocal += 1;
        if (hasNoInteraction(c)) sansInteraction += 1;
    }
    return { total: counters.length, enVocal, habitues, jamaisEnVocal, sansInteraction };
}

/**
 * Transparence : la règle exacte d'un filtre, en une phrase (infobulle).
 * Une seule source — l'interface la consomme, jamais l'inverse.
 */
export function describePresenceFilter(filter: DiscordPresenceFilter, period: PresencePeriod): string {
    const threshold = formatThreshold(habitueThreshold(period));
    const when = PRESENCE_PERIOD_LABELS[period];
    switch (filter) {
        case "habitue":
            return `Au moins ${threshold} de vocal mesuré ${when}.`;
        case "enVocal":
            return `Au moins une minute de vocal mesurée ${when}.`;
        case "sansVocal":
            return `Aucune minute de vocal mesurée ${when}.`;
        case "jamaisEnVocal":
            return "Aucun vocal jamais mesuré (ni minutes totales, ni venue).";
        case "sansInteraction":
            return "Aucune interaction Discord jamais mesurée : aucun message, caractère, réponse, minute de vocal, stream ou réaction reçue, et aucun horodatage d'activité (message, vocal, réaction).";
        default:
            return "Tous les membres actifs, quel que soit leur profil.";
    }
}

/** Transparence : la règle exacte d'un badge, en une phrase (infobulle). */
export function describePresenceProfile(profile: DiscordPresenceProfile, period: PresencePeriod): string {
    const threshold = formatThreshold(habitueThreshold(period));
    const when = PRESENCE_PERIOD_LABELS[period];
    switch (profile) {
        case "habitue":
            return `Au moins ${threshold} de vocal mesuré ${when} — on le croise souvent.`;
        case "present":
            return `Du vocal mesuré ${when}, sous le seuil habitué (${threshold}).`;
        case "discret":
            return `Pas de vocal ${when}, mais présent autrement — à inviter, pas à blâmer.`;
        default:
            return "Aucune interaction Discord mesurée — à accueillir, pas à punir.";
    }
}
