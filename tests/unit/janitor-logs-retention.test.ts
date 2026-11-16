/**
 * Janitor du VPS — la rétention de la télémétrie (**90 j**) et du journal
 * d'activité (**365 j**) doit consommer **la même politique** que le cron.
 *
 * Le script est bundlé par esbuild sans alias `@/` : il importe la politique
 * en **relatif**. Ce test verrouille les trois risques : une constante locale
 * qui dérive, une suppression globale, et une donnée personnelle dans la sortie.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("scripts/database-janitor.ts — rétention télémétrie + journal d'activité", () => {
    const script = readFileSync("scripts/database-janitor.ts", "utf8");

    it("importe la politique unique en relatif (pas de constante locale)", () => {
        expect(script).toContain("telemetry-retention-policy");
        expect(script).toContain("LOG_RETENTION_DAYS");
        expect(script).toContain("LOG_PURGE_BATCH_SIZE");
        expect(script).toContain("LOG_PURGE_MAX_BATCHES");
        expect(script).not.toMatch(/const (TELEMETRY|SERVICE_ACTIVITY)_RETENTION_DAYS = \d+/);
    });

    it("applique les deux coupures de la politique", () => {
        expect(script).toContain("logPurgeCutoff(retentionNow, LOG_RETENTION_DAYS.TELEMETRY)");
        expect(script).toContain("logPurgeCutoff(retentionNow, LOG_RETENTION_DAYS.SERVICE_ACTIVITY)");
        expect(script).toContain("buildTelemetryPurgeWhere(telemetryCutoff)");
        expect(script).toContain("buildServiceActivityPurgeWhere(serviceActivityCutoff)");
    });

    it("respecte le DRY_RUN et ne supprime que par ids, jamais en global", () => {
        expect(script).toContain("isDryRun");
        expect(script).not.toMatch(/deleteMany\s*\(\s*\{\s*\}\s*\)/);
        expect(script).toContain("id: { in: ids }");
    });

    it("ne journalise aucune donnée personnelle", () => {
        expect(script).not.toContain("userName");
        expect(script).not.toMatch(/\bpath\b/);
        expect(script).not.toContain("u.email");
    });

    it("le journal d'activité est purgé par id interne de guilde", () => {
        expect(script).toContain("db.guildConfig.findMany");
        expect(script).toContain("select: { id: true }");
        expect(script).toContain("guildId: guild.id");
    });
});
