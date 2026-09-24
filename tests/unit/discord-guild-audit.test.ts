import { describe, it, expect } from "vitest";
import {
    computeEffectivePermissions,
    checkChannelPermsEngine,
    checkRoleHierarchyEngine,
    checkBotGlobalPerms,
    missingPermNames,
    AUDIT_PERM,
    POST_EMBED_PERMS,
    type AuditEngineContext,
    type DiscordChannelLike,
} from "@/lib/discord-audit-engine";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const GUILD_ID = "111000111000111000";
const BOT_USER_ID = "999000999000999000";
const BOT_ROLE_ID = "888000888000888000";
const CHANNEL_ID = "777000777000777000";
const ROLE_ID = "666000666000666000";

/** Contexte de base : bot avec POST_EMBED au niveau serveur, pas d'overwrites */
function makeCtx(overrides: Partial<AuditEngineContext> = {}): AuditEngineContext {
    return {
        guildId: GUILD_ID,
        botUserId: BOT_USER_ID,
        botRoleIds: [BOT_ROLE_ID],
        botHighestPosition: 10,
        botGlobalPerms: POST_EMBED_PERMS,
        channels: [
            { id: CHANNEL_ID, name: "test-channel", type: 0, position: 0, permission_overwrites: [] },
        ],
        roles: [
            { id: GUILD_ID, name: "@everyone", position: 0, permissions: POST_EMBED_PERMS.toString() },
            { id: BOT_ROLE_ID, name: "SigilOS", position: 10, permissions: POST_EMBED_PERMS.toString() },
        ],
        ...overrides,
    };
}

function makeChannel(overrides: Partial<DiscordChannelLike> = {}): DiscordChannelLike {
    return { id: CHANNEL_ID, name: "test-channel", type: 0, position: 0, permission_overwrites: [], ...overrides };
}

// ─── computeEffectivePermissions ─────────────────────────────────────────────

describe("computeEffectivePermissions", () => {
    it("retourne les permissions de base si aucun overwrite", () => {
        const ctx = makeCtx();
        const channel = makeChannel();
        const perms = computeEffectivePermissions(ctx, channel);
        expect(perms & AUDIT_PERM.SEND_MESSAGES).toBeTruthy();
        expect(perms & AUDIT_PERM.EMBED_LINKS).toBeTruthy();
    });

    it("ADMINISTRATOR donne toutes les permissions (~0n)", () => {
        const ctx = makeCtx({
            roles: [{ id: BOT_ROLE_ID, name: "SigilOS", position: 10, permissions: AUDIT_PERM.ADMINISTRATOR.toString() }],
        });
        const perms = computeEffectivePermissions(ctx, makeChannel());
        expect(perms).toBe(~0n);
    });

    it("overwrite @everyone DENY retire la permission", () => {
        const ctx = makeCtx();
        const channel = makeChannel({
            permission_overwrites: [
                { id: GUILD_ID, type: 0, allow: "0", deny: AUDIT_PERM.SEND_MESSAGES.toString() },
            ],
        });
        const perms = computeEffectivePermissions(ctx, channel);
        expect(perms & AUDIT_PERM.SEND_MESSAGES).toBe(0n);
    });

    it("overwrite rôle bot ALLOW remet la permission après DENY @everyone", () => {
        const ctx = makeCtx();
        const channel = makeChannel({
            permission_overwrites: [
                { id: GUILD_ID, type: 0, allow: "0", deny: AUDIT_PERM.SEND_MESSAGES.toString() },
                { id: BOT_ROLE_ID, type: 0, allow: AUDIT_PERM.SEND_MESSAGES.toString(), deny: "0" },
            ],
        });
        const perms = computeEffectivePermissions(ctx, channel);
        expect(perms & AUDIT_PERM.SEND_MESSAGES).toBeTruthy();
    });

    it("overwrite membre (type=1) prend le dessus sur les rôles", () => {
        const ctx = makeCtx();
        const channel = makeChannel({
            permission_overwrites: [
                // Le rôle bot donne SEND_MESSAGES
                { id: BOT_ROLE_ID, type: 0, allow: AUDIT_PERM.SEND_MESSAGES.toString(), deny: "0" },
                // Overwrite membre le retire
                { id: BOT_USER_ID, type: 1, allow: "0", deny: AUDIT_PERM.SEND_MESSAGES.toString() },
            ],
        });
        const perms = computeEffectivePermissions(ctx, channel);
        expect(perms & AUDIT_PERM.SEND_MESSAGES).toBe(0n);
    });
});

// ─── missingPermNames ─────────────────────────────────────────────────────────

describe("missingPermNames", () => {
    it("retourne vide si aucune permission manquante", () => {
        expect(missingPermNames(POST_EMBED_PERMS, POST_EMBED_PERMS)).toEqual([]);
    });

    it("identifie SEND_MESSAGES manquant", () => {
        const effective = AUDIT_PERM.VIEW_CHANNEL | AUDIT_PERM.EMBED_LINKS; // sans SEND_MESSAGES
        const missing = missingPermNames(POST_EMBED_PERMS, effective);
        expect(missing).toContain("SEND_MESSAGES");
        expect(missing).not.toContain("VIEW_CHANNEL");
        expect(missing).not.toContain("EMBED_LINKS");
    });

    it("identifie plusieurs permissions manquantes", () => {
        const missing = missingPermNames(POST_EMBED_PERMS, 0n);
        expect(missing).toContain("VIEW_CHANNEL");
        expect(missing).toContain("SEND_MESSAGES");
        expect(missing).toContain("EMBED_LINKS");
    });
});

// ─── checkChannelPermsEngine ──────────────────────────────────────────────────

describe("checkChannelPermsEngine", () => {
    const baseOpts = {
        label: "Notifications missions",
        impact: "Pas de notifications.",
        remedy: "Configurez un salon.",
        settingsHref: "/admin/settings",
    };

    it("blocked + suggestion quand channelId est null", () => {
        const ctx = makeCtx();
        const result = checkChannelPermsEngine(ctx, null, "mission-notify", {
            ...baseOpts,
            suggestion: {
                channelType: "TEXT",
                suggestedName: "missions-semaine",
                purpose: "Test",
                steps: ["Étape 1"],
            },
        });
        expect(result.status).toBe("blocked");
        expect(result.suggestion).toBeDefined();
        expect(result.suggestion?.suggestedName).toBe("missions-semaine");
    });

    it("blocked quand channelId est null sans suggestion", () => {
        const ctx = makeCtx();
        const result = checkChannelPermsEngine(ctx, null, "mission-notify", baseOpts);
        expect(result.status).toBe("blocked");
        expect(result.suggestion).toBeUndefined();
        expect(result.remedy).toContain("Configurez un salon.");
    });

    it("blocked quand le salon n'existe pas dans la liste Discord", () => {
        const ctx = makeCtx({ channels: [] }); // aucun salon visible
        const result = checkChannelPermsEngine(ctx, CHANNEL_ID, "mission-notify", baseOpts);
        expect(result.status).toBe("blocked");
        expect(result.title).toContain("introuvable");
        expect(result.technicalDetail).toContain(CHANNEL_ID);
    });

    it("blocked quand permissions insuffisantes", () => {
        const ctx = makeCtx({
            channels: [makeChannel({
                permission_overwrites: [
                    { id: GUILD_ID, type: 0, allow: "0", deny: AUDIT_PERM.SEND_MESSAGES.toString() },
                ],
            })],
        });
        const result = checkChannelPermsEngine(ctx, CHANNEL_ID, "mission-notify", baseOpts);
        expect(result.status).toBe("blocked");
        expect(result.technicalDetail).toContain("SEND_MESSAGES");
    });

    it("operational quand le salon existe et permissions OK", () => {
        const ctx = makeCtx();
        const result = checkChannelPermsEngine(ctx, CHANNEL_ID, "mission-notify", baseOpts);
        expect(result.status).toBe("operational");
        expect(result.technicalDetail).toContain("test-channel");
        expect(result.technicalDetail).toContain("OK");
    });

    it("operational avec ADMINISTRATOR même sans permissions explicites", () => {
        const ctx = makeCtx({
            roles: [{ id: BOT_ROLE_ID, name: "SigilOS", position: 10, permissions: AUDIT_PERM.ADMINISTRATOR.toString() }],
        });
        const result = checkChannelPermsEngine(ctx, CHANNEL_ID, "mission-notify", baseOpts);
        expect(result.status).toBe("operational");
    });
});

// ─── checkRoleHierarchyEngine ─────────────────────────────────────────────────

describe("checkRoleHierarchyEngine", () => {
    const baseRoleArgs = ["lifecycle-arrivingRoleId", "Rôle d'arrivée", "Rôle non attribué."] as const;

    it("retourne null si roleId est null (rôle optionnel non configuré)", () => {
        const ctx = makeCtx();
        expect(checkRoleHierarchyEngine(ctx, null, ...baseRoleArgs)).toBeNull();
    });

    it("warning si le rôle n'existe pas sur Discord", () => {
        const ctx = makeCtx(); // ROLE_ID n'est pas dans ctx.roles
        const result = checkRoleHierarchyEngine(ctx, ROLE_ID, ...baseRoleArgs);
        expect(result?.status).toBe("warning");
        expect(result?.title).toContain("introuvable");
    });

    it("blocked si le bot est en dessous du rôle cible", () => {
        const ctx = makeCtx({
            botHighestPosition: 5,
            roles: [
                { id: GUILD_ID, name: "@everyone", position: 0, permissions: "0" },
                { id: BOT_ROLE_ID, name: "SigilOS", position: 5, permissions: "0" },
                { id: ROLE_ID, name: "Membre", position: 8, permissions: "0" }, // plus haut
            ],
        });
        const result = checkRoleHierarchyEngine(ctx, ROLE_ID, ...baseRoleArgs);
        expect(result?.status).toBe("blocked");
        expect(result?.title).toContain("hiérarchie");
    });

    it("retourne null (OK) si le bot est au-dessus du rôle cible", () => {
        const ctx = makeCtx({
            botHighestPosition: 15,
            roles: [
                { id: GUILD_ID, name: "@everyone", position: 0, permissions: "0" },
                { id: BOT_ROLE_ID, name: "SigilOS", position: 15, permissions: "0" },
                { id: ROLE_ID, name: "Membre", position: 5, permissions: "0" },
            ],
        });
        const result = checkRoleHierarchyEngine(ctx, ROLE_ID, ...baseRoleArgs);
        expect(result).toBeNull();
    });
});

// ─── checkBotGlobalPerms ──────────────────────────────────────────────────────

describe("checkBotGlobalPerms", () => {
    it("operational avec ADMINISTRATOR", () => {
        const ctx = makeCtx({ botGlobalPerms: AUDIT_PERM.ADMINISTRATOR });
        const findings = checkBotGlobalPerms(ctx);
        expect(findings[0].status).toBe("operational");
        expect(findings[0].technicalDetail).toContain("ADMINISTRATOR");
    });

    it("operational si toutes les permissions de base sont présentes", () => {
        const ctx = makeCtx({
            botGlobalPerms: AUDIT_PERM.SEND_MESSAGES | AUDIT_PERM.EMBED_LINKS | AUDIT_PERM.READ_MESSAGE_HISTORY | AUDIT_PERM.USE_EXTERNAL_EMOJIS,
        });
        const findings = checkBotGlobalPerms(ctx);
        expect(findings[0].status).toBe("operational");
    });

    it("warning si des permissions de base manquent", () => {
        const ctx = makeCtx({ botGlobalPerms: 0n });
        const findings = checkBotGlobalPerms(ctx);
        expect(findings[0].status).toBe("warning");
        expect(findings[0].technicalDetail).toContain("Envoyer des messages");
    });

    it("ne retourne qu'un seul finding pour les permissions globales", () => {
        const ctx = makeCtx({ botGlobalPerms: 0n });
        const findings = checkBotGlobalPerms(ctx);
        expect(findings).toHaveLength(1);
    });

    it("le remedy indique comment corriger", () => {
        const ctx = makeCtx({ botGlobalPerms: 0n });
        const findings = checkBotGlobalPerms(ctx);
        expect(findings[0].remedy).toContain("Rôles");
    });
});
