import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Garde du rate-limit des interactions Discord.
 *
 * L'ancienne implémentation vivait dans une `Map` **locale à la route** : elle
 * grandissait sans purge (une entrée par membre et par salon) et repartait de zéro
 * à chaque déploiement — deux instances = deux compteurs. `AGENTS.md` §5.8 impose
 * un store Redis/DB ; `src/lib/ratelimit.ts` fournit déjà le repli mémoire **borné**.
 */
const source = readFileSync("src/app/api/discord/interactions/route.ts", "utf8");

describe("rate limit des interactions Discord — store partagé", () => {
    it("utilise le limiteur du dépôt (Redis + repli borné), plus de Map locale", () => {
        expect(source).toContain('from "@/lib/ratelimit"');
        expect(source).not.toContain("new Map<string, { count");
        expect(source).not.toContain("checkRateLimit");
        expect(source).not.toContain("getRateLimitRemaining");
    });

    it("consomme un jeton sur les 6 gardes (interaction, dj ×2, ticket, modal, commande de ticket)", () => {
        const calls = source.match(/await consumeRateLimit\(/g) ?? [];
        expect(calls).toHaveLength(6);
        expect(source).toContain("interaction:${discordUserId}");
        expect(source).toContain("dj:${member.user.id}:${entityId}");
        expect(source).toContain("ticket:${member.user.id}");
        expect(source).toContain("modal:${member.user.id}");
        expect(source).toContain("ticket-cmd:${discordUserId}:${channelId}");
    });

    it("préfixe la clé pour ne pas collisionner avec les autres limiteurs", () => {
        expect(source).toContain("discord-interaction:${key}");
    });
});
