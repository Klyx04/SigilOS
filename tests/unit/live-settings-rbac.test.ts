/**
 * Réglages des annonces de live — **verrou de sécurité** (source).
 *
 * Ce que ce verrou protège :
 * 1. RBAC **fail-closed** : la garde passe **avant** toute écriture ;
 * 2. Zod borné + rate limit Redis sur les mutations ;
 * 3. salon **et** rôles vérifiés côté Discord avant d'enregistrer ;
 * 4. aucun `@everyone` nulle part ;
 * 5. cron protégé (`verifyCronSecret`) et télémétré ;
 * 6. migration **additive** uniquement.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const ACTIONS = read("src/server/actions/live-notify-actions.ts");
const CRON = read("src/app/api/cron/live-watch/route.ts");
const SQL = read("prisma/migrations/20270125000000_live_notifications_and_last_seen/migration.sql");

describe("réglages de live — gardes serveur", () => {
    it("la garde RBAC passe avant toute écriture", () => {
        const guard = ACTIONS.indexOf("requireGuildConfigAccess(guildId)");
        const write = ACTIONS.indexOf("db.guildConfig.updateMany");

        expect(guard).toBeGreaterThan(-1);
        expect(write).toBeGreaterThan(guard);
        // Deux gardes : lecture ET écriture.
        expect((ACTIONS.match(/requireGuildConfigAccess/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });

    it("Zod borné et rate limit Redis sur les mutations", () => {
        expect(ACTIONS).toContain("SettingsSchema");
        expect(ACTIONS).toContain(".array(");
        expect(ACTIONS).toContain("LIVE_MAX_PING_ROLES");
        expect(ACTIONS).toContain("rateLimit(`live-notify-save:");
        expect(ACTIONS).toContain("rateLimit(`live-notify-test:");
        expect(ACTIONS).not.toMatch(/new Map\(\)/);
    });

    it("salon et rôles sont vérifiés côté Discord **avant** l'enregistrement", () => {
        const channelCheck = ACTIONS.indexOf("validateChannelBelongsToGuild");
        const roleCheck = ACTIONS.indexOf("fetchGuildRoles");
        const write = ACTIONS.indexOf("db.guildConfig.updateMany");

        expect(channelCheck).toBeGreaterThan(-1);
        expect(roleCheck).toBeGreaterThan(-1);
        expect(write).toBeGreaterThan(channelCheck);
        expect(write).toBeGreaterThan(roleCheck);
    });

    it("aucun `@everyone` : le ping est un choix explicite", () => {
        expect(ACTIONS).not.toContain('"@everyone"');
        expect(ACTIONS).toContain("pingRoleIds: []");
    });
});

describe("cron de détection — protégé et télémétré", () => {
    it("vérifie le secret et répond 401 (fail-closed)", () => {
        expect(CRON).toContain("verifyCronSecret(req)");
        expect(CRON).toContain("status: 401");
    });

    it("émet la télémétrie et déclare la tâche", () => {
        expect(CRON).toContain('recordCronExecution("live_watch"');
        expect(read("src/lib/cron-telemetry.ts")).toContain("live_watch:");
    });
});

describe("migration — additive, jamais destructive", () => {
    it("trois colonnes en `ADD COLUMN IF NOT EXISTS`", () => {
        expect(SQL).toContain('ADD COLUMN IF NOT EXISTS "liveNotifyChannelId"');
        expect(SQL).toContain('ADD COLUMN IF NOT EXISTS "livePingRoleIds"');
        expect(SQL).toContain('ADD COLUMN IF NOT EXISTS "lastSeenAt"');
    });

    it("aucun DROP, DELETE ou UPDATE de données existantes", () => {
        expect(SQL).not.toMatch(/DROP\s/i);
        expect(SQL).not.toMatch(/DELETE\s+FROM/i);
        expect(SQL).not.toMatch(/UPDATE\s+"/i);
    });
});
