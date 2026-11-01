/**
 * Propriétaire d'une guilde — **réconciliation** et comptage (mesure du 01/11/2026).
 *
 * 🐛 Trois défauts constatés :
 * 1. le compteur du **site** ne lisait que le snowflake dans `GuildConfig.ownerId`, alors que la
 *    succession y écrit un **UUID interne** ⇒ une guilde transférée sortait du compteur et son
 *    propriétaire pouvait déployer une 3ᵉ guilde ;
 * 2. un **transfert Discord** n'était répercuté par personne (`GUILD_CREATE` ne repasse pas,
 *    la succession ne couvre que le départ) ⇒ `ownerId` restait l'ancien, ou `null` (STELLIUM) ;
 * 3. l'écran « Serveur Supprimé » affirmait que le compte n'était pas concerné — faux pour un
 *    membre sans autre guilde (purge du compte à l'échéance).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const LIMIT = read("src/server/guild-limit.ts");
const BOT = read("services/discord-bot/index.ts");
const ACTIONS = read("src/server/actions/user-actions.ts");
const CACHE = read("src/lib/guild-config-cache.ts");
const LAYOUT = read("src/app/dashboard/[guildId]/layout.tsx");
const RETENTION = read("src/server/account-retention-core.ts");

describe("compteur de guildes — les deux formes de `ownerId` comptent", () => {
    it("lit le snowflake ET l'UUID interne du propriétaire", () => {
        expect(LIMIT).toContain("[userId, account?.providerAccountId]");
        expect(LIMIT).toContain("where: { ownerId: { in: ownerIds } }");
        expect(LIMIT).not.toContain("where: { ownerId: account.providerAccountId }");
    });
});

describe("bot — un transfert Discord met `GuildConfig.ownerId` à jour", () => {
    it("écoute `GuildUpdate` et sort sans requête si le propriétaire n'a pas bougé", () => {
        expect(BOT).toContain("client.on(Events.GuildUpdate");
        expect(BOT).toContain("if (oldGuild.ownerId === newGuild.ownerId) return;");
    });

    it("écrit le nouveau propriétaire et journalise l'action", () => {
        expect(BOT).toContain("data: { ownerId: newGuild.ownerId }");
        expect(BOT).toContain("action: 'GUILD_OWNER_CHANGED'");
    });
});

describe("site — réconciliation paresseuse quand le propriétaire ouvre le dashboard", () => {
    it("ne s'exécute que pour le propriétaire live, et seulement si la valeur diverge", () => {
        expect(ACTIONS).toContain(
            "if (isOwner && guildConfig && guildConfig.ownerId !== discordUserId)",
        );
    });

    it("rattrape aussi le cas `ownerId = null` (sinon STELLIUM resterait cassé)", () => {
        expect(ACTIONS).toContain("OR: [{ ownerId: null }, { ownerId: { not: discordUserId } }]");
    });

    it("le propriétaire est bien dans le contexte caché (select + clés obligatoires)", () => {
        expect(ACTIONS).toContain("ownerId: true");
        expect(CACHE).toContain('"ownerId"');
    });
});

describe("écran « Serveur Supprimé » — l'avertissement dit la vérité", () => {
    it("prévient qu'un membre sans autre guilde perd son compte", () => {
        expect(LAYOUT).toContain("Si vous n'avez aucune autre guilde sur SigilOS, votre compte sera supprimé");
    });

    it("ne prétend plus que le compte n'est jamais concerné", () => {
        expect(LAYOUT).not.toContain("Votre compte et vos autres serveurs ne sont pas concernés");
    });
});

describe("rétention des comptes — la règle est décrite pour ce qu'elle est", () => {
    it("dit que 90 j est un âge minimum, pas une mesure d'inactivité", () => {
        expect(RETENTION).toContain("âge minimum du compte");
        expect(RETENTION).toContain("pas une mesure d'inactivité");
    });
});
