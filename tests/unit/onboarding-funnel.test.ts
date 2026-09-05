import { describe, it, expect } from "vitest";
import {
    isRbacConfigured,
    isOnboardingComplete,
    isEveryoneRole,
    buildPendingGuildIconUrl,
    getGettingStartedPercent,
} from "@/lib/onboarding-gating";
import { buildDiscordBotInviteUrl } from "@/lib/discord-permissions";

/**
 * One-shot onboarding : landing → portail → invite bot → getting-started.
 * A. RBAC fail-closed sur @everyone (le bug "annuaire/calendrier/mini-jeux
 *    visibles après avoir autorisé everyone").
 * B. Invite bot : pré-sélection de guilde + fail-closed sans clientId.
 * C. Icônes portail : host CDN + ?size=128 (fini les 404).
 * D. % getting-started : progression sur les obligatoires d'abord (fini le 0%).
 */
describe("onboarding-funnel A-Z", () => {
    const EVERYONE = "1545599253949325322"; // @everyone = id Discord de la guilde
    const OTHER_ROLE = "111111111111111111";

    it("A1 — dashboard:login sur un rôle explicite = RBAC configuré", () => {
        expect(isRbacConfigured({ [OTHER_ROLE]: ["dashboard:login"] }, EVERYONE)).toBe(true);
    });

    it("A2 — dashboard:login UNIQUEMENT sur @everyone = NON configuré (fail-closed)", () => {
        expect(isRbacConfigured({ [EVERYONE]: ["dashboard:login"] }, EVERYONE)).toBe(false);
    });

    it("A3 — @everyone + un vrai rôle = configuré (everyone ignoré, rôle compte)", () => {
        expect(
            isRbacConfigured(
                { [EVERYONE]: ["dashboard:login"], [OTHER_ROLE]: ["dashboard:login"] },
                EVERYONE,
            ),
        ).toBe(true);
    });

    it("A4 — mapping vide / null = non configuré", () => {
        expect(isRbacConfigured({}, EVERYONE)).toBe(false);
        expect(isRbacConfigured(null, EVERYONE)).toBe(false);
        expect(isRbacConfigured(undefined, EVERYONE)).toBe(false);
    });

    it("A5 — onboarding complet exige serveur de jeu + RBAC explicite", () => {
        expect(isOnboardingComplete({ [OTHER_ROLE]: ["dashboard:login"] }, 295, EVERYONE)).toBe(true);
        expect(isOnboardingComplete({ [OTHER_ROLE]: ["dashboard:login"] }, null, EVERYONE)).toBe(false);
        expect(isOnboardingComplete({ [EVERYONE]: ["dashboard:login"] }, 295, EVERYONE)).toBe(false);
    });

    it("A6 — isEveryoneRole : l'id @everyone est l'id de la guilde", () => {
        expect(isEveryoneRole(EVERYONE, EVERYONE)).toBe(true);
        expect(isEveryoneRole(OTHER_ROLE, EVERYONE)).toBe(false);
    });

    it("B1 — invite bot pré-sélectionne la guilde (retour /onboarding/success)", () => {
        const url = buildDiscordBotInviteUrl("123456789012345678", {
            guildId: EVERYONE,
            redirectUri: "https://beta.sigilos.fr/onboarding/success",
            scope: "bot",
        });
        expect(url).toContain(`guild_id=${EVERYONE}`);
        expect(url).toContain("redirect_uri=");
        expect(url).toContain("permissions=6356836904068");
        expect(url).not.toContain("permissions=8&");
    });

    it("B2 — invite bot fail-closed sans clientId", () => {
        expect(buildDiscordBotInviteUrl("")).toBeNull();
    });

    it("C1 — icône portail : CDN + size bornée", () => {
        expect(buildPendingGuildIconUrl(EVERYONE, "abc123")).toBe(
            `https://cdn.discordapp.com/icons/${EVERYONE}/abc123.png?size=128`,
        );
    });

    it("C2 — icône portail : null sans hash (fallback initiales, pas de 404)", () => {
        expect(buildPendingGuildIconUrl(EVERYONE, null)).toBeNull();
    });

    it("D1 — guilde fraîche : 0% obligatoires (pas de 0% global anxiogène sur les 6 étapes)", () => {
        const steps = [
            { id: "dofus", status: "TO_DO", mandatory: true, points: 20 },
            { id: "rbac", status: "TO_DO", mandatory: true, points: 20 },
            { id: "discord", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "modules", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "presentation", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "missions", status: "TO_DO", mandatory: false, points: 15 },
        ] as const;
        const res = getGettingStartedPercent([...steps]);
        expect(res.mandatoryComplete).toBe(false);
        expect(res.percent).toBe(0);
        expect(res.mandatoryPercent).toBe(0);
    });

    it("D2 — 1re obligatoire validée = 50% (pas 20%)", () => {
        const steps = [
            { id: "dofus", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "rbac", status: "TO_DO", mandatory: true, points: 20 },
            { id: "discord", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "modules", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "presentation", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "missions", status: "TO_DO", mandatory: false, points: 15 },
        ] as const;
        const res = getGettingStartedPercent([...steps]);
        expect(res.mandatoryComplete).toBe(false);
        expect(res.percent).toBe(50);
    });

    it("D3 — obligatoires complètes = % global (40/100 ici)", () => {
        const steps = [
            { id: "dofus", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "rbac", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "discord", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "modules", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "presentation", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "missions", status: "TO_DO", mandatory: false, points: 15 },
        ] as const;
        const res = getGettingStartedPercent([...steps]);
        expect(res.mandatoryComplete).toBe(true);
        expect(res.percent).toBe(40);
    });

    it("D4 — tout complété = 100% + mandatoryComplete", () => {
        const steps = [
            { id: "dofus", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "rbac", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "discord", status: "COMPLETED", mandatory: false, points: 15 },
            { id: "modules", status: "COMPLETED", mandatory: false, points: 15 },
            { id: "presentation", status: "COMPLETED", mandatory: false, points: 15 },
            { id: "missions", status: "COMPLETED", mandatory: false, points: 15 },
        ] as const;
        const res = getGettingStartedPercent([...steps]);
        expect(res.mandatoryComplete).toBe(true);
        expect(res.percent).toBe(100);
    });
});
