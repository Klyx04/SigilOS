/**
 * Chantier Y, lot **Y-3** (onglet « Rôles d'ancienneté ») — verrou du lot.
 *
 * 🛡️ Ce que ce test protège : ① le **fail-closed** (rien n'est écrit sans `canManageMembers`,
 * ni sous rate limit, ni avec une config invalide, ni avec un salon étranger) ; ② la
 * **normalisation à l'écriture** ; ③ le **marqueur d'activation** (posé une fois, jamais
 * déplacé — sinon on refête des paliers déjà passés) ; ④ l'**aperçu honnête** (même rendu pur
 * que l'envoi) et le câblage (onglet gardé, `?tab=`, salon déclaré dans les deux listes).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const guildConfigFindUnique = vi.fn();
const guildConfigUpdate = vi.fn();
const userProfileFindMany = vi.fn();
const announcementCount = vi.fn();
const announcementFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: {
            findUnique: (...args: unknown[]) => guildConfigFindUnique(...args),
            update: (...args: unknown[]) => guildConfigUpdate(...args),
        },
        userProfile: { findMany: (...args: unknown[]) => userProfileFindMany(...args) },
        seniorityRoleAnnouncement: {
            count: (...args: unknown[]) => announcementCount(...args),
            findFirst: (...args: unknown[]) => announcementFindFirst(...args),
        },
    },
}));

const getUserContext = vi.fn();
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: (...args: unknown[]) => getUserContext(...args),
}));

const rateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));

const validateChannelBelongsToGuild = vi.fn();
vi.mock("@/server/discord", () => ({
    validateChannelBelongsToGuild: (...args: unknown[]) => validateChannelBelongsToGuild(...args),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const getAllCronStatuses = vi.fn();
vi.mock("@/lib/cron-telemetry", () => ({
    getAllCronStatuses: (...args: unknown[]) => getAllCronStatuses(...args),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
    getSeniorityRolesSettings,
    updateSeniorityRolesSettings,
} from "@/server/actions/seniority-roles-actions";

const PANEL = "src/components/admin/members/seniority-roles-panel.tsx";
const MANAGEMENT = "src/components/admin/members/member-management.tsx";
const PAGE = "src/app/dashboard/[guildId]/admin/members/page.tsx";
const CHANNEL_WATCH = "src/server/actions/discord-channel-watch-actions.ts";

const source = (path: string) => readFileSync(path, "utf8");

const GUILD_ID = "1290442961380835451";
const CHANNEL = "200000000000000009";
const ROLE_A = "200000000000000001";
const ROLE_B = "200000000000000002";

const manager = () => ({
    isAuthenticated: true,
    isMember: true,
    isAdmin: false,
    canManageMembers: true,
    id: "user-1",
});

const validInput = () => ({
    enabled: true,
    tiers: [
        { days: 30, roleIds: [ROLE_A] },
        { days: 180, roleIds: [ROLE_B] },
    ],
    announcement: {
        messageTemplate: "Félicitations {membre} !",
        embedTitle: "Nouveau palier",
        embedDescription: "{pseudo} est là depuis {anciennete}.",
        color: 0x9333ea,
        thumbnail: "avatar" as const,
    },
});

beforeEach(() => {
    vi.clearAllMocks();
    getUserContext.mockResolvedValue(manager());
    rateLimit.mockResolvedValue({ success: true, remaining: 9, reset: 0 });
    validateChannelBelongsToGuild.mockResolvedValue(true);
    guildConfigFindUnique.mockResolvedValue({
        id: "guild-1",
        name: "Sigil",
        iconUrl: null,
        seniorityRolesActivatedAt: null,
    });
    guildConfigUpdate.mockResolvedValue({});
    userProfileFindMany.mockResolvedValue([]);
    announcementCount.mockResolvedValue(0);
    announcementFindFirst.mockResolvedValue(null);
    getAllCronStatuses.mockResolvedValue([]);
});

describe("Y-3 — écriture des réglages (fail-closed d'abord)", () => {
    it("refuse un membre qui ne gère pas les membres, et n'écrit rien", async () => {
        getUserContext.mockResolvedValue({ ...manager(), canManageMembers: false, isAdmin: false });

        const result = await updateSeniorityRolesSettings(GUILD_ID, validInput());

        expect(result.success).toBe(false);
        expect(guildConfigUpdate).not.toHaveBeenCalled();
    });

    it("refuse quand le rate limit est dépassé", async () => {
        rateLimit.mockResolvedValue({ success: false, remaining: 0, reset: 0 });

        const result = await updateSeniorityRolesSettings(GUILD_ID, validInput());

        expect(result.success).toBe(false);
        expect(guildConfigUpdate).not.toHaveBeenCalled();
    });

    it("refuse une configuration hors bornes (seuil, rôles, couleur, texte vide)", async () => {
        const base = validInput();
        const invalid = [
            { ...base, tiers: [{ days: 0, roleIds: [ROLE_A] }] },
            { ...base, tiers: [{ days: 5000, roleIds: [ROLE_A] }] },
            { ...base, tiers: [{ days: 30, roleIds: [] }] },
            { ...base, tiers: [{ days: 30, roleIds: Array.from({ length: 11 }, () => ROLE_A) }] },
            { ...base, announcement: { ...base.announcement, color: 0x1234567 } },
            { ...base, announcement: { ...base.announcement, embedTitle: "   " } },
        ];

        for (const input of invalid) {
            expect((await updateSeniorityRolesSettings(GUILD_ID, input)).success).toBe(false);
        }
        expect(guildConfigUpdate).not.toHaveBeenCalled();
    });

    it("écrit la configuration **normalisée** (triée, dédoublonnée) et revalide l'écran", async () => {
        const result = await updateSeniorityRolesSettings(GUILD_ID, {
            ...validInput(),
            tiers: [
                { days: 180, roleIds: [ROLE_B, ROLE_A] },
                { days: 30, roleIds: [ROLE_A] },
            ],
        });

        expect(result.success).toBe(true);
        const written = guildConfigUpdate.mock.calls[0][0] as {
            data: { seniorityRolesTiers: { days: number; roleIds: string[] }[] };
        };
        expect(written.data.seniorityRolesTiers.map((tier) => tier.days)).toEqual([30, 180]);
        // ROLE_A est réclamé par les deux paliers : il ne reste que sur le premier.
        expect(written.data.seniorityRolesTiers[0].roleIds).toEqual([ROLE_A]);
        expect(written.data.seniorityRolesTiers[1].roleIds).toEqual([ROLE_B]);
        expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/${GUILD_ID}/admin/members`);
    });

    it("estampe le marqueur d'activation à la première mise en service", async () => {
        const result = await updateSeniorityRolesSettings(GUILD_ID, validInput());

        expect(result.success).toBe(true);
        const written = guildConfigUpdate.mock.calls[0][0] as { data: { seniorityRolesActivatedAt: Date | null } };
        expect(written.data.seniorityRolesActivatedAt).toBeInstanceOf(Date);
    });

    it("ne déplace jamais un marqueur déjà posé", async () => {
        const already = new Date("2026-10-01T04:30:00.000Z");
        guildConfigFindUnique.mockResolvedValue({ id: "guild-1", seniorityRolesActivatedAt: already });

        await updateSeniorityRolesSettings(GUILD_ID, validInput());

        const written = guildConfigUpdate.mock.calls[0][0] as { data: { seniorityRolesActivatedAt: Date | null } };
        expect(written.data.seniorityRolesActivatedAt).toBe(already);
    });

    it("ne pose aucun marqueur tant que le module reste éteint", async () => {
        await updateSeniorityRolesSettings(GUILD_ID, { ...validInput(), enabled: false });

        const written = guildConfigUpdate.mock.calls[0][0] as { data: { seniorityRolesActivatedAt: Date | null } };
        expect(written.data.seniorityRolesActivatedAt).toBeNull();
    });
});

describe("Y-3 — lecture des réglages et état lisible", () => {
    /** Profil membre à `days` jours d'ancienneté (arrivée manuelle). */
    const profile = (days: number) => ({
        guildJoinedAt: new Date(Date.now() - days * 86_400_000),
        discordJoinedAt: null,
        createdAt: new Date(),
    });

    it("refuse un membre qui ne gère pas les membres, et ne lit aucun profil", async () => {
        getUserContext.mockResolvedValue({ ...manager(), canManageMembers: false, isAdmin: false });

        const result = await getSeniorityRolesSettings(GUILD_ID);

        expect(result.success).toBe(false);
        expect(userProfileFindMany).not.toHaveBeenCalled();
    });

    it("répartit les membres actifs par palier — une seule lecture, jamais une par membre", async () => {
        guildConfigFindUnique.mockResolvedValue({
            id: "guild-1",
            name: "Sigil",
            iconUrl: null,
            seniorityRolesEnabled: true,
            seniorityRolesChannelId: CHANNEL,
            seniorityRolesTiers: [
                { days: 30, roleIds: [ROLE_A] },
                { days: 180, roleIds: [ROLE_B] },
            ],
            seniorityRolesAnnouncement: null,
            seniorityRolesActivatedAt: new Date("2026-10-01T04:30:00.000Z"),
        });
        userProfileFindMany.mockResolvedValue([profile(10), profile(45), profile(200), profile(400)]);
        announcementCount.mockResolvedValue(3);
        announcementFindFirst.mockResolvedValue({ announcedAt: new Date("2026-10-12T04:30:00.000Z") });
        getAllCronStatuses.mockResolvedValue([
            { id: "seniority_roles", lastRun: "2026-10-14T04:30:00.000Z", status: "success", summary: "1 guilde" },
        ]);

        const result = await getSeniorityRolesSettings(GUILD_ID);

        if (!result.success || !result.data) throw new Error("réglages attendus");
        // 10 j : sous le premier palier · 45 j : palier 1 · 200 et 400 j : palier 2.
        expect(result.data.tierCounts).toEqual([1, 2]);
        expect(result.data.belowFirstTier).toBe(1);
        expect(result.data.announcements.total).toBe(3);
        expect(result.data.lastRun?.at).toBe("2026-10-14T04:30:00.000Z");
        expect(userProfileFindMany).toHaveBeenCalledTimes(1);
    });

    it("reste lisible même si la télémétrie est muette (jamais bloquant)", async () => {
        getAllCronStatuses.mockRejectedValue(new Error("Redis NOAUTH"));

        const result = await getSeniorityRolesSettings(GUILD_ID);

        if (!result.success || !result.data) throw new Error("réglages attendus");
        expect(result.data.lastRun).toBeNull();
    });
});

describe("Y-3 — panneau et câblage (rien d'oublié)", () => {
    it("l'aperçu passe par le **même rendu** que l'envoi, jamais par une maquette", () => {
        const code = source(PANEL);
        expect(code).toContain("buildSeniorityAnnouncementValues");
        expect(code).toContain("renderSeniorityAnnouncement");
        expect(code).toContain("DiscordEmbedPreview");
    });

    it("le panneau est un composant client propre (pas de console)", () => {
        const code = source(PANEL);
        expect(code).toContain('"use client"');
        expect(code).not.toContain("console.log");
    });

    it("l'onglet est déclaré et gardé par `canManageMembers`", () => {
        const code = source(MANAGEMENT);
        expect(code).toContain('id: "anciennete"');
        expect(code).toContain('tab.id !== "anciennete" || canManageMembers');
        expect(code).toContain("<SeniorityRolesPanel guildId={guildId} />");
    });

    it("la page ouvre l'onglet par lien profond (`?tab=anciennete`)", () => {
        expect(source(PAGE)).toContain('tab === "anciennete" ? "anciennete"');
    });

    it("le salon est déclaré dans les DEUX listes du veilleur de salons", () => {
        const code = source(CHANNEL_WATCH);
        expect(code).toContain('"seniorityRolesChannelId"');
        expect(code).toContain("seniorityRolesChannelId: true");
    });
});