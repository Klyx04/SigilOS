/**
 * Crons H-1 unifiés (demande user du 28/09/2026) : event / DJ / Songes.
 *
 * Chaque cron est protégé par `x-cron-secret`, trace ses refus 401
 * (`recordCronRefusal`, sinon panneau God « Inconnu ») et ses exécutions, et
 * est déclaré dans `KNOWN_CRON_TASKS` (sinon « Inconnu / Jamais »).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const TELEMETRY = codeOnly(readFileSync("src/lib/cron-telemetry.ts", "utf8"));

const CRONS = ["event_reminders", "dj_reminders", "songes_reminders"] as const;
const ROUTES: Record<(typeof CRONS)[number], string> = {
    event_reminders: "src/app/api/cron/event-reminders/route.ts",
    dj_reminders: "src/app/api/cron/dj-reminders/route.ts",
    songes_reminders: "src/app/api/cron/songes-reminders/route.ts",
};

describe("Crons H-1 event/DJ/Songes", () => {
    for (const cronId of CRONS) {
        it(`${cronId} : protégé, refus tracé, exécution tracée`, () => {
            const code = codeOnly(readFileSync(ROUTES[cronId], "utf8"));
            expect(code).toMatch(/import \{ verifyCronSecret \} from "@\/lib\/cron-auth"/);
            expect(code).toMatch(/if \(!verifyCronSecret\(req\)\)/);
            expect(code).toMatch(new RegExp(`recordCronRefusal\\("${cronId}"\\)`));
            expect(code).toMatch(new RegExp(`recordCronExecution\\("${cronId}", \\{`));
        });

        it(`${cronId} : déclaré dans KNOWN_CRON_TASKS`, () => {
            expect(TELEMETRY).toMatch(new RegExp(`${cronId}: \\{`));
        });
    }

    it("les services H-1 ignorent les posts sans date (planif indéfinie)", () => {
        const eventService = codeOnly(readFileSync("src/server/event-reminder-service.ts", "utf8"));
        const djService = codeOnly(readFileSync("src/server/dj-reminder-service.ts", "utf8"));
        const songesService = codeOnly(readFileSync("src/server/songes-reminder-service.ts", "utf8"));
        // GuildEvent.startDate est NOT NULL en schéma : le filtre est `gt` seul,
        // et la garde `no-date` vit dans la décision pure (shouldSendEventReminder).
        expect(eventService).toMatch(/startDate: \{ gt: now/);
        expect(eventService).toMatch(/reason: "no-date"/);
        // DjSearchPost.targetDate et DreamRun.scheduledAt sont NULLABLES : le
        // filtre SQL exclut les posts indéfinis avant même la décision pure.
        expect(djService).toMatch(/targetDate: \{ not: null, gt: now/);
        expect(songesService).toMatch(/scheduledAt: \{ not: null, gt: now/);
    });

    it("les suppressions à la clôture résolvent les IDs outbox via la clé Redis", () => {
        const discord = codeOnly(readFileSync("src/server/discord.ts", "utf8"));
        expect(discord).toMatch(/resolveReminderMessageId\(/);
        expect(discord).toMatch(/storeMessageIdKey/);
        const calendar = codeOnly(readFileSync("src/server/actions/calendar-actions.ts", "utf8"));
        expect(calendar).toMatch(/messageKey: manualMsgKey/);
        expect(calendar).toMatch(/deleteReminderMessageRefs\(/);
    });
});
