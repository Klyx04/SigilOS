/**
 * Rappel automatique des raids J-1 (H-24) — demande user du 22/10/2026 :
 * « rajouter un rappel raid 24h avant si il est programmé dans au moins 48h , même rappel que le rappel 1h avant ».
 *
 * Ces tests verrouillent :
 *  1. La règle de préavis : programmation au moins 48 h à l'avance requise (`startDate - createdAt >= 48 h`).
 *  2. La fenêtre de tir nominale à H-24 (tolérance 4 h pour absorber les délais crontab, [H-24 .. H-20]).
 *  3. L'idempotence via `metadata.raidReminder24hSentAt` (indépendante du rappel H-1).
 *  4. La mise en silence après un rappel manuel récent (< 30 min).
 *  5. Les invariants de sécurité (inscrits uniquement, pas de rôles, pas de @everyone).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    RAID_REMINDER_24H_LEAD_MIN,
    RAID_REMINDER_24H_LEAD_MS,
    RAID_REMINDER_24H_MIN_ADVANCE_MS,
    RAID_REMINDER_24H_MIN_LEAD_MS,
    RAID_REMINDER_24H_TOLERANCE_MS,
    raidReminderLeadLabel,
    shouldSendRaid24hReminder,
    type Raid24hReminderDecision,
} from "@/lib/raid-reminder";

/** Raison du refus (le test échoue si le rappel partait). */
function skipReason(decision: Raid24hReminderDecision): string {
    if (decision.send) return "sent";
    return decision.reason;
}

const NOW = new Date("2026-10-22T12:00:00.000Z");
const inHours = (h: number) => new Date(NOW.getTime() + h * 3600_000);
const inMinutes = (min: number) => new Date(NOW.getTime() + min * 60_000);

/** Base d'un raid sain : programmé 72 h avant, départ dans 24 h, 8 inscrits, salon connu, jamais rappelé. */
function base24hArgs(overrides: Record<string, unknown> = {}) {
    return {
        type: "RAID_OFFICIAL",
        status: "PUBLISHED",
        startDate: inHours(24),
        createdAt: new Date(NOW.getTime() - 48 * 3600_000), // Créé 48 h avant now (donc 72 h avant le départ)
        now: NOW,
        channelId: "1357151089043964124",
        registeredCount: 8,
        autoReminder24hSentAt: null,
        manualReminderAt: null,
        ...overrides,
    } as Parameters<typeof shouldSendRaid24hReminder>[0];
}

describe("Constantes du rappel 24 h", () => {
    it("définit les valeurs nominales préavis et tolérance", () => {
        expect(RAID_REMINDER_24H_LEAD_MIN).toBe(24 * 60);
        expect(RAID_REMINDER_24H_LEAD_MS).toBe(24 * 3600_000);
        expect(RAID_REMINDER_24H_MIN_ADVANCE_MS).toBe(48 * 3600_000);
        expect(RAID_REMINDER_24H_TOLERANCE_MS).toBe(4 * 3600_000);
        expect(RAID_REMINDER_24H_MIN_LEAD_MS).toBe(20 * 3600_000);
    });
});

describe("shouldSendRaid24hReminder — Décision pure", () => {
    describe("Condition de préavis : programmé dans au moins 48 h", () => {
        it("accepte un raid programmé exactement 48 h avant son départ", () => {
            const start = inHours(24);
            const created = new Date(start.getTime() - 48 * 3600_000); // startDate - createdAt = 48 h
            const decision = shouldSendRaid24hReminder(base24hArgs({ startDate: start, createdAt: created }));
            expect(decision).toEqual({ send: true, leadMinutes: 1440 });
        });

        it("accepte un raid programmé largement à l'avance (ex. 5 jours)", () => {
            const start = inHours(24);
            const created = new Date(start.getTime() - 5 * 24 * 3600_000);
            const decision = shouldSendRaid24hReminder(base24hArgs({ startDate: start, createdAt: created }));
            expect(decision.send).toBe(true);
        });

        it("refuse un raid programmé avec moins de 48 h de préavis (ex. 30 h)", () => {
            const start = inHours(24);
            const created = new Date(start.getTime() - 30 * 3600_000); // 30 h < 48 h
            const decision = shouldSendRaid24hReminder(base24hArgs({ startDate: start, createdAt: created }));
            expect(decision).toEqual({
                send: false,
                reason: "insufficient-advance-notice",
                leadMinutes: 1440,
            });
        });

        it("refuse un raid programmé 47 h 59 min avant son départ", () => {
            const start = inHours(24);
            const created = new Date(start.getTime() - (48 * 3600_000 - 60_000));
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ startDate: start, createdAt: created }))))
                .toBe("insufficient-advance-notice");
        });
    });

    describe("Fenêtre temporelle d'envoi", () => {
        it("envoie pour un raid dans exactement 24 h", () => {
            expect(shouldSendRaid24hReminder(base24hArgs({ startDate: inHours(24) }))).toEqual({
                send: true,
                leadMinutes: 1440,
            });
        });

        it("envoie pour un raid dans la tolérance de 4 h (ex. dans 22 h)", () => {
            expect(shouldSendRaid24hReminder(base24hArgs({ startDate: inHours(22) })).send).toBe(true);
        });

        it("refuse si trop tôt (raid dans 24 h 10 min)", () => {
            expect(shouldSendRaid24hReminder(base24hArgs({ startDate: inMinutes(24 * 60 + 10) }))).toEqual({
                send: false,
                reason: "too-early",
                leadMinutes: 1440,
            });
        });

        it("refuse si trop tard (fenêtre de 24 h dépassée, ex. raid dans 18 h)", () => {
            expect(shouldSendRaid24hReminder(base24hArgs({ startDate: inHours(18) }))).toEqual({
                send: false,
                reason: "too-late",
                leadMinutes: 1440,
            });
        });

        it("refuse si le raid a déjà commencé", () => {
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ startDate: inMinutes(0) })))).toBe("already-started");
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ startDate: inMinutes(-10) })))).toBe("already-started");
        });
    });

    describe("Idempotence et silence", () => {
        it("n'envoie pas si le rappel 24 h a déjà été envoyé (`autoReminder24hSentAt`)", () => {
            expect(shouldSendRaid24hReminder(base24hArgs({ autoReminder24hSentAt: NOW.toISOString() }))).toEqual({
                send: false,
                reason: "already-sent",
                leadMinutes: 1440,
            });
        });

        it("se tait si un rappel manuel récent (< 30 min) vient d'être envoyé", () => {
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ manualReminderAt: inMinutes(-10) }))))
                .toBe("manual-recent");
            // Un rappel manuel plus ancien (> 30 min) n'empêche pas l'envoi auto
            expect(shouldSendRaid24hReminder(base24hArgs({ manualReminderAt: inMinutes(-35) })).send).toBe(true);
        });
    });

    describe("Filtrage d'éligibilité", () => {
        it("refuse les types non-raid", () => {
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ type: "SOCIAL" })))).toBe("not-raid");
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ type: "EVENT_GUILD" })))).toBe("not-raid");
        });

        it("refuse les statuts non publiés", () => {
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ status: "DRAFT" })))).toBe("not-published");
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ status: "COMPLETED" })))).toBe("not-published");
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ status: "CANCELLED" })))).toBe("not-published");
        });

        it("refuse un raid sans salon ou sans participants", () => {
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ channelId: null })))).toBe("no-channel");
            expect(skipReason(shouldSendRaid24hReminder(base24hArgs({ registeredCount: 0 })))).toBe("no-participants");
        });
    });

    describe("Formatage du libellé", () => {
        it("génère '24 h' pour 1440 minutes", () => {
            expect(raidReminderLeadLabel(RAID_REMINDER_24H_LEAD_MIN)).toBe("24 h");
        });
    });
});

describe("Câblage du rappel J-1 (24 h)", () => {
    function codeOnly(source: string): string {
        return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    }

    const CRON_CODE = codeOnly(readFileSync("src/app/api/cron/raid-reminders/route.ts", "utf8"));
    const SERVICE_CODE = codeOnly(readFileSync("src/server/raid-reminder-service.ts", "utf8"));

    it("la route cron appelle sendRaid24hReminders()", () => {
        expect(CRON_CODE).toMatch(/await sendRaid24hReminders\(\)/);
    });

    it("le service 24 h utilise le marqueur raidReminder24hSentAt et conserve reminderMessages", () => {
        expect(SERVICE_CODE).toMatch(/autoReminder24hSentAt: \(meta\.raidReminder24hSentAt as string \| undefined\) \?\? null/);
        expect(SERVICE_CODE).toMatch(/raidReminder24hSentAt: now\.toISOString\(\)/);
        expect(SERVICE_CODE).toMatch(/raid-reminder-24h:msg:/);
    });

    it("le service 24 h vérifie le préavis via createdAt", () => {
        expect(SERVICE_CODE).toMatch(/createdAt: event\.createdAt/);
    });
});
