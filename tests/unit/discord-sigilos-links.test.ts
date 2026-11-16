/**
 * D1 — points d'entrée « Discord SigilOS » côté membre.
 *
 * Mesure du 16/11/2026 (API Discord, lecture seule, sans jeton) :
 * - `discord.gg/uX7G6SUDgN` → guilde « SigilOS » ;
 * - `discord.gg/BMVvXpYHEt` (route `/discord`) → guilde « STELLIUM », nom interne.
 *
 * Le bouton membre doit pointer l'invitation publique SigilOS, jamais `/discord`,
 * et jamais une URL recopiée dans un composant : la variable d'environnement est
 * la seule source.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const INVITE = "src/lib/discord-invite.ts";
const SIDEBAR = "src/components/layout/app-sidebar.tsx";
const TICKETS = "src/app/dashboard/[guildId]/tickets/_components/ticket-bot-manager.tsx";

describe("points d'entrée Discord SigilOS", () => {
    it("l'invitation vient de la variable d'environnement, avec le repli public connu", () => {
        const code = read(INVITE);
        expect(code).toContain("process.env.NEXT_PUBLIC_DISCORD_INVITE_URL");
        expect(code).toContain('"https://discord.gg/uX7G6SUDgN"');
        expect(code).toContain('DISCORD_INVITE_LABEL = "Discord SigilOS"');
    });

    it("la sidebar expose « Discord SigilOS » à côté de Documentation, en nouvel onglet", () => {
        const code = read(SIDEBAR);
        expect(code).toContain('import { DISCORD_INVITE_LABEL, DISCORD_INVITE_URL } from "@/lib/discord-invite";');
        expect(code).toContain("href={DISCORD_INVITE_URL}");
        expect(code).toContain("title={DISCORD_INVITE_LABEL}");
        expect(code).toContain('target="_blank"');
        expect(code).toContain('rel="noreferrer"');
        // Une URL recopiée ici reprendrait la main sur l'environnement.
        expect(code).not.toContain("discord.gg/");
        expect(code).not.toMatch(/stellium/i);
    });

    it("la page Tickets propose « Rejoindre le Discord », même source", () => {
        const code = read(TICKETS);
        expect(code).toContain('import { DISCORD_INVITE_URL } from "@/lib/discord-invite";');
        expect(code).toContain("href={DISCORD_INVITE_URL}");
        expect(code).toContain("Rejoindre le Discord");
        expect(code).toContain('target="_blank"');
        expect(code).toContain('rel="noreferrer"');
        expect(code).not.toContain("discord.gg/");
        expect(code).not.toMatch(/stellium/i);
    });
});
