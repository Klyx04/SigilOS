/**
 * Signalements visiteurs connectés — garde de câblage.
 *
 * Décision : un compte connecté peut signaler depuis les surfaces publiques
 * (en-tête public, profil visiteur, élevage, guide Rush) **sans** appartenir à
 * la guilde visitée. Le ticket est rattaché à sa guilde d'accueil si elle
 * existe, sinon à la plateforme.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Signalements visiteurs connectés", () => {
    it("le header public monte le bouton pour un compte connecté", () => {
        const header = read("src/components/layout/public-header.tsx");
        expect(header).toMatch(/VisitorFeedbackButton/);
        expect(header).toMatch(/\{user && <VisitorFeedbackButton/);
    });

    it("l'espace visiteur affiche l'historique personnel et le bouton", () => {
        const page = read("src/app/espace-visiteur/general/page.tsx");
        expect(page).toMatch(/getMyVisitorFeedbackAction/);
        expect(page).toMatch(/<VisitorFeedbackHistory/);
        expect(read("src/app/espace-visiteur/_components/visitor-feedback-history.tsx"))
            .toMatch(/<VisitorFeedbackButton/);
    });

    it("l'overlay Rush bascule sur l'action visiteur en mode public connecté", () => {
        const panel = read("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayFeedbackPanel.tsx");
        expect(panel).toMatch(/submitVisitorFeedbackAction/);
        expect(panel).toMatch(/visitorMode/);
        expect(panel).toMatch(/visitorMode\s*\?/);
        expect(read("src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx"))
            .toMatch(/visitorMode=\{isGuest && feedbackSignedIn\}/);
    });

    it("les actions visiteur existent et n'exigent pas de guilde fournie par le client", () => {
        const actions = read("src/server/actions/feedback-actions.ts");
        expect(actions).toMatch(/export async function submitVisitorFeedbackAction/);
        expect(actions).toMatch(/export async function getMyVisitorFeedbackAction/);
        expect(actions).toMatch(/visitorFeedbackSchema = feedbackSchema\.omit\(\{ guildId: true \}\)/);
        expect(actions).toMatch(/guildId: homeProfile\?\.guildId \?\? null/);
    });
});
