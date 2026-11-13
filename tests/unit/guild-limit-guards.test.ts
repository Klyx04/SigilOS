/**
 * Limite de guildes — **verrou de source** des 5 gardes serveur (`docs/ROADMAP.md`, chantier « limite-guildes »).
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

describe("G6 — le plafond est une donnée serveur, pas un calcul d'écran", () => {
    const PORTAL = read("src/app/dashboard/page.tsx");
    const DRAWER = read("src/components/layout/dashboard-drawer.tsx");

    it("`getGuildsSeparated` rend l'état du plafond (source unique)", () => {
        expect(USER_ACTIONS).toMatch(/guildLimitReached: boolean/);
        expect(USER_ACTIONS).toMatch(/guildLimit: number/);
        expect(USER_ACTIONS).toContain("isGuildLimitReached(userId)");
    });

    it("le portail consomme le champ au lieu de recompter", () => {
        expect(PORTAL).not.toContain("countUserGuilds(session.user.id)");
        expect(PORTAL).toContain("guildLimitReached");
    });

    it("le tiroir « Gestion SigilOS » ferme la porte au plafond (même règle que la carte)", () => {
        // 🐛 Mesure du 06/11/2026 : le tiroir listait les serveurs « Déploiement Disponible » avec
        // un bouton d'invitation, même au plafond — le portail refusait ensuite le déploiement.
        expect(DRAWER).toMatch(/resolveGuildSetupView\(/);
        expect(DRAWER).toContain("guildLimitReached: data.guildLimitReached");
        expect(DRAWER).toContain("deployView.blocked");
    });

    it("l'autorisation passe avant la réactivation et la whitelist", () => {
        const fn = ADMIN_ACTIONS.slice(ADMIN_ACTIONS.indexOf("export async function onboardGuild"));
        const admin = fn.indexOf("requireGuildAdmin(");
        const reactivation = fn.indexOf("if (existing) {");
        const whitelist = fn.indexOf("db.allowedGuild.create({");
        const garde = fn.indexOf("isGuildLimitReached(session.user.id)");

        expect(admin, "la garde d'admin doit exister").toBeGreaterThan(-1);
        expect(reactivation, "la branche de réactivation doit exister").toBeGreaterThan(-1);
        expect(admin).toBeLessThan(reactivation);
        expect(garde, "la garde G2 doit exister").toBeGreaterThan(-1);
        expect(garde).toBeLessThan(whitelist);
    });

    it("l'identifiant de guilde est borné (Zod)", () => {
        expect(ADMIN_ACTIONS).toContain("Identifiant de serveur invalide.");
    });
});

