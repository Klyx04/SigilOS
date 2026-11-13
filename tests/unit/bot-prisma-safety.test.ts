import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * AUD-06 (audit 13/11/2026) — le bot Discord utilise un `PrismaClient` brut,
 * sans l'extension de chiffrement de `src/lib/prisma.ts`. Tant qu'il n'écrit
 * que des compteurs/statuts, le risque est latent ; ce verrou interdit toute
 * écriture de champ chiffré (tokens OAuth, clé Metamob) depuis ce service.
 */
const bot = readFileSync(path.join(process.cwd(), "services/discord-bot/index.ts"), "utf8");

describe("bot Discord — pas d'écriture de champ chiffré avec un client brut", () => {
    it("ne touche jamais aux tokens OAuth ni à la clé Metamob", () => {
        expect(bot).not.toMatch(/\b(metamobApiKey|access_token|refresh_token|id_token)\s*:/);
    });

    it("n'écrit jamais dans la table Account", () => {
        expect(bot).not.toMatch(/db\.account\.(create|update|upsert|updateMany|delete)/);
    });

    it("porte l'invariant en commentaire (revue future)", () => {
        expect(bot).toMatch(/client est BRUT/);
    });
});
