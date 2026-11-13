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

    it("les deux salons (Twitch et YouTube) sont validés avant l'écriture", () => {
        expect(ACTIONS).toContain("twitchChannelId");
        expect(ACTIONS).toContain("youtubeChannelId");
        expect(ACTIONS).toContain("youtubeNotifyChannelId");

        const channelCheck = ACTIONS.indexOf("validateChannelBelongsToGuild");
        const write = ACTIONS.indexOf("db.guildConfig.updateMany");
        expect(channelCheck).toBeGreaterThan(-1);
        expect(write).toBeGreaterThan(channelCheck);
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
        expect(CRON).toContain('recordCronExecution("creator_watch"');
        expect(read("src/lib/cron-telemetry.ts")).toContain("creator_watch:");
    });

    it("annonce les lives ET les nouvelles vidéos, sans qu'une panne bloque l'autre", () => {
        expect(CRON).toContain("runLiveWatch()");
        expect(CRON).toContain("runYouTubeWatch()");
        expect(CRON).toContain("youtubeError");
    });
});

describe("migrations — additives, jamais destructives", () => {
    const SQL_WATCH = read("prisma/migrations/20270125000000_live_notifications_and_last_seen/migration.sql");
    const SQL_YT = read("prisma/migrations/20270125000100_creator_watch_youtube_toggle/migration.sql");
    const SQL_SPLIT = read("prisma/migrations/20270125000200_creator_watch_split_channels/migration.sql");

    it("colonnes en `ADD COLUMN IF NOT EXISTS`", () => {
        expect(SQL_WATCH).toContain('ADD COLUMN IF NOT EXISTS "liveNotifyChannelId"');
        expect(SQL_WATCH).toContain('ADD COLUMN IF NOT EXISTS "livePingRoleIds"');
        expect(SQL_WATCH).toContain('ADD COLUMN IF NOT EXISTS "lastSeenAt"');
        expect(SQL_YT).toContain('ADD COLUMN IF NOT EXISTS "notifyYouTubeUploads"');
        expect(SQL_YT).toContain("DEFAULT true");
        expect(SQL_SPLIT).toContain('ADD COLUMN IF NOT EXISTS "youtubeNotifyChannelId"');
        expect(SQL_SPLIT).toContain('ADD COLUMN IF NOT EXISTS "notifyTwitchLives"');
        expect(SQL_SPLIT).toContain("DEFAULT true");
    });

    it("aucun DROP, DELETE ou UPDATE de données existantes", () => {
        for (const sql of [SQL_WATCH, SQL_YT]) {
            expect(sql).not.toMatch(/DROP\s/i);
            expect(sql).not.toMatch(/DELETE\s+FROM/i);
            expect(sql).not.toMatch(/UPDATE\s+"/i);
        }
    });

    it("la scission reprend le salon existant vers YouTube, sans le détruire", () => {
        // La seule écriture autorisée est une **copie** : l'ancien salon reste intact.
        expect(SQL_SPLIT).toMatch(/UPDATE "GuildConfig"\s+SET "youtubeNotifyChannelId" = "liveNotifyChannelId"/);
        expect(SQL_SPLIT).not.toMatch(/DROP\s/i);
        expect(SQL_SPLIT).not.toMatch(/DELETE\s+FROM/i);
        expect(SQL_SPLIT).not.toMatch(/SET\s+"liveNotifyChannelId"/i);
    });
});
