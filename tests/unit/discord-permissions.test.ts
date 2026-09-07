import { describe, it, expect } from "vitest";
import {
    DISCORD_BOT_INVITE_PERMISSIONS,
    DISCORD_PERMISSION,
    buildDiscordBotInviteUrl,
} from "@/lib/discord-permissions";

/**
 * #223 P2 — Invite du bot SANS `permissions=8` (Administrateur).
 * Le bitmask minimal est une somme de puissances de 2 (jamais d'opérateur
 * bit à bit JS : il tronque à 32 bits et les bits ≥ 31 seraient perdus).
 * Les tests utilisent BigInt pour les vérifications de bits.
 */
describe("discord-permissions — invite du bot sans permissions=8 (chantier #223 P2)", () => {
    const perms = BigInt(DISCORD_BOT_INVITE_PERMISSIONS);

    it("n'inclut JAMAIS ADMINISTRATOR (2 ** 3 = 8)", () => {
        expect(perms & 8n).toBe(0n);
    });

    it("inclut les permissions minimales attendues", () => {
        expect(perms & BigInt(DISCORD_PERMISSION.VIEW_CHANNEL)).toBe(BigInt(DISCORD_PERMISSION.VIEW_CHANNEL));
        expect(perms & BigInt(DISCORD_PERMISSION.SEND_MESSAGES)).toBe(BigInt(DISCORD_PERMISSION.SEND_MESSAGES));
        expect(perms & BigInt(DISCORD_PERMISSION.EMBED_LINKS)).toBe(BigInt(DISCORD_PERMISSION.EMBED_LINKS));
        expect(perms & BigInt(DISCORD_PERMISSION.MANAGE_ROLES)).toBe(BigInt(DISCORD_PERMISSION.MANAGE_ROLES));
        expect(perms & BigInt(DISCORD_PERMISSION.MANAGE_THREADS)).toBe(BigInt(DISCORD_PERMISSION.MANAGE_THREADS));
        expect(perms & BigInt(DISCORD_PERMISSION.CREATE_PUBLIC_THREADS)).toBe(BigInt(DISCORD_PERMISSION.CREATE_PUBLIC_THREADS));
        expect(perms & BigInt(DISCORD_PERMISSION.SEND_MESSAGES_IN_THREADS)).toBe(BigInt(DISCORD_PERMISSION.SEND_MESSAGES_IN_THREADS));
    });

    it("n'inclut PAS les droits non utilisés (Activités, Modération/timeout, Soundboard, Move)", () => {
        for (const bit of [2n ** 39n, 2n ** 40n, 2n ** 42n, 2n ** 24n]) {
            expect(perms & bit).toBe(0n);
        }
    });

    it("valeur stable (somme des bits documentés)", () => {
        // 11 droits : base messagerie + threads (vrais bits 34/35/38) + rôles + audit + bans.
        expect(DISCORD_BOT_INVITE_PERMISSIONS).toBe(326686043268);
    });

    it("buildDiscordBotInviteUrl : URL avec bitmask minimal + scope par défaut", () => {
        const url = buildDiscordBotInviteUrl("123456789012345678");
        expect(url).toBe(
            "https://discord.com/oauth2/authorize?client_id=123456789012345678&permissions=326686043268&scope=bot+applications.commands"
        );
    });

    it("buildDiscordBotInviteUrl : guildId + redirectUri (onboarding)", () => {
        const url = buildDiscordBotInviteUrl("123456789012345678", {
            guildId: "987654321098765432",
            redirectUri: "https://beta.sigilos.fr/onboarding/success",
        });
        expect(url).toContain("guild_id=987654321098765432");
        expect(url).toContain("redirect_uri=https%3A%2F%2Fbeta.sigilos.fr%2Fonboarding%2Fsuccess");
        expect(url).toContain("response_type=code");
    });

    it("retourne null sans clientId (fail-closed)", () => {
        expect(buildDiscordBotInviteUrl("")).toBeNull();
    });
});