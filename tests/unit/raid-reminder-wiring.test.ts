/**
 * Rappel automatique des raids — câblage (demande user du 19/09/2026).
 *
 * Le point non négociable : le ping ne doit toucher QUE les **inscrits** du raid
 * (« pas les rôles mentionnés dans l'embed »). Côté Discord, un ping naît
 * uniquement du `content` du message : on verrouille donc ici que ce contenu est
 * construit par `buildRaidReminderMentions` (mentions `<@id>` d'inscrits) et que
 * le service n'écrit jamais `<@&…>` ni `@everyone`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const CRON = "src/app/api/cron/raid-reminders/route.ts";
const SERVICE = "src/server/raid-reminder-service.ts";
const TELEMETRY = "src/lib/cron-telemetry.ts";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const CRON_CODE = codeOnly(readFileSync(CRON, "utf8"));
const SERVICE_CODE = codeOnly(readFileSync(SERVICE, "utf8"));
const TELEMETRY_CODE = codeOnly(readFileSync(TELEMETRY, "utf8"));

describe("Cron `raid-reminders`", () => {
    it("est protégé par x-cron-secret et tracé dans la télémétrie God", () => {
        expect(CRON_CODE).toMatch(/import \{ verifyCronSecret \} from "@\/lib\/cron-auth"/);
        expect(CRON_CODE).toMatch(/if \(!verifyCronSecret\(req\)\)/);
        expect(CRON_CODE).toMatch(/recordCronExecution\("raid_reminders", \{/);
        expect(CRON_CODE).toMatch(/await sendRaidReminders\(\)/);
    });

    it("est déclaré dans KNOWN_CRON_TASKS (sinon panneau God « Inconnu »)", () => {
        expect(TELEMETRY_CODE).toMatch(/raid_reminders: \{/);
        expect(TELEMETRY_CODE).toMatch(/logFile: "raid-reminders\.log"/);
    });
});

describe("Service `raid-reminder-service` — ping des INSCRITS uniquement", () => {
    it("le `content` du ping vient de buildRaidReminderMentions", () => {
        expect(SERVICE_CODE).toMatch(/buildRaidReminderMentions\(accounts\.map\(\(a\) => a\.providerAccountId\)\)/);
        expect(SERVICE_CODE, "le ping doit porter les mentions générées").toMatch(
            /départ dans \$\{leadLabel\}\*\*[^\n]*\$\{mentions\}/
        );
    });

    it("ne peut pas ping un rôle ni @everyone (aucune mention de rôle écrite)", () => {
        expect(SERVICE_CODE).not.toMatch(/<@&/);
        expect(SERVICE_CODE).not.toMatch(/@everyone/);
        expect(SERVICE_CODE).not.toMatch(/@here/);
    });

    it("ne considère comme inscrits que REGISTERED + CONFIRMED", () => {
        expect(SERVICE_CODE).toMatch(/where: \{ status: \{ in: \["REGISTERED", "CONFIRMED"\] \} \}/);
        expect(SERVICE_CODE, "la file d'attente n'est pas pingée").not.toMatch(/RESERVE/);
    });

    it("est idempotent : marqueur `raidReminderSentAt` + trace `reminderMessages`", () => {
        expect(SERVICE_CODE).toMatch(/autoReminderSentAt: \(meta\.raidReminderSentAt as string \| undefined\) \?\? null/);
        expect(SERVICE_CODE).toMatch(/raidReminderSentAt: now\.toISOString\(\)/);
        expect(SERVICE_CODE).toMatch(/reminderMessages: \[\.\.\.existingReminders, \{ channelId, messageId \}\]/);
    });

    it("ne scanne que des raids publiés, à venir, avec un salon", () => {
        expect(SERVICE_CODE).toMatch(/type: "RAID_OFFICIAL"/);
        expect(SERVICE_CODE).toMatch(/status: "PUBLISHED"/);
        expect(SERVICE_CODE).toMatch(/startDate: \{ gt: now, lte: new Date\(now\.getTime\(\) \+ SCAN_HORIZON_MS\) \}/);
        expect(SERVICE_CODE).toMatch(/discordChannelId: \{ not: null \}/);
    });

    it("passe par la décision pure (aucune règle de fenêtre réécrite ici)", () => {
        expect(SERVICE_CODE).toMatch(/shouldSendRaidReminder\(\{/);
        expect(SERVICE_CODE).toMatch(/pickRaidReminderChannelId\(guildConfig, meta\.raidType\)/);
    });
});
