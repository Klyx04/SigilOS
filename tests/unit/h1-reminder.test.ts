/**
 * Rappel auto H-1 des posts datés (`@/lib/h1-reminder`) — DJ/quêtes (targetDate)
 * et Songes (scheduledAt). Demande user du 28/09/2026.
 *
 * Invariants : sans date (post indéfini) → jamais de ping ; un seul ping par
 * échéance ; silence après rappel manuel ; jamais hors fenêtre.
 */

import { describe, it, expect } from "vitest";
import { SCHEDULED_H1_LEAD_MIN, shouldSendScheduledH1Reminder } from "@/lib/h1-reminder";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const inMinutes = (min: number) => new Date(NOW.getTime() + min * 60_000);

function baseArgs(overrides: Record<string, unknown> = {}) {
    return {
        date: inMinutes(60),
        now: NOW,
        channelId: "1357151089043964124",
        participantCount: 4,
        autoSentAt: null,
        manualAt: null,
        open: true,
        ...overrides,
    } as Parameters<typeof shouldSendScheduledH1Reminder>[0];
}

describe("shouldSendScheduledH1Reminder", () => {
    it("applique 1 h par défaut", () => {
        expect(SCHEDULED_H1_LEAD_MIN).toBe(60);
        expect(shouldSendScheduledH1Reminder(baseArgs())).toEqual({ send: true, leadMinutes: 60 });
    });

    it("ne pinge jamais un post sans date (planif indéfinie)", () => {
        expect(shouldSendScheduledH1Reminder(baseArgs({ date: null }))).toEqual({
            send: false,
            reason: "no-date",
            leadMinutes: 60,
        });
        expect(shouldSendScheduledH1Reminder(baseArgs({ date: undefined }))).toMatchObject({
            send: false,
            reason: "no-date",
        });
    });

    it("n'envoie qu'une fois par échéance, et se tait après un rappel manuel récent", () => {
        expect(shouldSendScheduledH1Reminder(baseArgs({ autoSentAt: NOW.toISOString() }))).toMatchObject({
            send: false,
            reason: "already-sent",
        });
        expect(
            shouldSendScheduledH1Reminder(baseArgs({ manualAt: inMinutes(-5) }))
        ).toMatchObject({ send: false, reason: "manual-recent" });
        expect(shouldSendScheduledH1Reminder(baseArgs({ manualAt: inMinutes(-45) })).send).toBe(true);
    });

    it("jamais trop tôt, jamais après le début, jamais sans salon ni inscrit", () => {
        expect(shouldSendScheduledH1Reminder(baseArgs({ date: inMinutes(61) }))).toMatchObject({
            send: false,
            reason: "too-early",
        });
        expect(shouldSendScheduledH1Reminder(baseArgs({ date: inMinutes(0) }))).toMatchObject({
            send: false,
            reason: "already-started",
        });
        expect(shouldSendScheduledH1Reminder(baseArgs({ channelId: null }))).toMatchObject({
            send: false,
            reason: "no-channel",
        });
        expect(shouldSendScheduledH1Reminder(baseArgs({ participantCount: 0 }))).toMatchObject({
            send: false,
            reason: "no-participants",
        });
        expect(shouldSendScheduledH1Reminder(baseArgs({ open: false }))).toMatchObject({
            send: false,
            reason: "not-open",
        });
    });
});
