/**
 * Chantier Y — **le salon de l'annonce vit dans Paramètres** (décision « tous les salons du dépôt
 * se déclarent dans Paramètres »).
 *
 * 🛡️ Ce que ce test protège :
 * ① le nouveau réglage (`updateSeniorityRolesChannel`) est gardé comme les autres : RBAC
 *    `canManageMembers`, rate limit, Zod borné, **salon vérifié auprès de Discord** ;
 * ② **une seule porte par réglage** : l'onglet Membres n'écrit plus le salon (ni son action, ni
 *    son écran) — aucun écran ne peut donc écraser les réglages de l'autre ;
 * ③ le câblage : onglet déclaré dans Paramètres, rendu, et l'onglet Membres **renvoie** vers lui.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const guildConfigFindUnique = vi.fn();
const guildConfigUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: {
            findUnique: (...args: unknown[]) => guildConfigFindUnique(...args),
            update: (...args: unknown[]) => guildConfigUpdate(...args),
        },
        userProfile: { findMany: vi.fn().mockResolvedValue([]) },
        seniorityRoleAnnouncement: {
            count: vi.fn().mockResolvedValue(0),
            findFirst: vi.fn().mockResolvedValue(null),
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
vi.mock("@/lib/cron-telemetry", () => ({ getAllCronStatuses: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { updateSeniorityRolesChannel } from "@/server/actions/seniority-roles-actions";

const ACTIONS = "src/server/actions/seniority-roles-actions.ts";
const PANEL = "src/components/admin/members/seniority-roles-panel.tsx";
const SETTINGS_CLIENT = "src/app/dashboard/[guildId]/admin/_components/seniority-roles-settings-client.tsx";
const SETTINGS_PAGE = "src/app/dashboard/[guildId]/admin/settings/page.tsx";

const source = (path: string) => readFileSync(path, "utf8");

const GUILD_ID = "1290442961380835451";
const CHANNEL = "200000000000000009";

/** Contexte « gestion des membres » (le même flag que l'onglet). */
const manager = () => ({
    isAuthenticated: true,
    isMember: true,
    isAdmin: false,
    canManageMembers: true,
    id: "user-1",
});

beforeEach(() => {
    vi.clearAllMocks();
    getUserContext.mockResolvedValue(manager());
    rateLimit.mockResolvedValue({ success: true, remaining: 9, reset: 0 });
    validateChannelBelongsToGuild.mockResolvedValue(true);
    guildConfigFindUnique.mockResolvedValue({ id: "guild-1" });
    guildConfigUpdate.mockResolvedValue({});
});

describe("G — le salon de l'annonce (Paramètres → Ancienneté)", () => {
    it("refuse un membre qui ne gère pas les membres, et n'écrit rien", async () => {
        getUserContext.mockResolvedValue({ ...manager(), canManageMembers: false });

        const result = await updateSeniorityRolesChannel(GUILD_ID, { channelId: CHANNEL });

        expect(result.success).toBe(false);
        expect(guildConfigUpdate).not.toHaveBeenCalled();
    });

    it("refuse sous rate limit, et refuse un identifiant de salon invalide", async () => {
        rateLimit.mockResolvedValue({ success: false, remaining: 0, reset: 0 });
        expect((await updateSeniorityRolesChannel(GUILD_ID, { channelId: CHANNEL })).success).toBe(false);

        rateLimit.mockResolvedValue({ success: true, remaining: 9, reset: 0 });
        expect((await updateSeniorityRolesChannel(GUILD_ID, { channelId: "#annonces" })).success).toBe(false);
        expect((await updateSeniorityRolesChannel(GUILD_ID, { channelId: "42" })).success).toBe(false);
        // Champ surnuméraire : schéma strict (une porte par réglage, un seul champ).
        expect((await updateSeniorityRolesChannel(GUILD_ID, { channelId: CHANNEL, tiers: [] })).success).toBe(
            false,
        );
        expect(guildConfigUpdate).not.toHaveBeenCalled();
    });

    it("refuse un salon qui n'appartient pas à la guilde (isolation vérifiée serveur)", async () => {
        validateChannelBelongsToGuild.mockResolvedValue(false);

        const result = await updateSeniorityRolesChannel(GUILD_ID, { channelId: CHANNEL });

        expect(result.success).toBe(false);
        expect(guildConfigUpdate).not.toHaveBeenCalled();
    });

    it("écrit **uniquement** le salon et revalide les deux écrans", async () => {
        const result = await updateSeniorityRolesChannel(GUILD_ID, { channelId: CHANNEL });

        expect(result.success).toBe(true);
        expect(guildConfigUpdate).toHaveBeenCalledWith({
            where: { id: "guild-1" },
            data: { seniorityRolesChannelId: CHANNEL },
        });
        expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/${GUILD_ID}/admin/settings`);
        expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/${GUILD_ID}/admin/members`);
    });

    it("accepte « aucun salon » (les rôles sont posés en silence)", async () => {
        const result = await updateSeniorityRolesChannel(GUILD_ID, { channelId: null });

        expect(result.success).toBe(true);
        expect(guildConfigUpdate).toHaveBeenCalledWith({
            where: { id: "guild-1" },
            data: { seniorityRolesChannelId: null },
        });
        // Aucun salon ⇒ aucune requête Discord inutile.
        expect(validateChannelBelongsToGuild).not.toHaveBeenCalled();
    });
});

describe("G — une seule porte par réglage", () => {
    it("l'action de l'onglet Membres n'écrit plus le salon", () => {
        const actions = source(ACTIONS);
        // Le corps de `updateSeniorityRolesSettings` ne doit plus toucher au salon…
        const settingsAction = actions.slice(
            actions.indexOf("export async function updateSeniorityRolesSettings"),
            actions.indexOf("export async function updateSeniorityRolesChannel"),
        );
        expect(settingsAction.length).toBeGreaterThan(0);
        expect(settingsAction).not.toContain("seniorityRolesChannelId");
        // …et le seul écrivain du salon est la nouvelle action dédiée.
        expect(actions).toContain("data: { seniorityRolesChannelId: parsed.data.channelId }");
        // L'écran de l'onglet Membres n'a plus de sélecteur de salon.
        expect(source(PANEL)).not.toContain("DiscordChannelPicker");
    });

    it("l'onglet Membres renvoie vers Paramètres → Ancienneté", () => {
        expect(source(PANEL)).toContain("admin/settings?tab=anciennete");
    });

    it("l'écran du salon vit dans Paramètres, avec le seul champ du salon", () => {
        const client = source(SETTINGS_CLIENT);
        expect(client).toContain("updateSeniorityRolesChannel");
        expect(client).toContain("DiscordChannelPicker");
        expect(client).not.toContain("updateSeniorityRolesSettings");
    });

    it("l'onglet est déclaré et rendu dans la page Paramètres", () => {
        const page = source(SETTINGS_PAGE);
        expect(page).toContain('id: "anciennete"');
        expect(page).toContain('resolvedTab === "anciennete" && <SeniorityRolesSettingsClient');
    });
});