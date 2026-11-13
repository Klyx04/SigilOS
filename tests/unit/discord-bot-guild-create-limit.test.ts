/**
 * LG-4 — **garde de source** : l'annonce faite par le bot à l'invitation doit dire la même vérité que
 * le portail (`docs/ROADMAP.md`, chantier « limite-guildes », LG-4).
 *
 * 🐛 Le défaut mesuré le 01/11/2026 : à 2 guildes sur 2, le portail refusait le déploiement (garde G2)
 * pendant que le bot annonçait « ✅ Ce serveur est actif immédiatement ». L'utilisateur cliquait pour
 * rien. `GuildCreate` arrive **sans session** : ce service est le seul à pouvoir le savoir.
 *
 * Ce que ce verrou protège, dans l'ordre :
 * 1. le plafond est lu **avant** la moindre annonce (God + bienvenue) ;
 * 2. le message God et l'embed ont une branche « propriétaire au plafond » ;
 * 3. une lecture en échec ne promet **jamais** l'activation (fail-closed, texte neutre) ;
 * 4. la règle vient de `src/lib/guild-limit.ts` (une seule source), pas d'une copie locale.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const BOT = fs.readFileSync(path.join(REPO_ROOT, "services/discord-bot/index.ts"), "utf8");

const HANDLER_START = BOT.indexOf("client.on(Events.GuildCreate");
const HANDLER_NEXT = BOT.indexOf("client.on(Events.", HANDLER_START + 10);
const HANDLER = HANDLER_NEXT > HANDLER_START ? BOT.slice(HANDLER_START, HANDLER_NEXT) : BOT.slice(HANDLER_START);

describe("le plafond est lu avant toute annonce", () => {
    it("le handler lit l'état du propriétaire", () => {
        expect(HANDLER_START).toBeGreaterThan(-1);
        expect(HANDLER).toContain("await readOwnerLimitState(guild)");
    });

    it("il le lit avant la notification God et avant l'embed de bienvenue", () => {
        const lecture = HANDLER.indexOf("await readOwnerLimitState(guild)");
        const notificationGod = HANDLER.indexOf("godNotification.create");
        const bienvenue = HANDLER.indexOf("new EmbedBuilder()");

        expect(notificationGod).toBeGreaterThan(-1);
        expect(bienvenue).toBeGreaterThan(-1);
        expect(lecture).toBeLessThan(notificationGod);
        expect(lecture).toBeLessThan(bienvenue);
    });
});

describe("l'annonce God dit « pas encore déployable » au plafond", () => {
    it("la notification en base a une branche dédiée", () => {
        expect(HANDLER).toContain("GUILD_CREATE_OWNER_AT_LIMIT");
        expect(HANDLER).toContain("pas encore déployable");
    });

    it("l'embed God a une branche dédiée (couleur propre, pas le vert « auto-actif »)", () => {
        expect(HANDLER).toContain("Nouveau serveur — propriétaire au plafond");
        expect(HANDLER).toContain("0xf59e0b");
    });
});

describe("le message public ne promet plus l'activation à tort", () => {
    it("la description et l'étape 2 sont calculées, plus figées", () => {
        expect(HANDLER).toContain("setDescription(welcomeDescription)");
        expect(HANDLER).toContain("value: deployStepValue");
    });

    it("un propriétaire au plafond reçoit une consigne qui mène au portail", () => {
        expect(HANDLER).toContain("Ce serveur ne peut pas encore être déployé");
        expect(HANDLER).toContain("/dashboard)**, puis déployer ce serveur");
    });
});

describe("fail-closed : une lecture impossible ne promet rien", () => {
    it("l'échec de lecture rend un état `unknown`", () => {
        expect(BOT).toContain("return { status: 'unknown' };");
    });

    it("le message de secours renvoie au portail au lieu d'affirmer l'activation", () => {
        expect(HANDLER).toContain("n'a pas pu être vérifié automatiquement");
    });
});

describe("une seule source de vérité et un comptage au bon endroit", () => {
    it("la règle vient du module partagé, pas d'une copie dans le bot", () => {
        expect(BOT).toContain(
            "import { isGuildLimitReachedOnJoin, resolveGuildLimit } from './shared/guild-limit.js';",
        );
        expect(BOT).toContain("isGuildLimitReachedOnJoin({");
    });

    it("compare les identifiants internes (UUID), jamais des snowflakes entre eux", () => {
        expect(BOT).toContain("currentGuildId: current?.id ?? null");
        expect(BOT).toContain("discordGuildId: guild.id");
    });

    it("exempte le propriétaire God, comme côté site", () => {
        expect(BOT).toContain("godIds.includes(guild.ownerId)");
    });
});
