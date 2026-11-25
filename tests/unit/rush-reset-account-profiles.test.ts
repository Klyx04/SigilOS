import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Reset du guide — **profils hérités du même compte**.
 *
 * Mesure bêta du 25/11/2026 : un ancien `UserProfile` du même compte gardait la
 * progression du guide. Le reset du profil courant laissait donc les cartes Dofus à
 * 100 % (le panneau affichait ce profil comme « 1 membre »). Le reset doit laver tous
 * les profils du compte dans la guilde, sans toucher aux autres membres.
 */

const ACTIONS = "src/server/actions/optimized-guide-actions.ts";
const code = readFileSync(path.join(process.cwd(), ACTIONS), "utf8");

const start = code.indexOf("export async function resetGuideProgress");
const end = code.indexOf("export async function completeGuideProgress", start);
const block = start >= 0 && end > start ? code.slice(start, end) : "";

describe("resetGuideProgress — profils du compte", () => {
    it("résout tous les profils du compte dans la guilde", () => {
        expect(block).toContain("userProfile.findMany");
        expect(block).toContain("userId: ctx.id");
        expect(block).toContain("guild: { discordGuildId: guildId }");
        expect(block).toContain("scopedProfileIds");
    });

    it("efface progression, ressources et donjons sur tous ces profils", () => {
        expect(block).toContain("profileId: { in: scopedProfileIds }");
        expect(block).toContain("db.playerGuideProgress.deleteMany");
        expect(block).toContain("db.playerGuideResourceCheck.deleteMany");
        expect(block).toContain("db.playerGuideDungeonState.deleteMany");
    });

    it("conserve le rate limit et le slot sélectionné", () => {
        expect(block).toContain("guide-reset-guide:${ctx.profileId}");
        expect(block).toContain("characterSlot");
    });
});
