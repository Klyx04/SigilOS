/**
 * Bot Discord — faux événements de rôles/surnom (31/10/2026).
 *
 * Mesure (bêta, 20:36) : deux entrées `WEBHOOK_MEMBER_UPDATE` pour un membre qui n'avait **rien**
 * changé depuis des semaines — une liste de rôles tous préfixés `+` (donc « ajoutés ») et un
 * `Surnom serveur : "Fakeman" ➔ "Fake-Instructor"` vieux de plusieurs semaines.
 *
 * Cause : `GuildMemberUpdate` porte un `oldMember` **partiel** quand le membre n'est pas dans le
 * cache (bot redémarré) — il ne contient que `@everyone`, donc tout paraît ajouté, et
 * `oldMember.nickname` retombe sur le nom d'utilisateur.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const BOT = readFileSync(join(process.cwd(), "services/discord-bot/index.ts"), "utf8");

function memberUpdateHandler(): string {
    const start = BOT.indexOf("client.on(Events.GuildMemberUpdate");
    const end = BOT.indexOf("client.on(", start + 30);
    return BOT.slice(start, end > start ? end : undefined);
}

describe("bot — GuildMemberUpdate n'invente pas de changements", () => {
    const fn = memberUpdateHandler();

    it("ignore l'événement quand l'ancien membre est partiel (cache froid)", () => {
        expect(fn).toContain("partial");
        expect(fn).toMatch(/if \(\(oldMember as \{ partial\?: boolean \}\)\.partial === true\) return;/);
    });

    it("refuse aussi un « ajout » qui couvre tous les rôles d'un membre qui n'en portait aucun", () => {
        expect(fn).toContain("coldCache");
        expect(fn).toMatch(/addedRoles\.size === newMember\.roles\.cache\.size - 1/);
    });

    it("n'écrit le journal que sur un vrai diff (surnom, nom d'utilisateur ou rôles)", () => {
        expect(fn).toMatch(/if \(!nickChanged && !usernameChanged && !rolesChanged\) return;/);
        expect(fn).toContain('action: \'WEBHOOK_MEMBER_UPDATE\'');
    });
});
