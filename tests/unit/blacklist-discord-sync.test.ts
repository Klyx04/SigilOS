/**
 * Blacklist — l'embed Discord suit vraiment l'édition.
 *
 * Constat du 25/10/2026 : `editBlacklistEntry` appelait bien `updateChannelMessage`, mais
 * le `catch` **avalait** l'échec (404 si le message avait été supprimé, salon changé, ou
 * identifiant encore en file `outbox:`) et l'action répondait `success: true`. L'écran
 * annonçait « Entrée modifiée » avec un embed resté obsolète.
 *
 * Contrat verrouillé ici : PATCH si possible, **repost + ré-ancrage** sinon, et le statut
 * réel remonté à l'écran (`posted` / `updated` / `reposted` / `deleted` / `no_channel` /
 * `unavailable`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ACTIONS = codeOnly(readFileSync("src/server/actions/blacklist-actions.ts", "utf8"));

describe("Édition d'un signalement", () => {
    it("édite l'embed quand l'identifiant est un vrai snowflake", () => {
        expect(ACTIONS).toMatch(/isDiscordSnowflake\(args\.entry\.discordMessageId\)/);
        expect(ACTIONS).toMatch(/await updateChannelMessage\(/);
    });

    it("reposte et ré-ancre quand l'édition est impossible (message supprimé, salon changé, outbox)", () => {
        expect(ACTIONS).toMatch(/return "reposted"/);
        expect(ACTIONS).toMatch(/data: \{ discordMessageId: messageId \}/);
        expect(ACTIONS).toMatch(/storeMessageIdKey: `blacklist:msg:\$\{entryId\}`/);
    });

    it("ne répond plus un succès muet quand Discord refuse", () => {
        expect(ACTIONS).toContain('return "unavailable"');
        expect(ACTIONS).toMatch(/data: \{ discord \}/);
        expect(ACTIONS).not.toContain("Discord edit sync failed");
    });

    it("écrit en base **avant** de synchroniser (l'embed suit le contenu enregistré)", () => {
        const updateMany = ACTIONS.indexOf("db.blacklistEntry.updateMany");
        const sync = ACTIONS.indexOf("await syncBlacklistEmbed");
        expect(updateMany).toBeGreaterThan(-1);
        expect(sync).toBeGreaterThan(updateMany);
    });
});

describe("Ajout et suppression", () => {
    it("l'ajout stocke le vrai identifiant après publication (jamais un embed orphelin)", () => {
        const add = ACTIONS.slice(
            ACTIONS.indexOf("export async function addBlacklistEntry"),
            ACTIONS.indexOf("export async function editBlacklistEntry"),
        );
        const create = add.indexOf("db.blacklistEntry.create");
        const send = add.indexOf("sendChannelMessage(");
        const store = add.indexOf('discord = "posted"');
        expect(create).toBeGreaterThan(-1);
        expect(send).toBeGreaterThan(create);
        expect(store).toBeGreaterThan(send);
    });

    it("la suppression remonte son statut Discord", () => {
        expect(ACTIONS).toMatch(/discord = \(await deleteChannelMessage/);
        expect(ACTIONS).toMatch(/data: \{ discord \}/);
    });

    it("les deux porteurs de statut sont typés (aucune chaîne libre)", () => {
        expect(ACTIONS).toContain('export type BlacklistDiscordSync = "posted" | "updated" | "reposted" | "deleted" | "no_channel" | "unavailable"');
    });
});
