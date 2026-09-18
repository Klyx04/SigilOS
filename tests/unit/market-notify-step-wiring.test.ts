/**
 * Garde de câblage (lecture source) — **assistant de publication du Marché**.
 *
 * Décision user du 18/09/2026 : le choix des rôles à mentionner (« Qui veux-tu
 * prévenir ? ») et l'aperçu du nombre de membres notifiés étaient **noyés** dans
 * l'étape 4 « Publication ». Ils vivent désormais sur une **étape dédiée (5)**,
 * avec l'aperçu d'audience en direct. Ce test verrouille le câblage pour qu'on ne
 * remette pas la notification dans l'étape d'aperçu Discord par inadvertance.
 *
 * Vitest tourne en environnement `node` : on lit les sources (aucun rendu Next
 * hors requête), même approche que `market-discord-route-wiring.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const CREATE = "src/app/dashboard/[guildId]/marche/_components/market-create-client.tsx";
const PUBLISH = "src/app/dashboard/[guildId]/marche/_components/market-publish-step.tsx";
const NOTIFY = "src/app/dashboard/[guildId]/marche/_components/market-notify-step.tsx";

function read(path: string): string {
    return readFileSync(path, "utf8");
}

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const CREATE_CODE = codeOnly(read(CREATE));
const PUBLISH_CODE = codeOnly(read(PUBLISH));
const NOTIFY_CODE = codeOnly(read(NOTIFY));

describe("Assistant Marché — étape 5 « Notification » séparée", () => {
    it("rend `MarketNotifyStep` sur l'étape 5 (après l'aperçu Discord de l'étape 4)", () => {
        expect(CREATE_CODE).toMatch(/step === 5 && \(\s*<MarketNotifyStep/);
        expect(CREATE_CODE).toMatch(/step === 4 && \(/);
    });

    it("affiche 5 étapes en création (… Publication, Notification) et 3 en édition", () => {
        expect(CREATE_CODE).toMatch(/stepCount=\{isEdit \? 3 : 5\}/);
        expect(CREATE_CODE).toMatch(/"Publication", "Notification"/);
    });

    it("publie depuis la DERNIÈRE étape (notification choisie juste avant)", () => {
        const publishIndex = CREATE_CODE.indexOf("handleSubmit(true)");
        expect(publishIndex, "bouton de publication introuvable").toBeGreaterThan(-1);
        // La branche qui porte le bouton est bien celle de l'étape 5.
        const branch = CREATE_CODE.slice(Math.max(0, publishIndex - 600), publishIndex);
        expect(branch).toMatch(/!isEdit && step === 5/);
    });

    it("l'étape « Publication » ne gère plus la notification (déplacée)", () => {
        expect(PUBLISH_CODE, "la sélection de rôles ne doit plus vivre dans l'étape 4").not.toMatch(
            /onTogglePing/
        );
        expect(
            PUBLISH_CODE,
            "l'estimation d'audience appartient à l'étape dédiée"
        ).not.toMatch(/estimateMarketPingAudience/);
    });

    it("l'étape dédiée affiche l'audience serveur ET le détail par rôle", () => {
        expect(NOTIFY_CODE).toMatch(/estimateMarketPingAudience\(guildId, selectedPingIds\)/);
        expect(NOTIFY_CODE, "compteur global").toMatch(/membre\(s\) seront notifiés/);
        expect(NOTIFY_CODE, "détail par rôle").toMatch(/audience\.perRole/);
        expect(NOTIFY_CODE, "aucun pseudo publié (compteur seulement)").not.toMatch(/discordId/);
    });
});
