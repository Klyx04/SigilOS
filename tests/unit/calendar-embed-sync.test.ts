/**
 * Constat bêta du 19/09/2026 (raids du calendrier) — « les gens s'inscrivent mais
 * personne ne s'affiche en temps réel dans l'embed ».
 *
 * Cause mesurée : avec l'outbox des écritures Discord active
 * (`DISCORD_OUTBOX_ENABLED=true`, le cas de la bêta), `sendChannelMessage` ne
 * renvoie pas un ID Discord mais `outbox:<jobId>` (écriture **en file**). Le
 * calendrier le stockait tel quel dans `GuildEvent.discordMessageId` : chaque
 * inscription PATCHait donc `/channels/{salon}/messages/outbox:<jobId>` (404
 * définitif) et l'embed restait **figé** à l'état de la publication — pendant que
 * le cliqueur lisait « ⚠️ L'embed Discord n'a pas pu être rafraîchi ».
 *
 * Ces tests verrouillent les deux moitiés du correctif :
 *  1. la publication demande au worker de ré-ancrer le VRAI ID (`storeMessageIdKey`) ;
 *  2. le rafraîchissement RÉSOUT l'ID avant tout PATCH (Redis si `outbox:`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const SERVICE = "src/server/calendar-service.ts";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SERVICE_CODE = codeOnly(readFileSync(SERVICE, "utf8"));

/** Corps d'une fonction exportée (`export async function <nom>`). */
function exportedFunction(name: string): string {
    const start = SERVICE_CODE.indexOf(`export async function ${name}`);
    expect(start, `fonction \`${name}\` introuvable dans le service`).toBeGreaterThan(-1);
    const next = SERVICE_CODE.indexOf("\nexport ", start + 1);
    return SERVICE_CODE.slice(start, next === -1 ? undefined : next);
}

/** Corps d'une fonction privée (`async function <nom>`). */
function privateFunction(name: string): string {
    const start = SERVICE_CODE.indexOf(`async function ${name}(`);
    expect(start, `fonction privée \`${name}\` introuvable dans le service`).toBeGreaterThan(-1);
    const next = SERVICE_CODE.indexOf("\nasync function ", start + 1);
    const end = next === -1 ? SERVICE_CODE.indexOf("\n/**", start + 1) : next;
    return SERVICE_CODE.slice(start, end === -1 ? undefined : end);
}

describe("Calendrier — l'ID de message stocké n'est jamais un `outbox:<jobId>` envoyé à Discord", () => {
    it("la règle « ID Discord » vient du module partagé (pas d'un regex local)", () => {
        expect(SERVICE_CODE).toMatch(/from "@\/lib\/discord-ids"/);
        expect(SERVICE_CODE, "plus de regex snowflake recopiée dans le service").not.toMatch(/\\d\{15,21\}/);
    });

    it("`resolveEventMessageId` rend un snowflake tel quel et résout un ID d'outbox (Redis)", () => {
        const body = privateFunction("resolveEventMessageId");
        expect(body).toMatch(/if \(isDiscordSnowflake\(stored\)\) return stored;/);
        expect(body).toMatch(/if \(!isOutboxMessageId\(stored\)\) return null;/);
        expect(body).toMatch(/redis\.get\(eventMessageKey\(eventId\)\)/);
        // Jamais d'écriture dans le vide : un ID non résolu rend `null`.
        expect(body).toMatch(/return null;/);
    });

    it("la publication demande le ré-ancre du vrai ID (`storeMessageIdKey`) au worker", () => {
        const body = exportedFunction("publishDiscordEvent");
        expect(body).toMatch(/storeMessageIdKey: eventMessageKey\(eventId\)/);
        expect(body).toMatch(/storeMessageIdTTL: EVENT_MESSAGE_KEY_TTL_SECONDS/);
        // Un ID différé est journalisé (diagnostiquable côté serveur).
        expect(body).toMatch(/if \(!isDiscordSnowflake\(messageId\)\)/);
    });

    it("le rafraîchissement RÉSOUT l'ID et PATCH ce `messageId` (jamais la valeur brute)", () => {
        const body = exportedFunction("refreshDiscordEventEmbed");
        expect(body).toMatch(/let messageId = await resolveEventMessageId\(event\.discordMessageId, event\.id\)/);
        expect(body).toMatch(/if \(!messageId\) \{/);
        expect(body).toMatch(/updateChannelMessage\(\s*event\.discordChannelId,\s*messageId,/);
        expect(body, "l'ancien PATCH direct sur la valeur stockée doit avoir disparu").not.toMatch(
            /updateChannelMessage\(\s*event\.discordChannelId,\s*event\.discordMessageId,/
        );
    });

    it("répare les événements publiés AVANT le correctif (ID outbox jamais ré-ancre)", () => {
        // Récupération déclenchée seulement sur un ID d'outbox, jamais en boucle.
        const body = exportedFunction("refreshDiscordEventEmbed");
        expect(body).toMatch(/if \(!messageId && isOutboxMessageId\(event\.discordMessageId\)\) \{/);
        expect(body).toMatch(/recoverEventMessageId\(guildConfig\.id, event\.id, event\.discordChannelId\)/);

        const recovery = privateFunction("recoverEventMessageId");
        expect(recovery, "une seule tentative par événement et par process").toMatch(
            /if \(recoveryAttempted\.has\(eventId\)\) return null;/
        );
        expect(recovery).toMatch(/messageHasCustomId\(message\?\.components, marker\)/);
        // Le lien est réparé en base (snowflake vérifié avant écriture + scoping guilde).
        expect(recovery).toMatch(/if \(!found\?\.id \|\| !isDiscordSnowflake\(found\.id\)\) return null;/);
        expect(recovery).toMatch(/where: \{ id: eventId, guildId: guildConfigId \}/);
    });
});

describe("Calendrier — écriture de la classe (constat du même jour)", () => {
    it("borne la classe reçue (elle part dans un field d'embed Discord)", () => {
        expect(SERVICE_CODE).toMatch(/classe: data\?\.classe\?\.trim\(\)\.slice\(0, 30\) \|\| undefined/);
    });

    it("confirme la classe retenue au cliqueur (issue d'inscription)", () => {
        expect(exportedFunction("processRegistration")).toMatch(/classe: data\?\.classe\?\.trim\(\) \|\| undefined/);
    });
});
