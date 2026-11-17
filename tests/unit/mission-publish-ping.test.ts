/**
 * Missions — **publication Discord** : « Sans ping » annonce sans mentionner.
 *
 * 🐛 Mesure du 17/11/2026 (retour user « la mission ne se publie pas sur Discord ») :
 * `skipDiscord` valait `pingType === "NONE" || ...` ⇒ choisir « Sans ping » annulait
 * **tout** l'envoi de l'embed. La règle pure ci-dessous sépare les deux décisions :
 *   • **faut-il publier ?** → bot configuré **et** salon résolu (fail-closed) ;
 *   • **que mentionne-t-on ?** → `pingType` (EVERYONE / ROLE / NONE).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { shouldPublishMissionAnnouncement } from "@/lib/mission-publish";

const DIALOG = "src/components/missions/mission-publish-flow-dialog.tsx";

const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("mission-publish — la décision d'envoyer ne dépend pas du ping", () => {
    it("publie l'annonce pour NONE, ROLE et EVERYONE dès qu'un salon est configuré", () => {
        for (const pingType of ["NONE", "ROLE", "EVERYONE"] as const) {
            expect(
                shouldPublishMissionAnnouncement({ pingType, isDiscordConfigured: true, channelId: "123456789" }),
                pingType,
            ).toBe(true);
        }
    });

    it("reste silencieux sans salon ou sans bot (fail-closed, jamais une destination inventée)", () => {
        expect(shouldPublishMissionAnnouncement({ pingType: "NONE", channelId: null })).toBe(false);
        expect(shouldPublishMissionAnnouncement({ pingType: "NONE", channelId: "   " })).toBe(false);
        expect(shouldPublishMissionAnnouncement({ pingType: "EVERYONE", channelId: "" })).toBe(false);
        expect(
            shouldPublishMissionAnnouncement({
                pingType: "EVERYONE",
                isDiscordConfigured: false,
                channelId: "123456789",
            }),
        ).toBe(false);
    });
});

describe("mission-publish-flow-dialog — câblage de la première publication", () => {
    it("ne court-circuite plus Discord quand on choisit « Sans ping »", () => {
        const dialog = codeOnly(DIALOG);
        expect(dialog).not.toMatch(/skipDiscord\s*=\s*pingType\s*===\s*["']NONE["']/);
        expect(dialog).not.toContain('pingType === "NONE" || !isDiscordConfigured');
        expect(dialog).toContain("shouldPublishMissionAnnouncement(");
        expect(dialog).toContain("const skipDiscord = !willPublishAnnouncement");
    });

    it("le bouton dit ce qui va réellement se passer", () => {
        const dialog = codeOnly(DIALOG);
        expect(dialog).toContain("Publier l'annonce Discord (sans mention)");
        expect(dialog).toContain("Publier les missions (sans notification)");
        expect(dialog).toContain("Publier & Notifier sur Discord");
    });
});
