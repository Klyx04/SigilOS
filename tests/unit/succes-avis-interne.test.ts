/**
 * Avis de recherche internes — coche par personnage + filtre commun de guilde.
 *
 * 🔒 Ce que ces verrous tiennent : la migration `characterSlot`, les gardes des actions
 * (auth + `canEditOwnSucces`/`canViewGuildSucces` + rate limit + cible `isBountyMonster`),
 * le sélecteur de personnage des deux écrans, et la carte « Avis » du menu Succès.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const ACTIONS = "src/server/actions/dungeon-achievement-actions.ts";
const TRACKER = "src/components/succes/SuccesTracker.tsx";
const AVIS_TAB = "src/components/succes/SuccesAvisTab.tsx";
const AVIS_DIRECTORY = "src/components/succes/SuccesAvisDirectory.tsx";
const CLIENT = "src/components/succes/SuccesClient.tsx";
const MIGRATION = "prisma/migrations/20270207000001_user_dungeon_progress_character_slot/migration.sql";

describe("Avis de recherche internes — coche et filtre commun", () => {
    it("la coche d'avis est gardée, bornée et ciblée sur un avis siphonné", () => {
        const code = read(ACTIONS);
        const start = code.indexOf("export async function toggleUserBounty");
        const next = code.indexOf("export async function", start + 1);
        const body = code.slice(start, next === -1 ? undefined : next);

        expect(body).toContain("getUserContext(guildId)");
        expect(body).toContain("canEditOwnSucces");
        expect(body).toContain("rateLimit(");
        expect(body).toContain("isBountyMonster: true");
        expect(body).toContain("userId_bountyId_characterSlot");
        expect(body).toContain("characterSlot");
        expect(body).not.toContain("metamobApiKey");
        expect(body).not.toContain("console.log");
    });

    it("le filtre commun ne lit que la guilde et les membres ACTIFs", () => {
        const code = read(ACTIONS);
        const start = code.indexOf("export async function getGuildBountyDirectory");
        const next = code.indexOf("export async function", start + 1);
        const body = code.slice(start, next === -1 ? undefined : next);

        expect(body).toContain("canViewGuildSucces");
        expect(body).toContain("discordGuildId: parsed.data");
        expect(body).toContain('status: "ACTIVE"');
        expect(body).toContain("isBountyMonster: true");
        expect(body).toContain("userBountyCompletion.findMany");
        expect(body).not.toContain("metamobApiKey");
        expect(body).not.toContain("altPseudos");
        expect(body).not.toContain("console.log");
    });

    it("le tracker interne propose les personnages et transmet le slot", () => {
        const code = read(TRACKER);
        expect(code).toContain("getMySuccesCharacters");
        expect(code).toContain("characterSlot");
        expect(code).toContain("toggleAchievementCompleted(guildId, dungeon.id, achievementId, characterSlot)");
        expect(code).toContain("toggleDungeonAchievements(guildId, selectedDungeon.id, { mode: checkAll ? \"all\" : \"none\" }, characterSlot)");
        expect(code).toContain("toggleLevelBracketAchievements(");
    });

    it("la fiche d'avis interne coche le personnage sélectionné", () => {
        const code = read(AVIS_TAB);
        expect(code).toContain("getMySuccesCharacters");
        expect(code).toContain("getUserBountyCompletions");
        expect(code).toContain("toggleUserBounty");
        expect(code).toContain("characterSlot");
        expect(code).toContain("Avis fait");
        expect(code).toContain("Marquer fait");
    });

    it("le menu Succès expose la carte et l'écran du filtre commun", () => {
        const client = read(CLIENT);
        expect(client).toContain("SuccesAvisDirectory");
        expect(client).toContain('rawView === "avis"');
        expect(client).toContain("succes-view-avis");
        expect(client).toContain("<SuccesAvisDirectory guildId={guildId} />");

        const directory = read(AVIS_DIRECTORY);
        expect(directory).toContain("getGuildBountyDirectory");
        expect(directory).toContain("Déjà fait");
        expect(directory).toContain("Cherchent encore");
        expect(directory).not.toContain("console.log");
    });

    it("la migration du tracker est additive (colonne + unicité, aucun DROP de données)", () => {
        const code = read(MIGRATION).replace(/--[^\n]*/g, "");
        expect(code).toMatch(
            /ADD COLUMN IF NOT EXISTS "characterSlot" TEXT NOT NULL DEFAULT 'PRINCIPAL'/
        );
        expect(code).toMatch(
            /CREATE UNIQUE INDEX IF NOT EXISTS "UserDungeonProgress_profileId_achievementId_characterSlot_key"/
        );
        expect(code).not.toMatch(/DROP\s+(TABLE|COLUMN)\b/i);
    });
});
