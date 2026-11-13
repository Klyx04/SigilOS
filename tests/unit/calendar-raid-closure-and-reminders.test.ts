/**
 * Tests unitaires des correctifs :
 * 1. Clôture & suppression des événements par le créateur ou administrateur.
 * 2. Rappel 1h & rappel manuel pingant l'organisateur / créateur (raids, donjons, quêtes, songes).
 * 3. File d'attente (isReserve) non bloquée par le don de kamas.
 * 4. Règle absolue du don de kamas : si raidRequireKamaDonation === false, zéro mention de kamas / don.
 * 5. Capping dynamique à <= 25 fields sur les embeds Discord.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const CALENDAR_ACTIONS = codeOnly(readFileSync("src/server/actions/calendar-actions.ts", "utf8"));
/** Purge partagée (actions + passe de fond) : c'est elle qui résout la clé outbox. */
const CALENDAR_CLEANUP = codeOnly(readFileSync("src/server/calendar-message-cleanup.ts", "utf8"));
const CALENDAR_SERVICE = codeOnly(readFileSync("src/server/calendar-service.ts", "utf8"));
const RAID_REMINDER_SERVICE = codeOnly(readFileSync("src/server/raid-reminder-service.ts", "utf8"));
const EVENT_REMINDER_SERVICE = codeOnly(readFileSync("src/server/event-reminder-service.ts", "utf8"));
const SONGES_REMINDER_SERVICE = codeOnly(readFileSync("src/server/songes-reminder-service.ts", "utf8"));
const DJ_REMINDER_SERVICE = codeOnly(readFileSync("src/server/dj-reminder-service.ts", "utf8"));

describe("1. Permissions de clôture, annulation et suppression par le créateur", () => {
    it("completeEvent permet au créateur ou à l'admin de clôturer son événement", () => {
        expect(CALENDAR_ACTIONS).toContain("const canComplete = ctx.isAdmin || ctx.canManageCalendar || event.creatorId === ctx.id");
        expect(CALENDAR_ACTIONS).toContain("eventMessageKey(eventId)");
    });

    it("completeRaidEvent permet au capitaine, à l'officier de raid, au créateur ou à l'admin de clôturer", () => {
        const raidFn = CALENDAR_ACTIONS.slice(CALENDAR_ACTIONS.indexOf("export async function completeRaidEvent"));
        // R1 (31/10/2026) : la clôture s'ouvre au **capitaine** (`metadata.raidCaptainId`) et à
        // l'**officier de raid** (`RAID_OFFICER` / `canManageRaid`) — jamais à un membre lambda :
        // la garde reste un refus par défaut, on vérifie l'expression exacte.
        expect(raidFn).toContain(
            "ctx.isAdmin || ctx.canManageCalendar || ctx.canManageRaid || event.creatorId === ctx.id || isRaidCaptain",
        );
        expect(raidFn).toContain("if (!canComplete)");
        expect(raidFn).toContain("return { success: false, error:");
        // L'embed du raid est supprimé par la purge partagée (déplacée le 25/10/2026 pour
        // être aussi utilisée par la passe de fond) : l'invariant « clé outbox résolue »
        // est vérifié sur son nouveau porteur, pas supprimé.
        expect(raidFn).toContain("deleteEventDiscordMessage({");
        expect(CALENDAR_CLEANUP).toContain("eventMessageKey(event.id)");
    });

    it("cancelCalendarEvent et deleteCalendarEvent permettent au créateur de supprimer/annuler", () => {
        expect(CALENDAR_ACTIONS).toContain("const canCancel = ctx.isAdmin || ctx.canManageCalendar || event.creatorId === ctx.id");
        expect(CALENDAR_ACTIONS).toContain("const canDelete = ctx.isAdmin || ctx.canManageCalendar || event.creatorId === ctx.id");
    });
});

describe("2. Rappels 1h et manuels pingeant le créateur / organisateur", () => {
    it("deliverRaidReminder (raids) inclut event.creatorId dans les cibles", () => {
        expect(RAID_REMINDER_SERVICE).toContain("event.creatorId");
        expect(RAID_REMINDER_SERVICE).toMatch(/targetUserIds.*event\.creatorId/);
    });

    it("deliverEventReminder (calendrier non-raid) inclut event.creatorId dans les cibles", () => {
        expect(EVENT_REMINDER_SERVICE).toContain("event.creatorId");
        expect(EVENT_REMINDER_SERVICE).toMatch(/targetUserIds.*event\.creatorId/);
    });

    it("sendSongesReminders inclut run.leaderId dans les cibles", () => {
        expect(SONGES_REMINDER_SERVICE).toContain("run.leaderId");
        expect(SONGES_REMINDER_SERVICE).toMatch(/targetUserIds.*run\.leaderId/);
    });

    it("dj-reminder-service inclut post.profile?.userId dans les cibles", () => {
        expect(DJ_REMINDER_SERVICE).toContain("post.profile?.userId");
        expect(DJ_REMINDER_SERVICE).toMatch(/targetUserIds.*post\.profile\?\.userId/);
    });

    it("sendEventReminder (rappel manuel calendrier) pinge inscrits + organisateur", () => {
        const manualReminderFn = CALENDAR_ACTIONS.slice(CALENDAR_ACTIONS.indexOf("export async function sendEventReminder"));
        expect(manualReminderFn).toContain("event.creatorId");
        expect(manualReminderFn).toMatch(/targetUserIds[\s\S]*event\.creatorId/);
    });
});

describe("3. File d'attente (isReserve) et règle des kamas désactivés", () => {
    it("processRegistration vérifie isReserve avant le Kamas gate et ne bloque pas la file d'attente", () => {
        const regFn = CALENDAR_SERVICE.slice(CALENDAR_SERVICE.indexOf("export async function processRegistration"));
        expect(regFn).toContain("if (!isReserve && guildConfig.raidRequireKamaDonation)");
    });

    it("reserveMessage ne mentionne pas les kamas si raidRequireKamaDonation est false", () => {
        const regFn = CALENDAR_SERVICE.slice(CALENDAR_SERVICE.indexOf("export async function processRegistration"));
        expect(regFn).toContain("guildConfig.raidRequireKamaDonation");
        expect(regFn).toContain("Tu seras automatiquement prévenu si une place se libère.");
    });

    it("publishDiscordEvent et refreshDiscordEventEmbed n'ajoutent pas reserveNote sur les kamas si raidRequireKamaDonation est false", () => {
        expect(CALENDAR_SERVICE).toContain("isRaid && guildConfig.raidRequireKamaDonation");
    });

    it("completeRaidEvent ne déduit aucun Kamas Violet si raidRequireKamaDonation est false", () => {
        const raidFn = CALENDAR_ACTIONS.slice(CALENDAR_ACTIONS.indexOf("export async function completeRaidEvent"));
        expect(raidFn).toContain("requireKamas ? ((guildConfig.raidKamaDonationThreshold ?? 3) * 10) : 0");
    });
});

describe("4. Discord Embeds max 25 fields", () => {
    it("publishDiscordEvent et refreshDiscordEventEmbed calculent maxDispatchGroups dynamiquement", () => {
        expect(CALENDAR_SERVICE).toContain("const maxDispatchGroups = Math.max(1, 24 - fields.length)");
    });
});
