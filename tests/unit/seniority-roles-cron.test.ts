/**
 * Chantier Y, lot **Y-2** (cron + embed) — verrou du lot.
 *
 * 🛡️ Ce que ce test protège : ① la règle du **rattrapage** (un palier franchi avant
 * l'activation du module n'est jamais fêté — décision user du 14/10/2026) ; ②
 * l'**idempotence** de l'annonce (jamais deux fois, et un envoi raté relâche sa
 * revendication pour ne pas perdre le palier) ; ③ le **fail-closed** (module coupé,
 * aucun palier, échec de pose de rôle ⇒ rien n'est posté) ; ④ le **marqueur
 * d'activation** (estampé une fois, jamais déplacé) ; ⑤ le câblage (tâche déclarée,
 * secret de la route, colonne et clé unique dans la migration).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { NextRequest } from "next/server";

const guildConfigFindMany = vi.fn();
const guildConfigUpdate = vi.fn();
const userProfileFindMany = vi.fn();
const announcementFindMany = vi.fn();
const announcementCreate = vi.fn();
const announcementDeleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: {
            findMany: (...args: unknown[]) => guildConfigFindMany(...args),
            update: (...args: unknown[]) => guildConfigUpdate(...args),
        },
        userProfile: { findMany: (...args: unknown[]) => userProfileFindMany(...args) },
        seniorityRoleAnnouncement: {
            findMany: (...args: unknown[]) => announcementFindMany(...args),
            create: (...args: unknown[]) => announcementCreate(...args),
            deleteMany: (...args: unknown[]) => announcementDeleteMany(...args),
        },
    },
}));

const fetchAllGuildMembersDetailed = vi.fn();
const addRoleToMember = vi.fn();
const removeRoleFromMember = vi.fn();
const sendChannelMessage = vi.fn();

vi.mock("@/server/discord", () => ({
    fetchAllGuildMembersDetailed: (...args: unknown[]) => fetchAllGuildMembersDetailed(...args),
    addRoleToMember: (...args: unknown[]) => addRoleToMember(...args),
    removeRoleFromMember: (...args: unknown[]) => removeRoleFromMember(...args),
    sendChannelMessage: (...args: unknown[]) => sendChannelMessage(...args),
}));

const verifyCronSecret = vi.fn();
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: (...args: unknown[]) => verifyCronSecret(...args) }));

const recordCronExecution = vi.fn();
vi.mock("@/lib/cron-telemetry", () => ({
    recordCronExecution: (...args: unknown[]) => recordCronExecution(...args),
    KNOWN_CRON_TASKS: {},
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { resolveSeniorityCrossingIso, shouldCelebrateSeniorityTier } from "@/lib/seniority-roles";
import { syncSeniorityRolesCore } from "@/server/seniority-roles-core";
import { GET } from "@/app/api/cron/seniority-roles/route";

const CORE = "src/server/seniority-roles-core.ts";
const ROUTE = "src/app/api/cron/seniority-roles/route.ts";
const TELEMETRY = "src/lib/cron-telemetry.ts";
const MIGRATION = "prisma/migrations/20270108000000_add_seniority_role_announcements/migration.sql";
const SCHEMA = "prisma/schema.prisma";

const source = (path: string) => readFileSync(path, "utf8");
/** Retire les commentaires : un motif interdit ne doit pas se cacher dans la prose. */
const codeOnly = (path: string) =>
    source(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Identifiant synthétique : 18 chiffres (snowflake plausible), unique par index. */
const snowflake = (index: number) => (200000000000000000n + BigInt(index)).toString();
const ROLE_A = snowflake(1);
const ROLE_B = snowflake(2);
const ROLE_C = snowflake(3);
const CHANNEL = snowflake(9);
const DISCORD_ID = "403000342167420929";

const NOW = new Date("2026-10-15T04:30:00.000Z");

/** Ligne de guilde telle que le core la lit (paliers 30 / 180 / 365 jours). */
const guildRow = (overrides: Record<string, unknown> = {}) => ({
    id: "guild-1",
    discordGuildId: "1290442961380835451",
    name: "Sigil",
    iconUrl: null,
    seniorityRolesChannelId: CHANNEL,
    seniorityRolesEnabled: true,
    seniorityRolesTiers: [
        { days: 30, roleIds: [ROLE_A] },
        { days: 180, roleIds: [ROLE_B] },
        { days: 365, roleIds: [ROLE_C] },
    ],
    seniorityRolesAnnouncement: null,
    seniorityRolesActivatedAt: new Date("2026-10-01T04:30:00.000Z"),
    ...overrides,
});

const profileRow = (overrides: Record<string, unknown> = {}) => ({
    guildJoinedAt: null,
    discordJoinedAt: new Date("2026-04-01T00:00:00.000Z"),
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    pseudoDofus: "Klyx",
    discordNickname: "Klyx",
    user: { name: "Klyx", accounts: [{ provider: "discord", providerAccountId: DISCORD_ID }] },
    ...overrides,
});

/**
 * Membre **Discord** (source de vérité depuis le 18/10/2026) : la date d'arrivée vient de
 * `joined_at`, les rôles portés de `roles`. Un membre sans profil est éligible comme les autres.
 */
const discordMember = (overrides: Record<string, unknown> = {}) => ({
    user: { id: DISCORD_ID, username: "klyx", global_name: "Klyx", avatar: "a_hash" },
    nick: null,
    avatar: null,
    roles: [] as string[],
    joined_at: "2026-04-01T00:00:00.000Z",
    ...overrides,
});

/** Réponse de la couche Discord : la liste **et** son drapeau de troncature. */
const memberList = (members: unknown[], truncated = false) => ({ members, truncated });

beforeEach(() => {
    vi.clearAllMocks();
    process.env.DISCORD_BOT_TOKEN = "bot-token";
    guildConfigFindMany.mockResolvedValue([]);
    guildConfigUpdate.mockResolvedValue({});
    userProfileFindMany.mockResolvedValue([]);
    fetchAllGuildMembersDetailed.mockResolvedValue(memberList([]));
    announcementFindMany.mockResolvedValue([]);
    announcementCreate.mockResolvedValue({ id: "ann-1" });
    announcementDeleteMany.mockResolvedValue({ count: 1 });
    addRoleToMember.mockResolvedValue(true);
    removeRoleFromMember.mockResolvedValue(true);
    sendChannelMessage.mockResolvedValue("msg-1");
});

describe("Y-2 — franchissement d'un palier : à fêter, ou rattrapage", () => {
    it("date le franchissement à « arrivée + seuil », et rien si l'entrée est douteuse", () => {
        expect(resolveSeniorityCrossingIso("2026-01-01T00:00:00.000Z", 30)).toBe("2026-01-31T00:00:00.000Z");
        expect(resolveSeniorityCrossingIso("pas-une-date", 30)).toBeNull();
        expect(resolveSeniorityCrossingIso("2026-01-01T00:00:00.000Z", 1.5)).toBeNull();
    });

    it("ne fête rien sans marqueur d'activation (fail-closed)", () => {
        const args = { joinedAtIso: "2026-01-01T00:00:00.000Z", tierDays: 30 };
        expect(shouldCelebrateSeniorityTier({ ...args, activatedAtIso: null })).toBe(false);
        expect(shouldCelebrateSeniorityTier({ ...args, activatedAtIso: undefined })).toBe(false);
        expect(shouldCelebrateSeniorityTier({ ...args, activatedAtIso: "hier" })).toBe(false);
    });

    it("marque en silence un palier franchi AVANT l'activation (rattrapage)", () => {
        expect(
            shouldCelebrateSeniorityTier({
                joinedAtIso: "2026-01-01T00:00:00.000Z",
                tierDays: 30,
                activatedAtIso: "2026-06-01T00:00:00.000Z",
            }),
        ).toBe(false);
    });

    it("fête un palier franchi APRÈS l'activation, jamais celui franchi à l'instant même", () => {
        expect(
            shouldCelebrateSeniorityTier({
                joinedAtIso: "2026-01-01T00:00:00.000Z",
                tierDays: 30,
                activatedAtIso: "2026-01-15T00:00:00.000Z",
            }),
        ).toBe(true);
        expect(
            shouldCelebrateSeniorityTier({
                joinedAtIso: "2026-01-01T00:00:00.000Z",
                tierDays: 30,
                activatedAtIso: "2026-01-31T00:00:00.000Z",
            }),
        ).toBe(false);
    });
});

describe("Y-2 — passe du cron : éligibilité, marqueur d'activation, rôles", () => {
    it("ne lit rien quand la guilde n'a aucun palier (module coupé ou config vide)", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow({ seniorityRolesTiers: [] })]);

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.guildsSkipped).toBe(1);
        expect(result.guildsProcessed).toBe(0);
        expect(userProfileFindMany).not.toHaveBeenCalled();
        expect(fetchAllGuildMembersDetailed).not.toHaveBeenCalled();
    });

    it("estampe le marqueur d'activation à la première passe et le dit dans le détail", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow({ seniorityRolesActivatedAt: null })]);

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(guildConfigUpdate).toHaveBeenCalledWith({
            where: { id: "guild-1" },
            data: { seniorityRolesActivatedAt: NOW },
        });
        expect(result.details.join(" ")).toContain("activé");
    });

    it("ne réestampille jamais un marqueur déjà posé", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);

        await syncSeniorityRolesCore({ now: NOW });

        expect(guildConfigUpdate).not.toHaveBeenCalled();
    });

    it("pose les rôles dus et passe les paliers antérieurs à l'activation sous silence", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        userProfileFindMany.mockResolvedValue([profileRow()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(memberList([discordMember()]));

        const result = await syncSeniorityRolesCore({ now: NOW });

        // 197 jours d'ancienneté ⇒ paliers 30 j et 180 j dus, le 365 j non atteint.
        expect(addRoleToMember).toHaveBeenCalledWith("1290442961380835451", DISCORD_ID, ROLE_A);
        expect(addRoleToMember).toHaveBeenCalledWith("1290442961380835451", DISCORD_ID, ROLE_B);
        expect(result.rolesAdded).toBe(2);
        // Les deux franchissements précèdent le 01/10 : posés, jamais fêtés.
        expect(result.announcementsSent).toBe(0);
        expect(result.retroactiveTiersMuted).toBe(2);
        expect(sendChannelMessage).not.toHaveBeenCalled();
        expect(announcementCreate).not.toHaveBeenCalled();
    });

    it("retire les rôles d'un palier perdu, et seulement ceux-là", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        userProfileFindMany.mockResolvedValue([profileRow({ discordJoinedAt: new Date("2026-09-10T00:00:00.000Z") })]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([
                discordMember({
                    roles: [ROLE_A, ROLE_B, snowflake(50)],
                    joined_at: "2026-09-10T00:00:00.000Z",
                }),
            ]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        // 35 jours ⇒ palier 30 j atteint : le 180 j est repris, l'inconnu du lot précédent
        // (snowflake(50), non déclaré) n'est **jamais** touché.
        expect(addRoleToMember).not.toHaveBeenCalled();
        expect(removeRoleFromMember).toHaveBeenCalledWith("1290442961380835451", DISCORD_ID, ROLE_B);
        expect(removeRoleFromMember).toHaveBeenCalledTimes(1);
        expect(result.rolesRemoved).toBe(1);
    });
});

describe("Y-2 — annonces : une fois, et seulement pour un vrai franchissement", () => {
    /** Membre arrivé il y a 35 jours : le palier 30 j vient d'être franchi (après activation). */
    const celebrating = () => profileRow({ discordJoinedAt: new Date("2026-09-10T00:00:00.000Z") });

    it("Y-5 — l'annonce part avec le texte **du palier** franchi, pas le message global", async () => {
        guildConfigFindMany.mockResolvedValue([
            guildRow({
                seniorityRolesTiers: [
                    {
                        days: 30,
                        roleIds: [ROLE_A],
                        announcement: { embedTitle: "Un mois déjà !", messageTemplate: "🎉 {membre}, un mois !" },
                    },
                    { days: 180, roleIds: [ROLE_B], announcement: { embedTitle: "Six mois !" } },
                ],
            }),
        ]);
        userProfileFindMany.mockResolvedValue([celebrating()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([discordMember({ joined_at: "2026-09-10T00:00:00.000Z" })]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.announcementsSent).toBe(1);
        const [, , options] = sendChannelMessage.mock.calls[0];
        expect(options.embedTitle).toBe("Un mois déjà !");
        expect(options.mentionContent).toContain("un mois !");
        // Le texte du palier 180 n'a rien à faire dans l'annonce du palier 30…
        expect(options.embedTitle).not.toBe("Six mois !");
        // …et le champ non surchargé garde bien le texte global (ici la description par défaut).
        expect(options.embedDescription).toContain(`<@&${ROLE_A}>`);
    });

    it("fête un franchissement postérieur à l'activation, avec la mention et la PP du membre", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        userProfileFindMany.mockResolvedValue([celebrating()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([discordMember({ joined_at: "2026-09-10T00:00:00.000Z" })]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.announcementsSent).toBe(1);
        expect(announcementCreate).toHaveBeenCalledWith({
            data: { guildId: "guild-1", discordId: DISCORD_ID, tierDays: 30 },
        });

        const [channelId, content, options] = sendChannelMessage.mock.calls[0];
        expect(channelId).toBe(CHANNEL);
        expect(content).toBe("");
        expect(options.mentionContent).toContain(`<@${DISCORD_ID}>`);
        expect(options.embedDescription).toContain(`<@${DISCORD_ID}>`);
        expect(options.embedDescription).toContain(`<@&${ROLE_A}>`);
        expect(options.embedDescription).toContain("Sigil");
        expect(options.embedThumbnail).toContain("cdn.discordapp.com/avatars/");
    });

    it("ne fête pas deux fois le même palier", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        userProfileFindMany.mockResolvedValue([celebrating()]);
        announcementFindMany.mockResolvedValue([{ discordId: DISCORD_ID, tierDays: 30 }]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([discordMember({ roles: [ROLE_A], joined_at: "2026-09-10T00:00:00.000Z" })]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.announcementsSent).toBe(0);
        expect(sendChannelMessage).not.toHaveBeenCalled();
        expect(announcementCreate).not.toHaveBeenCalled();
    });

    it("ne fête jamais un palier dont les rôles n'ont pas pu être posés (fail-closed)", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        userProfileFindMany.mockResolvedValue([celebrating()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([discordMember({ joined_at: "2026-09-10T00:00:00.000Z" })]),
        );
        addRoleToMember.mockResolvedValue(false);

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.rolesAdded).toBe(0);
        expect(sendChannelMessage).not.toHaveBeenCalled();
        expect(result.announcementsSent).toBe(0);
    });

    it("relâche la revendication quand l'envoi échoue (le palier ne doit pas être perdu)", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        userProfileFindMany.mockResolvedValue([celebrating()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([discordMember({ joined_at: "2026-09-10T00:00:00.000Z" })]),
        );
        sendChannelMessage.mockResolvedValue(null);

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.announcementsSent).toBe(0);
        expect(announcementDeleteMany).toHaveBeenCalledWith({
            where: { guildId: "guild-1", discordId: DISCORD_ID, tierDays: 30 },
        });
    });

    it("pose les rôles sans rien poster quand aucun salon n'est réglé", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow({ seniorityRolesChannelId: null })]);
        userProfileFindMany.mockResolvedValue([celebrating()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([discordMember({ joined_at: "2026-09-10T00:00:00.000Z" })]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.rolesAdded).toBe(1);
        expect(sendChannelMessage).not.toHaveBeenCalled();
        expect(result.announcementsSent).toBe(0);
    });

    it("un profil sans compte Discord est ignoré, mais un membre du serveur sans profil reçoit ses rôles", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        // Ce profil n'a aucun compte Discord : il ne peut désigner personne.
        userProfileFindMany.mockResolvedValue([profileRow({ user: { name: "Sans lien", accounts: [] } })]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([discordMember({ joined_at: "2026-09-10T00:00:00.000Z" })]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        // Le membre vient de Discord, pas du dashboard : il reçoit quand même son rôle…
        expect(addRoleToMember).toHaveBeenCalledWith("1290442961380835451", DISCORD_ID, ROLE_A);
        expect(result.membersChecked).toBe(1);
        // … et compte comme « sans profil » (l'embed portera le CTA « crée ton profil »).
        expect(result.membersUnregistered).toBe(1);
    });

    it("ne touche à rien sans jeton de bot (fail-closed, et sans requête)", async () => {
        delete process.env.DISCORD_BOT_TOKEN;
        guildConfigFindMany.mockResolvedValue([guildRow()]);

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.errors.join(" ")).toContain("DISCORD_BOT_TOKEN");
        expect(guildConfigFindMany).not.toHaveBeenCalled();
    });
});

describe("Y-2 — route cron", () => {
    const request = () => new NextRequest("http://localhost/api/cron/seniority-roles");

    it("refuse sans secret (fail-closed) et n'exécute rien", async () => {
        verifyCronSecret.mockReturnValue(false);

        const res = await GET(request());

        expect(res.status).toBe(401);
        expect(recordCronExecution).not.toHaveBeenCalled();
        expect(guildConfigFindMany).not.toHaveBeenCalled();
    });

    it("enregistre son passage dans la télémétrie quand le secret est bon", async () => {
        verifyCronSecret.mockReturnValue(true);

        const res = await GET(request());

        expect(res.status).toBe(200);
        expect(recordCronExecution).toHaveBeenCalledWith(
            "seniority_roles",
            expect.objectContaining({ success: true, summary: expect.stringContaining("guilde") }),
        );
    });
});

describe("Y-2 — câblage (rien d'oublié)", () => {
    it("la tâche est déclarée dans la télémétrie des crons (panneau God + Sentry)", () => {
        const telemetry = source(TELEMETRY);
        expect(telemetry).toContain("seniority_roles:");
        expect(telemetry).toContain("seniority-roles.log");
    });

    it("le core n'est pas exposé au client et ne logue pas en console", () => {
        const code = codeOnly(CORE);
        expect(code).not.toContain('"use server"');
        expect(code).not.toContain("console.log");
    });

    it("la route vérifie le secret avant d'appeler le core", () => {
        const code = source(ROUTE);
        expect(code.indexOf("verifyCronSecret(req)")).toBeLessThan(
            code.indexOf('await import("@/server/seniority-roles-core")'),
        );
    });

    it("la migration porte la colonne d'activation ET la clé unique du suivi", () => {
        expect(existsSync(MIGRATION)).toBe(true);
        const sql = source(MIGRATION);
        expect(sql).toContain('"seniorityRolesActivatedAt"');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "SeniorityRoleAnnouncement"');
        expect(sql).toContain("SeniorityRoleAnnouncement_guildId_discordId_tierDays_key");
    });

    it("le schéma déclare le modèle de suivi et la colonne d'activation", () => {
        const schema = source(SCHEMA);
        expect(schema).toContain("model SeniorityRoleAnnouncement {");
        expect(schema).toContain("@@unique([guildId, discordId, tierDays])");
        expect(schema).toContain("seniorityRolesActivatedAt");
    });

    it("le core passe par le diff et les règles pures, jamais par une règle réécrite", () => {
        const code = source(CORE);
        expect(code).toContain("computeSeniorityRoleDiff");
        expect(code).toContain("shouldCelebrateSeniorityTier");
        expect(code).toContain("mergeSeniorityRolesConfig");
        expect(code).toContain("renderSeniorityAnnouncement");
    });
});