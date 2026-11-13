/**
 * Rappel automatique des **raids** : ping des **inscrits**, 1 h avant le départ (H-1)
 * et 24 h avant (J-1 si le raid a été programmé au moins 48 h à l'avance).
 * Module **pur** (aucune I/O) — toute la décision vit ici, donc testable.
 *
 * Demande user (19/09/2026) : « un ping qui ping uniquement les membres inscrits
 * (et pas les rôles mentionnés dans l'embed) 1 h avant un raid, un ping
 * automatique de rappel ».
 *
 * Demande user (22/10/2026) : « rajouter un rappel raid 24h avant si il est programmé
 * dans au moins 48h , même rappel que le rappel 1h avant ».
 *
 * Trois invariants verrouillés par ce module :
 *  1. **Ping = inscrits uniquement.** `buildRaidReminderMentions` ne produit que
 *     des mentions d'UTILISATEURS (`<@id>`), à partir de snowflakes valides : aucun
 *     rôle, aucun `@everyone`. L'embed de publication peut, lui, mentionner des
 *     rôles (`metadata.mentionRoleIds`) — le rappel ne les reprend **jamais**.
 *     (Discord ne déclenche un ping que depuis le `content` du message, et
 *     `sendChannelMessage` n'autorise que les mentions qu'il y trouve.)
 *  2. **Un seul rappel par type de jalon.** Marqueurs `metadata.raidReminder24hSentAt`
 *     (J-1) et `metadata.raidReminderSentAt` (H-1) ; un rappel MANUEL récent (`lastRemindedAt`)
 *     met le rappel auto en silence.
 *  3. **Jamais hors fenêtre** : pas avant le délai (24 h pour J-1, `notifyBefore` pour H-1),
 *     jamais une fois le raid commencé.
 */

import { isDiscordSnowflake } from "@/lib/discord-ids";

/** Délai par défaut avant le raid quand `GuildEvent.notifyBefore` est vide. */
export const RAID_REMINDER_DEFAULT_LEAD_MIN = 60;
/** Bornes du délai : en-dessous c'est inutile, au-dessus c'est du bruit. */
export const RAID_REMINDER_MIN_LEAD_MIN = 5;
export const RAID_REMINDER_MAX_LEAD_MIN = 24 * 60;
/** Silence après un rappel MANUEL : évite le doublon ping manuel + ping auto. */
export const RAID_REMINDER_MANUAL_MUTE_MS = 30 * 60 * 1000;
/** Bornes du ping (Discord : 2000 caractères de `content`). */
export const RAID_REMINDER_MAX_MENTIONS = 80;
export const RAID_REMINDER_MAX_MENTION_CHARS = 1800;

export type RaidReminderSkipReason =
    | "not-raid"
    | "not-published"
    | "no-channel"
    | "no-participants"
    | "already-sent"
    | "manual-recent"
    | "too-early"
    | "already-started"
    | "no-discord-account";

export type RaidReminderDecision =
    | { send: true; leadMinutes: number }
    | { send: false; reason: RaidReminderSkipReason; leadMinutes: number };

/** Délai de rappel assaini (minutes) : entier borné, repli 60 min. */
export function resolveRaidReminderLeadMinutes(raw: unknown): number {
    const n = typeof raw === "string" ? Number.parseInt(raw, 10) : (raw as number);
    if (!Number.isFinite(n)) return RAID_REMINDER_DEFAULT_LEAD_MIN;
    const minutes = Math.floor(n);
    if (minutes < RAID_REMINDER_MIN_LEAD_MIN) return RAID_REMINDER_MIN_LEAD_MIN;
    if (minutes > RAID_REMINDER_MAX_LEAD_MIN) return RAID_REMINDER_MAX_LEAD_MIN;
    return minutes;
}

/**
 * Faut-il envoyer le rappel automatique H-1 ? `reason` explique chaque refus (journal
 * du cron + télémétrie God), `leadMinutes` est le délai appliqué.
 */
export function shouldSendRaidReminder(args: {
    type: string;
    status: string;
    startDate: Date;
    now: Date;
    notifyBefore: number | null | undefined;
    /** Salon où poster le rappel (embed publié ou salon raid configuré). */
    channelId: string | null | undefined;
    /** Inscrits (REGISTERED + CONFIRMED) : sans personne, aucun ping à envoyer. */
    registeredCount: number;
    /** `metadata.raidReminderSentAt` : le rappel auto est déjà parti. */
    autoReminderSentAt?: string | Date | null;
    /** `lastRemindedAt` : dernier rappel (souvent MANUEL, écran du dashboard). */
    manualReminderAt?: Date | null;
}): RaidReminderDecision {
    const leadMinutes = resolveRaidReminderLeadMinutes(args.notifyBefore);

    if (args.type !== "RAID_OFFICIAL") return { send: false, reason: "not-raid", leadMinutes };
    if (args.status !== "PUBLISHED") return { send: false, reason: "not-published", leadMinutes };
    if (!args.channelId) return { send: false, reason: "no-channel", leadMinutes };
    if (args.registeredCount === 0) return { send: false, reason: "no-participants", leadMinutes };
    if (args.autoReminderSentAt) return { send: false, reason: "already-sent", leadMinutes };

    if (args.manualReminderAt) {
        const sinceManual = args.now.getTime() - new Date(args.manualReminderAt).getTime();
        if (sinceManual >= 0 && sinceManual < RAID_REMINDER_MANUAL_MUTE_MS) {
            return { send: false, reason: "manual-recent", leadMinutes };
        }
    }

    const msUntilStart = args.startDate.getTime() - args.now.getTime();
    if (msUntilStart <= 0) return { send: false, reason: "already-started", leadMinutes };
    if (msUntilStart > leadMinutes * 60 * 1000) return { send: false, reason: "too-early", leadMinutes };

    return { send: true, leadMinutes };
}

// ---------------------------------------------------------------------------
// RAPPEL J-1 (H-24) — pour les raids programmés au moins 48 h à l'avance
// ---------------------------------------------------------------------------
/** Délai nominal du rappel 24 h avant le départ (en minutes). */
export const RAID_REMINDER_24H_LEAD_MIN = 24 * 60;
/** Délai nominal en millisecondes (24 h). */
export const RAID_REMINDER_24H_LEAD_MS = RAID_REMINDER_24H_LEAD_MIN * 60 * 1000;
/** Préavis minimum requis entre la programmation (createdAt) et le départ (48 h). */
export const RAID_REMINDER_24H_MIN_ADVANCE_MS = 48 * 60 * 60 * 1000;
/** Fenêtre de tolérance pour le tir du rappel 24 h (4 h : entre H-24 et H-20). */
export const RAID_REMINDER_24H_TOLERANCE_MS = 4 * 60 * 60 * 1000;
export const RAID_REMINDER_24H_MIN_LEAD_MS = RAID_REMINDER_24H_LEAD_MS - RAID_REMINDER_24H_TOLERANCE_MS;

export type Raid24hReminderSkipReason =
    | "not-raid"
    | "not-published"
    | "no-channel"
    | "no-participants"
    | "already-sent"
    | "manual-recent"
    | "too-early"
    | "too-late"
    | "insufficient-advance-notice"
    | "already-started";

export type Raid24hReminderDecision =
    | { send: true; leadMinutes: number }
    | { send: false; reason: Raid24hReminderSkipReason; leadMinutes: number };

/**
 * Faut-il envoyer le rappel automatique J-1 (24 h avant le raid) ?
 * Règle demandée (22/10/2026) :
 *  - Uniquement pour les raids programmés au moins 48 h à l'avance (startDate - createdAt >= 48 h).
 *  - Fenêtre de tir à H-24 (tolérance 4 h pour absorber les délais de crontab).
 *  - Idempotent via `metadata.raidReminder24hSentAt` (indépendant du rappel H-1).
 */
export function shouldSendRaid24hReminder(args: {
    type: string;
    status: string;
    startDate: Date;
    createdAt: Date;
    now: Date;
    channelId: string | null | undefined;
    registeredCount: number;
    autoReminder24hSentAt?: string | Date | null;
    manualReminderAt?: Date | null;
}): Raid24hReminderDecision {
    const leadMinutes = RAID_REMINDER_24H_LEAD_MIN;

    if (args.type !== "RAID_OFFICIAL") return { send: false, reason: "not-raid", leadMinutes };
    if (args.status !== "PUBLISHED") return { send: false, reason: "not-published", leadMinutes };
    if (!args.channelId) return { send: false, reason: "no-channel", leadMinutes };
    if (args.registeredCount === 0) return { send: false, reason: "no-participants", leadMinutes };
    if (args.autoReminder24hSentAt) return { send: false, reason: "already-sent", leadMinutes };

    if (args.manualReminderAt) {
        const sinceManual = args.now.getTime() - new Date(args.manualReminderAt).getTime();
        if (sinceManual >= 0 && sinceManual < RAID_REMINDER_MANUAL_MUTE_MS) {
            return { send: false, reason: "manual-recent", leadMinutes };
        }
    }

    const msUntilStart = args.startDate.getTime() - args.now.getTime();
    if (msUntilStart <= 0) return { send: false, reason: "already-started", leadMinutes };

    const scheduledAdvanceMs = args.startDate.getTime() - args.createdAt.getTime();
    if (scheduledAdvanceMs < RAID_REMINDER_24H_MIN_ADVANCE_MS) {
        return { send: false, reason: "insufficient-advance-notice", leadMinutes };
    }

    if (msUntilStart > RAID_REMINDER_24H_LEAD_MS) return { send: false, reason: "too-early", leadMinutes };
    if (msUntilStart < RAID_REMINDER_24H_MIN_LEAD_MS) return { send: false, reason: "too-late", leadMinutes };

    return { send: true, leadMinutes };
}

/**
 * Contenu du ping : uniquement `<@id>` des inscrits, dédupliqué, borné.
 * Un identifiant non-snowflake (compte Discord non lié, valeur corrompue) est
 * **écarté** : jamais de mention cassée qui pingue n'importe qui.
 */
export function buildRaidReminderMentions(discordIds: (string | null | undefined)[]): string {
    const seen = new Set<string>();
    const mentions: string[] = [];
    let length = 0;

    for (const id of discordIds) {
        if (mentions.length >= RAID_REMINDER_MAX_MENTIONS) break;
        if (!isDiscordSnowflake(id) || seen.has(id)) continue;
        const mention = `<@${id}>`;
        if (length + mention.length + 1 > RAID_REMINDER_MAX_MENTION_CHARS) break;
        seen.add(id);
        mentions.push(mention);
        length += mention.length + 1;
    }

    return mentions.join(" ");
}

/** Champs `GuildConfig` nécessaires au choix du salon. */
export type RaidChannelConfig = {
    raidNotifyChannelId?: string | null;
    raidGigalodonNotifyChannelId?: string | null;
    raidSanctuaireNotifyChannelId?: string | null;
    calendarNotifyChannelId?: string | null;
};

/**
 * Salon du rappel : celui de l'**embed** du raid s'il est connu (c'est là que les
 * inscrits ont cliqué), sinon le salon configuré pour ce type de raid
 * (« Gouffre du Gigalodon » / « Jardins Éternels »), sinon le salon raid.
 */
export function pickRaidReminderChannelId(config: RaidChannelConfig, raidType: unknown): string | null {
    const kind = typeof raidType === "string" ? raidType : "";
    if (kind === "gigalodon") return config.raidGigalodonNotifyChannelId || config.raidNotifyChannelId || null;
    if (kind === "jardin") return config.raidSanctuaireNotifyChannelId || config.raidNotifyChannelId || null;
    return config.raidNotifyChannelId || null;
}

/** Libellé humain du délai (« 45 min », « 1 h », « 1 h 30 », « 24 h »). */
export function raidReminderLeadLabel(leadMinutes: number): string {
    if (leadMinutes < 60) return `${leadMinutes} min`;
    const hours = Math.floor(leadMinutes / 60);
    const rest = leadMinutes % 60;
    if (rest === 0) return hours === 1 ? "1 h" : `${hours} h`;
    return `${hours} h ${rest}`;
}

// ---------------------------------------------------------------------------
// RAPPEL DE CLÔTURE (post-raid) — 24 h après la fin, UNE seule fois
// ---------------------------------------------------------------------------
// Demande user (30/09/2026) : après un raid, plus rien n'existe côté SigilOS — si le
// capitaine oublie de clôturer (présents + score → XP/Kamas), personne ne le relance
// jamais. Ce rappel est le SEUL message post-raid : le lead actuel est pingé, jamais
// les inscrits, jamais un rôle, jamais `@everyone` (même invariant que le rappel H-1).

/** Âge minimum d'un raid terminé avant le rappel de clôture (24 h). */
export const RAID_CLOSURE_REMINDER_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * Âge maximum : au-delà, la passe de fond a déjà clôturé le raid
 * (`RAID_AUTO_CLOSE_DELAY_MS` = 48 h, `@/lib/calendar-auto-close`). Cette borne garde
 * aussi le scan du cron borné (aucun historique complet relu à chaque passe).
 */
export const RAID_CLOSURE_REMINDER_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type RaidClosureSkipReason =
    | "not-raid"
    | "not-published"
    | "no-channel"
    | "already-sent"
    | "too-early"
    | "too-old";

export type RaidClosureDecision =
    | { send: true; ageMinutes: number }
    | { send: false; reason: RaidClosureSkipReason; ageMinutes: number };

/**
 * Faut-il envoyer le rappel de clôture ? `reason` explique chaque refus (journal du
 * cron + télémétrie God), `ageMinutes` alimente le message (« terminé il y a 24 h »).
 *
 * Idempotent par `metadata.closureReminderSentAt` : si une passe est perdue (Discord
 * lent, cron en retard), la suivante reprend le raid tant qu'il n'est pas clôturé.
 */
export function shouldSendRaidClosureReminder(args: {
    type: string;
    status: string;
    endDate: Date;
    now: Date;
    /** Salon où poster le rappel (embed du raid, sinon salon raid configuré). */
    channelId: string | null | undefined;
    /** `metadata.closureReminderSentAt` : le rappel de clôture est déjà parti. */
    closureReminderSentAt?: string | Date | null;
}): RaidClosureDecision {
    const ageMs = args.now.getTime() - args.endDate.getTime();
    const ageMinutes = Math.max(0, Math.round(ageMs / 60000));

    if (args.type !== "RAID_OFFICIAL") return { send: false, reason: "not-raid", ageMinutes };
    if (args.status !== "PUBLISHED") return { send: false, reason: "not-published", ageMinutes };
    if (!args.channelId) return { send: false, reason: "no-channel", ageMinutes };
    if (args.closureReminderSentAt) return { send: false, reason: "already-sent", ageMinutes };
    if (ageMs < RAID_CLOSURE_REMINDER_AGE_MS) return { send: false, reason: "too-early", ageMinutes };
    if (ageMs > RAID_CLOSURE_REMINDER_MAX_AGE_MS) return { send: false, reason: "too-old", ageMinutes };

    return { send: true, ageMinutes };
}
