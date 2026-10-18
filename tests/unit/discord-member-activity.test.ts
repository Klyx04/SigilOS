/**
 * Lot 7 — `DiscordMemberActivity` : activité Discord de **tous** les membres.
 *
 * Ce que ce verrou protège :
 * - la rétention : 365 jours **après le départ**, jamais un membre présent ;
 * - l'écriture côté bot : message, vocal, arrivée (efface `leftDiscordAt`), départ (le pose) ;
 * - la purge : une seule requête indexée, appelée par le cron protégé (aucune action cliente) ;
 * - la migration : additive, indexée sur la colonne de rétention.
 *
 * Lecture seule (règle pure + sources), aucune base.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
    DISCORD_MEMBER_ACTIVITY_RETENTION_DAYS,
    discordActivityCutoff,
    isDiscordActivityPurgeable,
} from "@/lib/discord-member-activity";

const SCHEMA = "prisma/schema.prisma";
const MIGRATION = "prisma/migrations/20270113000000_add_discord_member_activity/migration.sql";
const BOT = "services/discord-bot/index.ts";
const PURGE = "src/server/discord-member-activity-retention.ts";
const CRON = "src/app/api/cron/account-retention/route.ts";
const ACTION = "src/server/actions/member-lifecycle-actions.ts";
const PANEL = "src/components/admin/members/member-discord-activity.tsx";

const read = (path: string) => readFileSync(path, "utf8");

describe("lot 7 — rétention (365 jours après le départ)", () => {
    const now = new Date("2026-10-19T12:00:00.000Z");

    it("la limite est exactement 365 jours en arrière", () => {
        expect(DISCORD_MEMBER_ACTIVITY_RETENTION_DAYS).toBe(365);
        expect(discordActivityCutoff(now).toISOString()).toBe("2025-10-19T12:00:00.000Z");
    });

    it("un membre PRÉSENT n'est jamais purgeable", () => {
        expect(isDiscordActivityPurgeable(null, now)).toBe(false);
        expect(isDiscordActivityPurgeable(undefined, now)).toBe(false);
    });

    it("un partant est purgé seulement APRÈS la limite (strictement)", () => {
        expect(isDiscordActivityPurgeable("2025-10-19T12:00:00.000Z", now)).toBe(false); // pile la limite
        expect(isDiscordActivityPurgeable("2025-10-19T11:59:59.000Z", now)).toBe(true);
        expect(isDiscordActivityPurgeable("2026-10-01T00:00:00.000Z", now)).toBe(false);
    });

    it("une durée absurde retombe sur 365 (jamais 0 jour)", () => {
        expect(discordActivityCutoff(now, 0).toISOString()).toBe("2025-10-19T12:00:00.000Z");
        expect(discordActivityCutoff(now, Number.NaN).toISOString()).toBe("2025-10-19T12:00:00.000Z");
    });
});

describe("lot 7 — écriture bot et purge", () => {
    it("le schéma porte la table, l'unicité et l'index de rétention", () => {
        const schema = read(SCHEMA);
        expect(schema).toContain("model DiscordMemberActivity");
        expect(schema).toContain("@@unique([guildId, discordId])");
        expect(schema).toContain("@@index([guildId, leftDiscordAt])");
        expect(schema).toContain("discordMemberActivities          DiscordMemberActivity[]");
    });

    it("la migration est additive et indexe la colonne de purge", () => {
        const sql = read(MIGRATION);
        expect(sql).toContain('CREATE TABLE "DiscordMemberActivity"');
        expect(sql).toContain('CREATE UNIQUE INDEX "DiscordMemberActivity_guildId_discordId_key"');
        expect(sql).toContain('CREATE INDEX "DiscordMemberActivity_guildId_leftDiscordAt_idx"');
        expect(sql).toContain("ON DELETE CASCADE");
    });

    it("le bot écrit pour TOUS les membres (message, vocal, arrivée, départ)", () => {
        const bot = read(BOT);
        expect(bot).toContain("db.discordMemberActivity.upsert(");
        expect(bot).toContain("messagesTotal: { increment: 1 }");
        expect(bot).toContain("voiceSecondsTotal: { increment: seconds }");
        // Départ : la date est posée ; retour : elle est effacée.
        expect(bot).toContain("...(patch.left ? { leftDiscordAt: now } : {})");
        expect(bot).toContain("...(patch.joined ? { leftDiscordAt: null } : {})");
        // Appels réels dans les événements.
        expect(bot).toContain("await trackMemberActivity(member.user.id, member.guild.id");
        expect(bot).toContain("await trackMemberActivity(message.author.id, message.guild.id");
        expect(bot).toContain("await trackMemberActivity(userId, guildId");
    });

    it("la purge est une seule requête bornée, jamais une action cliente", () => {
        const src = read(PURGE);
        expect(src).toContain("export async function purgeDiscordMemberActivityCore");
        expect(src).toContain("leftDiscordAt: { not: null, lt: cutoff }");
        expect(src).toContain("db.discordMemberActivity.deleteMany(");
        // Un module serveur interne : aucune server action exportée.
        expect(src).not.toContain('"use server"');
    });

    it("le cron protégé appelle la purge et dit un échec", () => {
        const route = read(CRON);
        expect(route).toContain("purgeDiscordMemberActivityCore()");
        expect(route).toContain("discordActivityError");
        expect(route).toContain("success: discordActivityError === null");
        expect(route).toContain("verifyCronSecret(req)");
    });
});

describe("lot 7 — la mesure est VISIBLE dans la fiche", () => {
    it("l'action expose sa source et lit la table pour un hors-dashboard", () => {
        const src = read(ACTION);
        expect(src).toContain("db.discordMemberActivity.findUnique(");
        expect(src).toContain('source: "member"');
        expect(src).toContain('source: "profile"');
        expect(src).toContain("tracked: true");
        expect(src).toContain("leftDiscordAt");
        // Le hors-dashboard mesuré n'est plus renvoyé comme « non mesuré ».
        expect(src).toContain("if (!activity) return { success: true, data: UNTRACKED_PRESENCE }");
    });

    it("le panneau rend la mesure brute au lieu de « Non mesuré »", () => {
        const src = read(PANEL);
        expect(src).toContain('data.source === "member"');
        expect(src).toContain("Mesuré · tous membres");
        expect(src).toContain("membre non inscrit au dashboard");
        expect(src).toContain("compteurs bruts");
        // Le cas « aucune mesure » reste dit (jamais un zéro accusateur).
        expect(src).toContain("Non mesuré");
    });
});
