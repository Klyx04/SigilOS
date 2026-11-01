/**
 * Limite de guildes — **verrou de source** des 5 gardes serveur (`PLAN-LIMITE-GUILDES.md` §4).
 *
 * 🐛 Ce qui est réellement en jeu : la limite ne vaut que si **tous** les chemins d'arrivée la
 * respectent. Une seule porte oubliée (création de profil, déploiement, réactivation d'un membre
 * ou d'une guilde supprimée) et le plafond devient décoratif. Ces gardes sont donc vérifiées ici,
 * avec leur **ordre** : un contrôle placé après l'écriture ne protège rien.
 *
 * 📌 Décisions du 31/10/2026 : 2 guildes, God exempté sur les chemins **self** (G1/G2) seulement —
 * les réactivations visent un **membre**, jamais l'admin qui agit.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const USER_ACTIONS = read("src/server/actions/user-actions.ts");
const ADMIN_ACTIONS = read("src/server/actions/admin-actions.ts");
const LIFECYCLE = read("src/server/actions/lifecycle-actions.ts");

describe("G1 — création de profil (getUserContext)", () => {
    it("refuse avant `userProfile.create`, jamais après", () => {
        const garde = USER_ACTIONS.indexOf("isGuildLimitReached(session.user.id)");
        const ecriture = USER_ACTIONS.indexOf("db.userProfile.create({");

        expect(garde, "la garde G1 doit exister").toBeGreaterThan(-1);
        expect(ecriture, "la création de profil doit exister").toBeGreaterThan(-1);
        expect(garde).toBeLessThan(ecriture);
    });

    it("expose `guildLimitReached` pour que l'écran puisse le dire", () => {
        expect(USER_ACTIONS).toContain("guildLimitReached: true");
    });
});

describe("G2 — déploiement d'une guilde (onboardGuild)", () => {
    it("refuse avant `guildConfig.create`", () => {
        const garde = ADMIN_ACTIONS.indexOf("isGuildLimitReached(session.user.id)");
        const ecriture = ADMIN_ACTIONS.indexOf("db.guildConfig.create({");

        expect(garde, "la garde G2 doit exister").toBeGreaterThan(-1);
        expect(ecriture).toBeGreaterThan(-1);
        expect(garde).toBeLessThan(ecriture);
    });
});

describe("G3 — réactivation d'une guilde supprimée", () => {
    it("n'a plus d'`updateMany` aveugle sur les profils GUILD_DELETED", () => {
        expect(ADMIN_ACTIONS).not.toMatch(
            /updateMany\(\{\s*where:\s*\{\s*guildId:\s*existing\.id,\s*archiveReason:\s*'GUILD_DELETED'/,
        );
    });

    it("vérifie chaque porteur avant de le réactiver", () => {
        expect(ADMIN_ACTIONS).toContain("wouldExceedGuildLimit(candidate.userId)");
    });
});

describe("G4 — réactivation d'un membre par un admin", () => {
    it("compte les guildes du membre ciblé, pas celles de l'admin", () => {
        expect(LIFECYCLE).toContain("wouldExceedGuildLimit(profile.userId)");
    });

    it("emploie le message du plan (aucun code technique à l'écran)", () => {
        expect(LIFECYCLE).toContain("Il doit en quitter une avant d'être réintégré ici.");
    });
});

describe("G5 — réactivation automatique au retour du membre", () => {
    it("refuse avant l'écriture, et échoue silencieusement (le membre reste archivé)", () => {
        const fn = LIFECYCLE.slice(LIFECYCLE.indexOf("export async function reactivateProfile"));
        const garde = fn.indexOf("wouldExceedGuildLimit(userId)");
        const ecriture = fn.indexOf("db.userProfile.updateMany");

        expect(garde, "la garde G5 doit exister dans reactivateProfile").toBeGreaterThan(-1);
        expect(ecriture).toBeGreaterThan(-1);
        expect(garde).toBeLessThan(ecriture);
        expect(fn.slice(garde, ecriture)).toContain("return false");
    });
});
