/**
 * Registre Membres & Recrutement — règles pures (date d'arrivée manuelle,
 * ancienneté calculée, décision d'essai, tag Ankama, export CSV).
 */

import { describe, expect, it } from "vitest";
import {
    buildRegistryCsv,
    computeSeniorityDays,
    getTrialDecision,
    isValidAnkamaId,
    resolveJoinedAt,
} from "@/lib/member-registry";

describe("registre membres — date d'arrivée et ancienneté", () => {
    it("retient la date manuelle, sinon la création du profil", () => {
        expect(resolveJoinedAt({ guildJoinedAt: "2024-10-04T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" })).toBe(
            "2024-10-04T00:00:00.000Z"
        );
        expect(resolveJoinedAt({ guildJoinedAt: null, createdAt: "2026-01-01T00:00:00.000Z" })).toBe("2026-01-01T00:00:00.000Z");
    });

    it("calcule l'ancienneté en jours, jamais négative", () => {
        const now = new Date("2026-09-24T12:00:00.000Z");
        expect(computeSeniorityDays("2024-10-04T00:00:00.000Z", now)).toBe(720);
        expect(computeSeniorityDays("2099-01-01T00:00:00.000Z", now)).toBe(0);
        expect(computeSeniorityDays("pas-une-date", now)).toBe(0);
    });
});

describe("registre membres — décision d'essai", () => {
    const joined = "2026-09-01T00:00:00.000Z";

    it("CONFIRMED donne oui", () => {
        expect(getTrialDecision({ lifecycleStatus: "CONFIRMED", joinedAtIso: joined, trialDurationDays: 15 })).toBe("oui");
    });

    it("TRIAL sans fin posée donne non", () => {
        expect(getTrialDecision({ lifecycleStatus: "TRIAL", trialEndsAt: null, joinedAtIso: joined, trialDurationDays: 15 })).toBe(
            "non"
        );
    });

    it("TRIAL à durée par défaut donne non, repoussé donne prolonge", () => {
        expect(
            getTrialDecision({
                lifecycleStatus: "TRIAL",
                trialEndsAt: "2026-09-16T00:00:00.000Z",
                joinedAtIso: joined,
                trialDurationDays: 15,
            })
        ).toBe("non");
        expect(
            getTrialDecision({
                lifecycleStatus: "TRIAL",
                trialEndsAt: "2026-10-15T00:00:00.000Z",
                joinedAtIso: joined,
                trialDurationDays: 15,
            })
        ).toBe("prolonge");
    });
});

describe("registre membres — tag Ankama et CSV", () => {
    it("valide le format Nom#0000", () => {
        expect(isValidAnkamaId("michmich8956392#4777")).toBe(true);
        expect(isValidAnkamaId("Pseudo#123")).toBe(false);
        expect(isValidAnkamaId("Pseudo#12345")).toBe(false);
        expect(isValidAnkamaId("Pseudo")).toBe(false);
    });

    it("exporte les colonnes du tableur, ID Discord inclus, sans casser les ;", () => {
        const { filename, content } = buildRegistryCsv(
            [
                {
                    displayName: "Wy lan",
                    pseudoDofus: "Wylan",
                    discordNickname: "Wylan (LEAD)",
                    joinedAt: "2024-10-04T10:00:00.000Z",
                    seniorityDays: 720,
                    discordId: "403000342167420929",
                    ankamaId: "michmich8956392#4777",
                    recruiterName: "Wylan",
                    trialDecision: "oui",
                    trialEndsAt: null,
                    muleCount: 1,
                    mules: ["Mule;A"],
                    staffNotes: "OK",
                },
            ],
            "1290442961380835451",
            "2026-09-24T12:00:00.000Z"
        );
        expect(filename).toBe("sigilos_registre_1290442961380835451_2026-09-24.csv");
        const [headers, line] = content.split("\n");
        expect(headers).toContain("ID Discord");
        expect(headers).toContain("Aujourd'hui");
        expect(line).toContain("403000342167420929");
        expect(line).toContain("2026-09-24");
        // Le ; dans le pseudo de mule est échappé par guillemets.
        expect(line).toContain('"Mule;A"');
    });
});
