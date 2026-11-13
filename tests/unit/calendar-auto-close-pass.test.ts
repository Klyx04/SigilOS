/**
 * Passe de fond du calendrier — **clôture d'office + purge Discord** (décision user du
 * 25/10/2026 : un raid encore ouvert à +48 h est clôturé d'office, mais **traçable** et
 * **rattrapable**, et ses messages Discord sont enfin supprimés).
 *
 * Constat avant ce lot : la seule fonction qui purgeait les messages
 * (`autoCloseExpiredEvents`) n'était **jamais appelée** ; la clôture se faisait à la
 * lecture (ouverture du calendrier), sans nettoyage ni points. Ces gardes verrouillent
 * le nouveau contrat : une passe de fond unique, bornée, idempotente, qui purge.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const CORE = codeOnly(readFileSync("src/server/calendar-auto-close-core.ts", "utf8"));
const ROUTE = codeOnly(readFileSync("src/app/api/cron/calendar-auto-close/route.ts", "utf8"));
const TELEMETRY = codeOnly(readFileSync("src/lib/cron-telemetry.ts", "utf8"));

describe("Passe de fond — bornée et fondée sur la règle unique", () => {
    it("pré-filtre toutes les guildes puis applique `shouldBlindAutoClose`", () => {
        expect(CORE).toMatch(/blindAutoCloseWhere\(null, now\)/);
        expect(CORE).toMatch(/take: opts\.limit \?\? DEFAULT_LIMIT/);
        expect(CORE).toMatch(/if \(!shouldBlindAutoClose\(/);
    });

    it("écarte les miroirs DJ/Songes : leur clôture appartient à la synchro de la source", () => {
        expect(CORE).toMatch(/isMirror: isAgendaMirror\(meta\)/);
    });

    it("garde d'état dans le `WHERE` : jamais deux clôtures pour le même événement", () => {
        expect(CORE).toMatch(/where: \{ id: event\.id, guildId: event\.guildId, status: "PUBLISHED" \}/);
    });
});

describe("Clôture d'office d'un raid — traçable, jamais définitive", () => {
    it("marque `closedBySystem` + `systemClosedAt` et **pas** `completedAt`", () => {
        expect(CORE).toMatch(/closedBySystem: true, systemClosedAt: now\.toISOString\(\)/);
        expect(CORE, "`completedAt` reste le marqueur d'une clôture humaine").not.toMatch(
            /completedAt: now\.toISOString\(\)/
        );
    });
});

describe("Purge Discord — la raison d'être du lot", () => {
    it("supprime les rappels (`reminderMessages`) et l'embed de publication", () => {
        expect(CORE).toMatch(/deleteReminderMessageRefs\(refs\)/);
        expect(CORE).toMatch(/deleteEventDiscordMessage\(\{/);
    });

    it("ne conserve que les refs réellement non supprimées (un échec reste rejouable)", () => {
        expect(CORE).toMatch(/reminderMessages: remaining/);
    });
});

describe("Cron `calendar-auto-close`", () => {
    it("est protégé par x-cron-secret, trace ses refus et ses exécutions", () => {
        expect(ROUTE).toMatch(/import \{ verifyCronSecret \} from "@\/lib\/cron-auth"/);
        expect(ROUTE).toMatch(/if \(!verifyCronSecret\(req\)\)/);
        expect(ROUTE).toMatch(/recordCronRefusal\("calendar_auto_close"\)/);
        expect(ROUTE).toMatch(/recordCronExecution\("calendar_auto_close", \{/);
    });

    it("est déclaré dans KNOWN_CRON_TASKS (sinon « Inconnu / Jamais » côté God)", () => {
        expect(TELEMETRY).toMatch(/calendar_auto_close: \{/);
        expect(TELEMETRY).toMatch(/logFile: "calendar-auto-close\.log"/);
    });
});
