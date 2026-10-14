/**
 * Présence Discord — règle pure (onglet Discord du ladder).
 *
 * Intention produit : voir qui vit sur le Discord (voix croisées en vocal,
 * silencieux à inviter) — **jamais un blâme**. Les seuils sont publics et
 * affichés dans l'interface, pas devinés.
 *
 * Données d'entrée : compteurs EXISTANTS de `UserProfile` (aucune migration) —
 * `discordVoiceTimeWeekly/Total`, totaux messages/caractères/réponses/réactions
 * reçues/stream, `lastDiscordMessageAt/VoiceAt/ReactionAt`.
 *
 * Limites honnêtes (rappelées en interface) : semaine = mardi 07:00 → mardi
 * (reset du bot), minutes arrondies (`< 1 min` invisible), membres jamais
 * connectés au dashboard non mesurés (`0` ambigu — d'où le libellé « mesurée »).
 */

/** Minutes de vocal hebdo à partir desquelles on est « habitué ». Seuil affiché en UI. */
export const HABITUE_VOICE_MINUTES_WEEKLY = 60;

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

export const DISCORD_PRESENCE_FILTER_LABELS: Record<DiscordPresenceFilter, string> = {
    all: "Toute présence",
    habitue: "Habitués du vocal",
    enVocal: "En vocal cette semaine",
    sansVocal: "Sans vocal cette semaine",
    jamaisEnVocal: "Jamais en vocal",
    sansInteraction: "Sans interaction",
};

export type PresenceCounters = {
    voiceWeekly: number;
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
 * Profil unique d'un membre (priorité : silencieux > habitué > de passage > discret).
 * Un badge neutre, pas un blâme : « Discret » et « Silencieux » invitent à
 * aller vers le membre, jamais à le punir.
 */
export function resolveDiscordPresenceProfile(c: PresenceCounters): DiscordPresenceProfile {
    if (hasNoInteraction(c)) return "silencieux";
    if (num(c.voiceWeekly) >= HABITUE_VOICE_MINUTES_WEEKLY) return "habitue";
    if (num(c.voiceWeekly) > 0) return "present";
    return "discret";
}

/** Le membre passe-t-il le filtre de présence choisi (inconnu → `all`, fail-soft) ? */
export function matchPresenceFilter(
    c: PresenceCounters,
    filter: string | null | undefined
): boolean {
    switch (filter) {
        case "habitue":
            return num(c.voiceWeekly) >= HABITUE_VOICE_MINUTES_WEEKLY;
        case "enVocal":
            return num(c.voiceWeekly) > 0;
        case "sansVocal":
            return num(c.voiceWeekly) === 0;
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

/** Agrège les compteurs d'une guilde (zéro division, zéro hypothèse). */
export function computeDiscordPresenceStats(counters: PresenceCounters[]): DiscordPresenceStats {
    let enVocal = 0;
    let habitues = 0;
    let jamaisEnVocal = 0;
    let sansInteraction = 0;
    for (const c of counters) {
        if (num(c.voiceWeekly) > 0) enVocal += 1;
        if (num(c.voiceWeekly) >= HABITUE_VOICE_MINUTES_WEEKLY) habitues += 1;
        if (neverVoiced(c)) jamaisEnVocal += 1;
        if (hasNoInteraction(c)) sansInteraction += 1;
    }
    return { total: counters.length, enVocal, habitues, jamaisEnVocal, sansInteraction };
}
