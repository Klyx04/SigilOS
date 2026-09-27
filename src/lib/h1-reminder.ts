/**
 * Rappel auto H-1 des posts datés (DJ/quêtes, Songes) — module **pur**.
 *
 * Même contrat que `shouldSendRaidReminder`, mais pour des posts qui portent
 * une date optionnelle (`DjSearchPost.targetDate`, `DreamRun.scheduledAt`) :
 *  - sans date (post indéfini) → jamais de ping auto (`no-date`) ;
 *  - un seul ping par échéance (`autoSentAt`) ;
 *  - silence 30 min après un rappel manuel (`lastManualAt`).
 */

import { RAID_REMINDER_MANUAL_MUTE_MS } from "@/lib/raid-reminder";

export type ScheduledH1SkipReason =
    | "no-date"
    | "no-channel"
    | "no-participants"
    | "already-sent"
    | "manual-recent"
    | "too-early"
    | "already-started"
    | "not-open";

export type ScheduledH1Decision =
    | { send: true; leadMinutes: number }
    | { send: false; reason: ScheduledH1SkipReason; leadMinutes: number };

/** Délai H-1 fixe des posts DJ/Songes (pas de `notifyBefore` sur ces modèles). */
export const SCHEDULED_H1_LEAD_MIN = 60;

export function shouldSendScheduledH1Reminder(args: {
    date: Date | null | undefined;
    now: Date;
    channelId: string | null | undefined;
    participantCount: number;
    autoSentAt?: string | Date | null;
    manualAt?: Date | null;
    open: boolean;
    leadMinutes?: number;
}): ScheduledH1Decision {
    const leadMinutes = args.leadMinutes ?? SCHEDULED_H1_LEAD_MIN;
    if (!args.open) return { send: false, reason: "not-open", leadMinutes };
    if (!args.date) return { send: false, reason: "no-date", leadMinutes };
    if (!args.channelId) return { send: false, reason: "no-channel", leadMinutes };
    if (args.participantCount === 0) return { send: false, reason: "no-participants", leadMinutes };
    if (args.autoSentAt) return { send: false, reason: "already-sent", leadMinutes };

    if (args.manualAt) {
        const sinceManual = args.now.getTime() - new Date(args.manualAt).getTime();
        if (sinceManual >= 0 && sinceManual < RAID_REMINDER_MANUAL_MUTE_MS) {
            return { send: false, reason: "manual-recent", leadMinutes };
        }
    }

    const msUntilStart = new Date(args.date).getTime() - args.now.getTime();
    if (msUntilStart <= 0) return { send: false, reason: "already-started", leadMinutes };
    if (msUntilStart > leadMinutes * 60 * 1000) return { send: false, reason: "too-early", leadMinutes };

    return { send: true, leadMinutes };
}
