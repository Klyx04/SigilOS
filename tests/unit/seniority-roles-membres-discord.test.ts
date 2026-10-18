/**
 * Rôles d'ancienneté — **les membres hors dashboard** (demande user du 18/10/2026) et
 * l'observabilité de la passe.
 *
 * 🐛 Le bug qui a motivé ce fichier : le `select` du cron omettait
 * `seniorityRolesEnabled` en ne gardant que le `where`. `mergeSeniorityRolesConfig` relisait
 * donc `undefined` ⇒ `enabled = false` ⇒ **toute guilde était sautée**, en 19 ms, sans un
 * mot (« 0 guilde(s) traitée(s) · 0 rôle(s) », mesuré sur la bêta). Le `select` est
 * désormais **lu** par un type (`SeniorityGuildRow[]`) : retirer le champ ne compile plus.
 *
 * 🔒 Ce que ce fichier verrouille :
 *  ① le champ d'activation est sélectionné (garde de compilation) ;
 *  ② une guilde sautée **dit pourquoi** (`telemetryDetails` + `details` + `logger.warn`) ;
 *  ③ un membre **sans profil** reçoit ses rôles et une carte portant le CTA « crée ton profil »,
 *    avec le lien **de l'environnement** ;
 *  ④ un membre **inscrit** ne reçoit jamais ce CTA ;
 *  ⑤ le rattrapage est borné (10 cartes/passe, une par membre, au palier le plus haut) et
 *    les non-servis repartent à la passe suivante ;
 *  ⑥ le résumé du cron porte enfin « guilde(s) sautée(s) » et « membre(s) vérifié(s) ».
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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

const loggerWarn = vi.fn();
const loggerError = vi.fn();
vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: (...args: unknown[]) => loggerWarn(...args), error: (...args: unknown[]) => loggerError(...args), debug: vi.fn() },
}));

const verifyCronSecret = vi.fn();
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: (...args: unknown[]) => verifyCronSecret(...args) }));

const recordCronExecution = vi.fn();
vi.mock("@/lib/cron-telemetry", () => ({
    recordCronExecution: (...args: unknown[]) => recordCronExecution(...args),
    KNOWN_CRON_TASKS: {},
}));

import { MAX_RETRO_ANNOUNCEMENTS_PER_PASS, syncSeniorityRolesCore } from "@/server/seniority-roles-core";
import { GET } from "@/app/api/cron/seniority-roles/route";

const CORE = "src/server/seniority-roles-core.ts";
const NOW = new Date("2026-10-15T04:30:00.000Z");
const GUILD_ID = "1290442961380835451";
const CHANNEL = "200000000000000009";
const ROLE_A = "200000000000000001";
const ROLE_B = "200000000000000002";
const ROLE_C = "200000000000000003";

/** Guilde **activée** telle que le core la lit (le champ est désormais dans le `select`). */
const guildRow = (overrides: Record<string, unknown> = {}) => ({
    id: "guild-1",
    discordGuildId: GUILD_ID,
    name: "STELLIUM",
    iconUrl: null,
    seniorityRolesEnabled: true,
    seniorityRolesChannelId: CHANNEL,
    seniorityRolesTiers: [
        { days: 30, roleIds: [ROLE_A] },
        { days: 180, roleIds: [ROLE_B] },
        { days: 365, roleIds: [ROLE_C] },
    ],
    seniorityRolesAnnouncement: null,
    seniorityRolesActivatedAt: new Date("2026-10-01T04:30:00.000Z"),
    ...overrides,
});

const member = (id: string, overrides: Record<string, unknown> = {}) => ({
    user: { id, username: `membre-${id.slice(-2)}`, global_name: null, avatar: null },
    nick: null,
    avatar: null,
    roles: [] as string[],
    joined_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
});

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

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("S0-fix — le champ d'activation est LU, pas seulement filtré", () => {
    it("le `select` contient `seniorityRolesEnabled` et le résultat est typé", () => {
        const core = readFileSync(CORE, "utf8");
        // ① le champ est sélectionné (une fenêtre bornée : on ne matche pas tout le fichier)…
        expect(core).toMatch(/select: \{[\s\S]{0,600}?seniorityRolesEnabled: true/);
        // ② … et le `findMany` est annoté : retirer le champ ne compile plus.
        expect(core).toMatch(/const guilds: SeniorityGuildRow\[\] = await db\.guildConfig\.findMany/);
        // ③ le champ est bien celui que la fusion relit.
        expect(core).toContain("mergeSeniorityRolesConfig(guild)");
    });

    it("une guilde réellement activée est traitée (le bug la sautait en 19 ms)", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([
                member("200000000000000101", {
                    joined_at: "2026-04-01T00:00:00.000Z",
                    roles: [ROLE_A, ROLE_B],
                }),
            ]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.guildsProcessed).toBe(1);
        expect(result.guildsSkipped).toBe(0);
        expect(result.membersChecked).toBe(1);
    });
});

describe("S1 — une guilde sautée dit enfin pourquoi", () => {
    it("module coupé : telemetryDetails + details + warn", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow({ seniorityRolesEnabled: false })]);

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.guildsSkipped).toBe(1);
        expect(result.telemetryDetails.STELLIUM).toContain("sautée");
        expect(result.telemetryDetails.STELLIUM).toContain("module désactivé");
        expect(result.details.join(" ")).toContain("STELLIUM : sautée");
        expect(loggerWarn).toHaveBeenCalledWith(
            "[SeniorityRoles] Guilde sautée",
            expect.objectContaining({ guild: "STELLIUM" }),
        );
    });

    it("paliers tous rejetés : le motif dit « N lu(s), 0 retenu(s) »", async () => {
        guildConfigFindMany.mockResolvedValue([
            // `days` en texte : la règle refuse l'entrée, et le résumé doit le dire.
            guildRow({ seniorityRolesTiers: [{ days: "30", roleIds: [ROLE_A] }] }),
        ]);

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.telemetryDetails.STELLIUM).toContain("1 palier(s) lu(s), 0 retenu(s)");
    });

    it("le résumé enregistré porte sautées / membres vérifiés / détail par guilde", async () => {
        verifyCronSecret.mockReturnValue(true);
        guildConfigFindMany.mockResolvedValue([guildRow({ seniorityRolesEnabled: false })]);

        await GET(new NextRequest("http://localhost/api/cron/seniority-roles"));

        const [, payload] = recordCronExecution.mock.calls[0];
        expect(payload.summary).toContain("0 guilde(s) traitée(s) · 1 sautée(s)");
        expect(payload.summary).toContain("membre(s) vérifié(s)");
        expect(payload.details).toMatchObject({ STELLIUM: expect.stringContaining("sautée") });
    });
});

describe("S2 — les membres hors dashboard reçoivent rôle + carte", () => {
    it("sans profil : rôle posé, carte avec le CTA et le lien de l'ENVIRONNEMENT", async () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://beta.sigilos.fr");
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([member("200000000000000101", { joined_at: "2026-09-10T00:00:00.000Z" })]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(addRoleToMember).toHaveBeenCalledWith(GUILD_ID, "200000000000000101", ROLE_A);
        expect(result.membersUnregistered).toBe(1);
        expect(result.announcementsSent).toBe(1);

        const [, , options] = sendChannelMessage.mock.calls[0];
        expect(options.fields).toEqual([
            expect.objectContaining({
                name: "🎯 Pas encore inscrit ?",
                value: expect.stringContaining("https://beta.sigilos.fr/dashboard"),
            }),
        ]);
        expect(options.fields[0].value).toContain("ladder de la guilde");
    });

    it("inscrit : jamais le CTA (on ne lui dit pas de créer un profil)", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        userProfileFindMany.mockResolvedValue([
            {
                guildJoinedAt: null,
                discordJoinedAt: new Date("2026-09-10T00:00:00.000Z"),
                createdAt: new Date("2026-09-10T00:00:00.000Z"),
                pseudoDofus: "Klyx",
                discordNickname: "Klyx",
                user: { name: "Klyx", accounts: [{ provider: "discord", providerAccountId: "200000000000000101" }] },
            },
        ]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([member("200000000000000101", { joined_at: "2026-09-10T00:00:00.000Z" })]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.membersUnregistered).toBe(0);
        const [, , options] = sendChannelMessage.mock.calls[0];
        expect(options.fields).toBeUndefined();
    });

    it("un bot n'est jamais traité", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(
            memberList([
                member("200000000000000101", {
                    user: { id: "200000000000000101", username: "bot", bot: true, global_name: null, avatar: null },
                    joined_at: "2020-01-01T00:00:00.000Z",
                }),
            ]),
        );

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.membersChecked).toBe(0);
        expect(addRoleToMember).not.toHaveBeenCalled();
    });

    it("liste tronquée : la passe le dit (jamais en silence)", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(memberList([], true));

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.details.join(" ")).toContain("liste tronquée");
        expect(loggerWarn).toHaveBeenCalledWith(
            "[SeniorityRoles] Liste de membres tronquée",
            expect.anything(),
        );
    });
});

describe("S3 — rattrapage borné (jamais 47 pings d'un coup)", () => {
    /** Douze membres de 287 jours : paliers 30 et 180 atteints, tous deux AVANT l'activation. */
    const retroMembers = (count: number) =>
        Array.from({ length: count }, (_, index) =>
            member(`200000000000001${String(index).padStart(3, "0")}`, {
                joined_at: "2026-01-01T00:00:00.000Z",
                roles: [ROLE_A, ROLE_B],
            }),
        );

    it("sans demande explicite : rien n'est envoyé, le reliquat est compté", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(memberList(retroMembers(12)));

        const result = await syncSeniorityRolesCore({ now: NOW });

        expect(result.retroactiveAnnouncementsSent).toBe(0);
        expect(result.retroactiveAnnouncementsPending).toBe(12);
        expect(sendChannelMessage).not.toHaveBeenCalled();
        expect(result.rolesAdded).toBe(0);
    });

    it("avec demande : MAX par passe, une carte par membre, au palier le plus haut", async () => {
        guildConfigFindMany.mockResolvedValue([guildRow()]);
        fetchAllGuildMembersDetailed.mockResolvedValue(memberList(retroMembers(12)));

        const result = await syncSeniorityRolesCore({ now: NOW, announceRetroactive: true });

        expect(MAX_RETRO_ANNOUNCEMENTS_PER_PASS).toBe(10);
        expect(result.retroactiveAnnouncementsSent).toBe(10);
        expect(result.retroactiveAnnouncementsPending).toBe(2);
        expect(sendChannelMessage).toHaveBeenCalledTimes(10);
        // Une seule carte par membre, au palier **le plus haut** atteint (180, pas 30).
        for (const call of sendChannelMessage.mock.calls) {
            const options = call[2];
            expect(options.embedDescription).toContain(`<@&${ROLE_B}>`);
            expect(options.embedDescription).not.toContain(`<@&${ROLE_A}>`);
        }
    });
});

describe("S2 — alias `{rôles}` et variables inconnues (mesure du 18/10/2026)", () => {
    it("l'alias accentué est remplacé, pas laissé littéral", async () => {
        const { renderSeniorityAnnouncementText, buildSeniorityAnnouncementValues } = await import(
            "@/lib/seniority-roles"
        );
        const values = buildSeniorityAnnouncementValues({
            member: { discordId: "200000000000000101", displayName: "Klyx" },
            guildName: "STELLIUM",
            seniorityDays: 200,
            awardedRoleIds: [ROLE_A],
        });
        const text = renderSeniorityAnnouncementText(
            "Tu atteins le rôle {rôles} / {role} / {rôle} — {lien}",
            values,
            { lien: "https://sigilos.fr/dashboard" },
        );
        expect(text).not.toContain("{r");
        expect(text).toContain(`<@&${ROLE_A}>`);
        expect(text).toContain("https://sigilos.fr/dashboard");
    });

    it("une faute de frappe restante est signalée, sans bloquer l'enregistrement", async () => {
        const { findUnknownAnnouncementVariables } = await import("@/lib/seniority-roles");
        expect(findUnknownAnnouncementVariables("Salut {membre}, tu es {anciennete} chez {guilde}")).toEqual([]);
        expect(findUnknownAnnouncementVariables("Le rôle {roles} et {rolé}")).toEqual(["rolé"]);
    });
});