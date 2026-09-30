/**
 * Rappel de clôture de raid — règle pure + câblage (demande user du 30/09/2026).
 *
 * Constat : **rien n'existait en post-raid**. Si le capitaine oubliait de clôturer
 * (présents + score → XP/Kamas), le raid restait ouvert sans que personne ne soit
 * relancé. Ces tests verrouillent :
 *  ① la règle pure `shouldSendRaidClosureReminder` (24 h après la fin, une seule fois) ;
 *  ② le câblage : le ping ne touche QUE le capitaine actuel (`creatorId`) — jamais les
 *     inscrits, jamais un rôle, jamais `@everyone` ;
 *  ③ la réutilisation de la tâche `raid-reminders` (aucune ligne de crontab en plus).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    RAID_CLOSURE_REMINDER_AGE_MS,
    RAID_CLOSURE_REMINDER_MAX_AGE_MS,
    shouldSendRaidClosureReminder,
} from "@/lib/raid-reminder";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-01T12:00:00.000Z");
const SERVICE_CODE = codeOnly(readFileSync("src/server/raid-reminder-service.ts", "utf8"));
const CRON_CODE = codeOnly(readFileSync("src/app/api/cron/raid-reminders/route.ts", "utf8"));

/** Partie « rappel de clôture » du service (le rappel H-1 garde son propre contrat). */
const closureStart = SERVICE_CODE.indexOf("async function deliverRaidClosureReminder");
if (closureStart === -1) throw new Error("partie « rappel de clôture » introuvable dans le service");
const CLOSURE_CODE = SERVICE_CODE.slice(closureStart);

const base = {
    type: "RAID_OFFICIAL",
    status: "PUBLISHED",
    now: NOW,
    channelId: "123456789012345678",
};

describe("shouldSendRaidClosureReminder — 24 h après la fin, une seule fois", () => {
    it("envoie pour un raid terminé depuis 24 h et rend l'âge pour le message", () => {
        const decision = shouldSendRaidClosureReminder({
            ...base,
            endDate: new Date(NOW.getTime() - RAID_CLOSURE_REMINDER_AGE_MS),
        });
        expect(decision.send).toBe(true);
        if (decision.send) expect(decision.ageMinutes).toBe(24 * 60);
    });

    it("refuse trop tôt (raid à peine terminé)", () => {
        expect(shouldSendRaidClosureReminder({ ...base, endDate: new Date(NOW.getTime() - HOUR) })).toEqual({
            send: false,
            reason: "too-early",
            ageMinutes: 60,
        });
    });

    it("refuse trop vieux : au-delà de 48 h, la passe de fond a déjà clôturé le raid", () => {
        expect(
            shouldSendRaidClosureReminder({
                ...base,
                endDate: new Date(NOW.getTime() - RAID_CLOSURE_REMINDER_MAX_AGE_MS - HOUR),
            })
        ).toMatchObject({ send: false, reason: "too-old" });
        expect(RAID_CLOSURE_REMINDER_MAX_AGE_MS).toBe(48 * HOUR);
    });

    it("jamais de rappel sur un raid clôturé, un non-raid, un salon inconnu ou un rappel déjà parti", () => {
        const endDate = new Date(NOW.getTime() - RAID_CLOSURE_REMINDER_AGE_MS);
        expect(shouldSendRaidClosureReminder({ ...base, status: "COMPLETED", endDate })).toMatchObject({
            send: false,
            reason: "not-published",
        });
        expect(shouldSendRaidClosureReminder({ ...base, type: "EVENT_GUILD", endDate })).toMatchObject({
            send: false,
            reason: "not-raid",
        });
        expect(shouldSendRaidClosureReminder({ ...base, channelId: null, endDate })).toMatchObject({
            send: false,
            reason: "no-channel",
        });
        expect(
            shouldSendRaidClosureReminder({
                ...base,
                endDate,
                closureReminderSentAt: "2026-09-30T12:00:00.000Z",
            })
        ).toMatchObject({ send: false, reason: "already-sent" });
    });
});

describe("Service — le rappel de clôture ne ping QUE le capitaine actuel", () => {
    it("résout le lead depuis `creatorId` (donc le nouveau capitaine après transfert)", () => {
        expect(CLOSURE_CODE).toMatch(/where: \{ userId: event\.creatorId, provider: "discord" \}/);
        expect(CLOSURE_CODE).toMatch(/isDiscordSnowflake\(leadDiscordId\)/);
    });

    it("ne ping ni les inscrits, ni un rôle, ni tout le monde", () => {
        expect(CLOSURE_CODE, "les inscrits ne sont pas chargés par le rappel de clôture").not.toMatch(
            /participants: \{/
        );
        expect(CLOSURE_CODE).not.toMatch(/<@&/);
        expect(CLOSURE_CODE).not.toMatch(/@everyone/);
        expect(CLOSURE_CODE).not.toMatch(/@here/);
    });

    it("réutilise le salon de l'embed, avec repli sur le salon raid configuré", () => {
        expect(CLOSURE_CODE).toMatch(
            /event\.discordChannelId \|\| pickRaidReminderChannelId\(guildConfig, meta\.raidType\)/
        );
    });

    it("est idempotent (`closureReminderSentAt`) et le message est nettoyé à la clôture", () => {
        expect(CLOSURE_CODE).toMatch(/closureReminderSentAt: now\.toISOString\(\)/);
        expect(CLOSURE_CODE).toMatch(
            /reminderMessages: \[\.\.\.existingReminders, \{ channelId, messageId, messageKey: reminderMsgKey \}\]/
        );
        // Le message rejoint la liste purgée par la clôture (manuelle ou d'office).
        expect(CLOSURE_CODE).toMatch(/storeMessageIdKey: reminderMsgKey/);
    });

    it("ne scanne que les raids terminés dans la fenêtre 24 h → 48 h", () => {
        expect(CLOSURE_CODE).toMatch(/gte: new Date\(now\.getTime\(\) - RAID_CLOSURE_REMINDER_MAX_AGE_MS\)/);
        expect(CLOSURE_CODE).toMatch(/lte: new Date\(now\.getTime\(\) - RAID_CLOSURE_REMINDER_AGE_MS\)/);
        expect(CLOSURE_CODE).toMatch(/status: "PUBLISHED"/);
    });
});

describe("Cron — une seule tâche porte les deux passes", () => {
    it("le rappel de clôture est branché dans `raid-reminders` (aucune crontab en plus)", () => {
        expect(CRON_CODE).toMatch(/const reminders = await sendRaidReminders\(\)/);
        expect(CRON_CODE).toMatch(/const closures = await sendRaidClosureReminders\(\)/);
        expect(CRON_CODE).toMatch(/recordCronExecution\("raid_reminders", \{/);
        expect(CRON_CODE, "une seule entrée de télémétrie God : pas de tâche orpheline").not.toMatch(
            /recordCronExecution\("raid_closure/
        );
    });
});
