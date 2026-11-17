/**
 * Sondages — **l'embed Discord ne survit jamais à la clôture**.
 *
 * 🐛 Mesure du 17/11/2026 : trois chemins ferment un sondage, deux supprimaient l'embed
 * (clôture manuelle `closePoll`, cron `autoCloseExpiredPolls`) et **deux ne le faisaient pas** :
 *   • un vote tardif sur un sondage dont `expiresAt` est passé (`processPollVote`) ;
 *   • la fermeture paresseuse faite à la lecture de la liste (`lazyClosePollsForGuild`).
 * Dans les deux cas l'embed restait cliquable et affichait des résultats figés.
 *
 * 🛡️ Ce que ce test protège :
 * ① les **quatre** chemins appellent `deleteChannelMessage` ;
 * ② la fermeture est **conditionnelle** (`status: "ACTIVE"` dans le `WHERE`) — pas de course ;
 * ③ les ids Discord sont **lus avant** la fermeture (sinon on ne sait plus quoi supprimer).
 *
 * Lecture seule : code source (actions serveur non unit-testables sans base).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const POLL_ACTIONS = "src/server/actions/poll-actions.ts";

const source = () => readFileSync(POLL_ACTIONS, "utf8");

/** Découpe une fonction par son en-tête et le prochain repère fourni. */
const slice = (code: string, start: string, end: string): string => {
    const from = code.indexOf(start);
    expect(from, `fonction absente : ${start}`).toBeGreaterThan(-1);
    const to = code.indexOf(end, from + start.length);
    expect(to, `fin de fonction absente : ${end}`).toBeGreaterThan(from);
    return code.slice(from, to);
};

describe("sondages — clôture : l'embed de vote est supprimé", () => {
    it("① vote tardif sur un sondage expiré : fermeture conditionnelle + suppression de l'embed", () => {
        const code = source();
        const expiry = slice(code, "// Check expiry", "// Check existing vote on this option");
        expect(expiry).toContain("updateMany");
        expect(expiry).toContain('status: "ACTIVE"');
        expect(expiry).toContain("deleteChannelMessage(option.poll.discordChannelId, option.poll.discordMessageId)");
    });

    it("② fermeture paresseuse (lecture de la liste) : ids lus avant, puis suppression", () => {
        const code = source();
        const lazy = slice(code, "async function lazyClosePollsForGuild", "/**");
        expect(lazy).toContain("select: { id: true, discordChannelId: true, discordMessageId: true }");
        expect(lazy).toContain("deleteChannelMessage(target.discordChannelId, target.discordMessageId)");
        expect(lazy).toContain('status: "ACTIVE"');
    });

    it("③ clôture manuelle : l'embed est supprimé (non-régression)", () => {
        const code = source();
        const close = slice(code, "export async function closePoll", "export async function");
        expect(close).toContain("deleteChannelMessage(poll.discordChannelId, poll.discordMessageId)");
    });

    it("④ cron close-old-polls : l'embed est supprimé (non-régression)", () => {
        const code = source();
        const cron = slice(code, "export async function autoCloseExpiredPolls", "export async function getPolls");
        expect(cron).toContain("select: { id: true, discordChannelId: true, discordMessageId: true }");
        expect(cron).toContain("deleteChannelMessage(t.discordChannelId, t.discordMessageId)");
    });
});
