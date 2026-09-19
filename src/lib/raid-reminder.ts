/**
 * Rappel automatique des **raids** : ping des **inscrits**, 1 h avant le départ.
 * Module **pur** (aucune I/O) — toute la décision vit ici, donc testable.
 *
 * Demande user (19/09/2026) : « un ping qui ping uniquement les membres inscrits
 * (et pas les rôles mentionnés dans l'embed) 1 h avant un raid, un ping
 * automatique de rappel ».
 *
 * Trois invariants verrouillés par ce module :
 *  1. **Ping = inscrits uniquement.** `buildRaidReminderMentions` ne produit que
 *     des mentions d'UTILISATEURS (`<@id>`), à partir de snowflakes valides : aucun
 *     rôle, aucun `@everyone`. L'embed de publication peut, lui, mentionner des
 *     rôles (`metadata.mentionRoleIds`) — le rappel ne les reprend **jamais**.
 *     (Discord ne déclenche un ping que depuis le `content` du message, et
 *     `sendChannelMessage` n'autorise que les mentions qu'il y trouve.)
 *  2. **Un seul rappel par raid.** Marqueur `metadata.raidReminderSentAt` ; un
 *     rappel MANUEL récent (`lastRemindedAt`) met le rappel auto en silence.
 *  3. **Jamais hors fenêtre** : pas avant `notifyBefore` (défaut 60 min, borné
 *     5 min → 24 h), jamais une fois le raid commencé.
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
 * Faut-il envoyer le rappel automatique ? `reason` explique chaque refus (journal
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

/** Libellé humain du délai (« 45 min », « 1 h », « 1 h 30 »). */
export function raidReminderLeadLabel(leadMinutes: number): string {
    if (leadMinutes < 60) return `${leadMinutes} min`;
    const hours = Math.floor(leadMinutes / 60);
    const rest = leadMinutes % 60;
    if (rest === 0) return hours === 1 ? "1 h" : `${hours} h`;
    return `${hours} h ${rest}`;
}
