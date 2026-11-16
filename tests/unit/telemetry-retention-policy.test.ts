/**
 * Politique de rétention — télémétrie **90 j**, journal d'activité **365 j**.
 *
 * Décision user du 16/11/2026 : les deux dernières tables sans purge. La règle
 * est pure (aucun Prisma) et consommée à l'identique par le cron et le janitor.
 */

import { describe, it, expect } from "vitest";
import {
    LOG_PURGE_BATCH_SIZE,
    LOG_PURGE_MAX_BATCHES,
    LOG_RETENTION_DAYS,
    buildServiceActivityPurgeWhere,
    buildTelemetryPurgeWhere,
    logPurgeCutoff,
} from "@/lib/telemetry-retention-policy";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("politique de rétention — télémétrie et journal d'activité", () => {
    it("deux durées distinctes : 90 j pour la navigation, 365 j pour la vie de guilde", () => {
        expect(LOG_RETENTION_DAYS.TELEMETRY).toBe(90);
        expect(LOG_RETENTION_DAYS.SERVICE_ACTIVITY).toBe(365);
    });

    it("les lots sont bornés, entiers et positifs", () => {
        expect(LOG_PURGE_BATCH_SIZE).toBeGreaterThan(0);
        expect(LOG_PURGE_MAX_BATCHES).toBeGreaterThan(0);
        expect(Number.isInteger(LOG_PURGE_BATCH_SIZE)).toBe(true);
        expect(Number.isInteger(LOG_PURGE_MAX_BATCHES)).toBe(true);
    });

    it("la coupure est exacte à la milliseconde, sans date codée en dur", () => {
        const now = new Date("2026-11-16T12:34:56.789Z");
        for (const days of [LOG_RETENTION_DAYS.TELEMETRY, LOG_RETENTION_DAYS.SERVICE_ACTIVITY]) {
            expect(logPurgeCutoff(now, days).getTime()).toBe(now.getTime() - days * MS_PER_DAY);
        }
    });

    it("ne mute jamais l'instant reçu", () => {
        const now = new Date("2026-11-16T12:00:00.000Z");
        const before = now.getTime();
        logPurgeCutoff(now, 90);
        expect(now.getTime()).toBe(before);
    });

    it("les deux filtres ne portent que la borne d'âge (aucune guilde, aucun type)", () => {
        const cutoff = new Date("2026-08-18T12:00:00.000Z");
        expect(buildTelemetryPurgeWhere(cutoff)).toEqual({ createdAt: { lt: cutoff } });
        expect(buildServiceActivityPurgeWhere(cutoff)).toEqual({ createdAt: { lt: cutoff } });
    });

    it("les deux filtres sont indépendants (modifier l'un ne touche pas l'autre)", () => {
        const cutoff = new Date("2026-08-18T12:00:00.000Z");
        const telemetry = buildTelemetryPurgeWhere(cutoff);
        const activity = buildServiceActivityPurgeWhere(cutoff);
        expect(telemetry).not.toBe(activity);
        expect(telemetry.createdAt.lt).toBe(cutoff);
        expect(activity.createdAt.lt).toBe(cutoff);
    });
});
