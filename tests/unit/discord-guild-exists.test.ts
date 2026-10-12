/**
 * fetchGuildExists — vérification FRAÎCHE (hors cache) d'existence d'une guilde Discord.
 *
 * Contrat de sécurité (détection serveur supprimé, getUserContext) :
 * - 404 Discord  → false (serveur supprimé OU bot expulsé : dans les deux cas,
 *   le dashboard ne doit plus faire confiance au cache guilde de 120s).
 * - 200          → true.
 * - Toute autre erreur (403, 5xx, réseau, token manquant) → throw : l'appelant
 *   ne doit JAMAIS conclure à une suppression sur une erreur technique (fail-safe).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGuildExists } from "@/server/discord";

describe("fetchGuildExists", () => {
    beforeEach(() => {
        process.env.DISCORD_BOT_TOKEN = "test-token";
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env.DISCORD_BOT_TOKEN;
    });

    it("retourne false sur 404 Discord (serveur supprimé / bot expulsé)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
        await expect(fetchGuildExists("111111111111111111")).resolves.toBe(false);
    });

    it("retourne true sur 200", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
        await expect(fetchGuildExists("111111111111111111")).resolves.toBe(true);
    });

    it("throw sur erreur technique (403) — jamais de faux 'supprimé'", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
        await expect(fetchGuildExists("111111111111111111")).rejects.toThrow();
    });

    it("throw si le token bot est manquant (fail-closed)", async () => {
        delete process.env.DISCORD_BOT_TOKEN;
        await expect(fetchGuildExists("111111111111111111")).rejects.toThrow(
            "Missing DISCORD_BOT_TOKEN"
        );
    });
});
