/**
 * Surveillance des crons par Sentry (lot **W-2**) — le verrou.
 *
 * 🐛 Mesure du 11/10/2026 : **aucun** des 25 crons n'était surveillé (ni `withMonitor` ni
 * `captureCheckIn` nulle part dans le dépôt) ⇒ une tâche qui s'arrête ne prévient
 * **personne**. C'est exactement le trou de l'incident du 06/10 : découvert par un
 * utilisateur, pas par une alerte.
 *
 * 🔒 Verrouillé ici :
 *  ① la cadence se déduit du libellé **déjà déclaré** (`KNOWN_CRON_TASKS`, celui que God
 *    affiche) — les formes réellement présentes sont couvertes, une forme inconnue rend
 *    `null` ⇒ **pas de moniteur** (« Automatique », le repli des tâches inconnues, n'envoie
 *    rien : on ne surveille pas au hasard) ;
 *  ② **chaque** tâche déclarée a une cadence exploitable : ajouter un cron dont le libellé
 *    n'est pas reconnu **casse ce test** (plus jamais de tâche non surveillée en silence) ;
 *  ③ le check-in porte le bon couple tâche/état et une durée en **secondes** (jamais `NaN`) ;
 *  ④ le branchement est **unique** : un seul `captureCheckIn` dans tout le dépôt, dans la
 *    fonction par laquelle passent les 25 routes.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
    CRON_CHECKIN_MARGIN_MINUTES,
    buildCronCheckIn,
    cronMonitorConfigFor,
    cronMonitorScheduleFromLabel,
} from "@/lib/cron-monitor";
import { KNOWN_CRON_TASKS } from "@/lib/cron-telemetry";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

describe("Cron → Sentry : cadence déduite du libellé déjà déclaré", () => {
    it("① les formes réellement présentes dans le dépôt sont reconnues", () => {
        expect(cronMonitorScheduleFromLabel("Toutes les 10 min")).toEqual({
            type: "interval",
            value: 10,
            unit: "minute",
        });
        // Le libellé réel de `status_ping` porte un suffixe : il doit passer aussi.
        expect(cronMonitorScheduleFromLabel("Toutes les 5 min (garde-fou fréquence God)")).toEqual({
            type: "interval",
            value: 5,
            unit: "minute",
        });
        expect(cronMonitorScheduleFromLabel("Toutes les 30 min")).toEqual({
            type: "interval",
            value: 30,
            unit: "minute",
        });
        expect(cronMonitorScheduleFromLabel("Toutes les 12h")).toEqual({
            type: "interval",
            value: 12,
            unit: "hour",
        });
        expect(cronMonitorScheduleFromLabel("Quotidien 03h00")).toEqual({
            type: "interval",
            value: 1,
            unit: "day",
        });
        expect(cronMonitorScheduleFromLabel("Quotidien 04h35 (UTC)")).toEqual({
            type: "interval",
            value: 1,
            unit: "day",
        });
        // `janitor` n'a pas de ligne de crontab : il tourne DANS la passe quotidienne.
        expect(cronMonitorScheduleFromLabel("Dans maintenance 04h00")).toEqual({
            type: "interval",
            value: 1,
            unit: "day",
        });
        expect(cronMonitorScheduleFromLabel("Mardi 08h00")).toEqual({
            type: "interval",
            value: 1,
            unit: "week",
        });
        expect(cronMonitorScheduleFromLabel("Dimanches 04h15 (UTC)")).toEqual({
            type: "interval",
            value: 1,
            unit: "week",
        });
        expect(cronMonitorScheduleFromLabel("Hebdo dimanches 05h00 (UTC)")).toEqual({
            type: "interval",
            value: 1,
            unit: "week",
        });
    });

    it("① une cadence inconnue ne surveille RIEN (jamais d'alerte au hasard)", () => {
        // « Automatique » est le repli exact de `recordCronExecution` pour toute tâche
        // non déclarée : il ne doit produire aucun moniteur.
        expect(cronMonitorScheduleFromLabel("Automatique")).toBeNull();
        expect(cronMonitorScheduleFromLabel("")).toBeNull();
        expect(cronMonitorScheduleFromLabel("quand on y pense")).toBeNull();
        expect(cronMonitorConfigFor("Automatique")).toBeNull();
    });

    it("② CHAQUE tâche déclarée dans God a une cadence exploitable", () => {
        const withoutSchedule = Object.entries(KNOWN_CRON_TASKS)
            .filter(([, meta]) => cronMonitorConfigFor(meta.schedule) === null)
            .map(([id, meta]) => `${id} (« ${meta.schedule} »)`);
        // Un cron ajouté sans libellé reconnu échoue ICI : le défaut mesuré était
        // « 25 tâches, 0 surveillance », jamais plus.
        expect(withoutSchedule).toEqual([]);
    });

    it("③ le check-in porte la tâche, l'état, et une durée en SECONDES", () => {
        expect(buildCronCheckIn("market_expire", { success: true, durationMs: 2500 })).toEqual({
            monitorSlug: "market_expire",
            status: "ok",
            duration: 2.5,
        });
        expect(buildCronCheckIn("market_expire", { success: false })).toEqual({
            monitorSlug: "market_expire",
            status: "error",
        });
        // Durée absente ou illisible ⇒ champ omis (jamais `NaN` dans le payload Sentry).
        expect(buildCronCheckIn("x", { success: true, durationMs: null })).not.toHaveProperty(
            "duration"
        );
        expect(buildCronCheckIn("x", { success: true, durationMs: Number.NaN })).not.toHaveProperty(
            "duration"
        );
    });

    it("④ le branchement est UNIQUE (une source, les 25 routes couvertes)", () => {
        // Le check-in part de `cron-telemetry.ts` — la fonction par laquelle passent
        // TOUTES les routes `/api/cron/*` (25/25 mesuré le 11/10/2026).
        const telemetry = read("src/lib/cron-telemetry.ts");
        expect(telemetry).toContain("Sentry.captureCheckIn(");
        expect(telemetry).toContain("notifySentryCronMonitor(cronId,");
        // …et aucune seconde implémentation ailleurs : le module pur ne parle pas à Sentry.
        expect(read("src/lib/cron-monitor.ts")).not.toContain("captureCheckIn(");
        // Marge volontairement large : on veut apprendre un ARRÊT, pas un retard.
        expect(CRON_CHECKIN_MARGIN_MINUTES).toBeGreaterThanOrEqual(30);
    });
});
