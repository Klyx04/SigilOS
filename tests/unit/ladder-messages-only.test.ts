import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * AUD-08 (audit 13/11/2026) — décision produit : le Ladder ne classe plus sur le
 * nombre de caractères, mais sur le nombre de messages. Conséquence : le bot ne
 * lit plus le contenu des messages et l'intent privilégié `MessageContent` est
 * retiré (le portail Discord doit être désactivé après déploiement).
 *
 * Ces invariants sont statiques : ils verrouillent la disparition de l'ancienne
 * métrique et l'absence de contenu dans les logs du bot.
 */
const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("Ladder — messages uniquement, plus de caractères", () => {
    const bot = read("services/discord-bot/index.ts");
    const client = read("src/app/dashboard/[guildId]/ladder/_components/ladder-client.tsx");
    const actions = read("src/server/actions/ladder-actions.ts");
    const memberActivity = read("src/components/admin/members/member-discord-activity.tsx");

    it("le bot ne demande plus l'intent privilégié MessageContent", () => {
        expect(bot).not.toMatch(/GatewayIntentBits\.MessageContent/);
    });

    it("le bot ne lit plus le contenu des messages", () => {
        // La lecture réelle (`message.content ? …`) a disparu ; la seule mention
        // restante est le commentaire d'explication.
        expect(bot).not.toMatch(/message\.content\s*[?.]/);
        expect(bot).not.toMatch(/discordCharacters/);
    });

    it("le bot ne journalise plus les snowflakes Discord", () => {
        expect(bot).not.toMatch(/for \$\{discordId\}/);
        expect(bot).not.toMatch(/guildId=\$\{guildId/);
    });

    it("l'UI Ladder ne propose plus la métrique « caractères »", () => {
        expect(client).not.toMatch(/value="characters"/);
        expect(client).not.toMatch(/discordMetric === "characters"/);
        expect(client).not.toMatch(/Caractères/);
    });

    it("le serveur Ladder ne mappe plus la métrique « caractères »", () => {
        const start = actions.indexOf("export async function getPresenceLadder");
        expect(start).toBeGreaterThanOrEqual(0);
        // La signature de la fonction ne doit plus accepter "characters".
        const signature = actions.slice(start, start + 400);
        expect(signature).not.toMatch(/"characters"/);
        expect(actions).not.toMatch(/metric === "characters"/);
        // Le tri ne doit plus utiliser les compteurs hebdo/mensuel de caractères
        // (le total reste lu pour la classification de présence historique).
        expect(actions).not.toMatch(/discordCharacters(Weekly|Monthly)/);
    });

    it("la carte membre n'affiche plus le compteur de caractères", () => {
        expect(memberActivity).not.toMatch(/label="Caractères"/);
    });
});
