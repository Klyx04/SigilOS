/**
 * Registre Membres & Recrutement — règles pures (date d'arrivée manuelle,
 * ancienneté calculée, décision d'essai, tag Ankama, export CSV).
 */

import { describe, expect, it } from "vitest";
import {
    MAX_REGISTRY_COMMENTS,
    buildRegistryCsv,
    canAddRegistryComment,
    computeSeniorityDays,
    getTrialDecision,
    isValidAnkamaId,
    parseAnkamaTag,
    hasPseudoDiscordMismatch,
    resolveJoinedAt,
    sortRegistryComments,
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

    it("validé donne oui", () => {
        expect(getTrialDecision({ trialValidated: true, joinedAtIso: joined, trialDurationDays: 15 })).toBe("oui");
    });

    it("non validé sans fin posée donne non", () => {
        expect(getTrialDecision({ trialValidated: false, trialEndsAt: null, joinedAtIso: joined, trialDurationDays: 15 })).toBe(
            "non"
        );
    });

    it("non validé à durée par défaut donne non, repoussé donne prolonge", () => {
        expect(
            getTrialDecision({
                trialValidated: false,
                trialEndsAt: "2026-09-16T00:00:00.000Z",
                joinedAtIso: joined,
                trialDurationDays: 15,
            })
        ).toBe("non");
        expect(
            getTrialDecision({
                trialValidated: false,
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
                    comments: [
                        {
                            id: "c1",
                            body: "Essai prolongé : peu de présence en soirée",
                            authorName: "Wylan",
                            authorUserId: "u1",
                            createdAt: "2026-09-20T18:05:00.000Z",
                        },
                        {
                            id: "c2",
                            body: "Relance faite",
                            authorName: "Klyx",
                            authorUserId: "u2",
                            createdAt: "2026-09-24T09:30:00.000Z",
                        },
                    ],
                },
            ],
            "1290442961380835451",
            "2026-09-24T12:00:00.000Z"
        );
        expect(filename).toBe("sigilos_registre_1290442961380835451_2026-09-24.csv");
        const [headers, line] = content.split("\n");
        expect(headers).toContain("ID Discord");
        expect(headers).toContain("Aujourd'hui");
        expect(headers).toContain("Commentaires");
        expect(line).toContain("403000342167420929");
        expect(line).toContain("2026-09-24");
        // Le ; dans le pseudo de mule est échappé par guillemets.
        expect(line).toContain('"Mule;A"');
        // Journal horodaté et signé, du plus ancien au plus récent.
        expect(line).toContain("2026-09-20 18:05 — Wylan : Essai prolongé");
        expect(line).toContain("2026-09-24 09:30 — Klyx : Relance faite");
    });
});

describe("registre membres — commentaires du staff", () => {
    const comments = [
        { id: "b", body: "deuxième", authorName: "Klyx", authorUserId: null, createdAt: "2026-09-24T09:00:00.000Z" },
        { id: "a", body: "premier", authorName: "Wylan", authorUserId: "u1", createdAt: "2026-09-20T18:00:00.000Z" },
    ];

    it("rend le journal dans l'ordre de lecture, du plus ancien au plus récent", () => {
        expect(sortRegistryComments(comments).map((c) => c.id)).toEqual(["a", "b"]);
        // L'ordre reçu n'est jamais muté.
        expect(comments.map((c) => c.id)).toEqual(["b", "a"]);
    });

    it("plafonne le journal à 20 entrées", () => {
        expect(MAX_REGISTRY_COMMENTS).toBe(20);
        expect(canAddRegistryComment(0)).toBe(true);
        expect(canAddRegistryComment(19)).toBe(true);
        expect(canAddRegistryComment(20)).toBe(false);
    });
});

describe("Ankama Tag Helpers", () => {
    it("décompose correctement le tag Nom#0000", () => {
        expect(parseAnkamaTag("Michmich#4777")).toEqual({ name: "Michmich", discriminator: "4777" });
        expect(parseAnkamaTag(null)).toBeNull();
        expect(parseAnkamaTag("SansTag")).toEqual({ name: "SansTag", discriminator: "" });
    });

    it("détecte une divergence entre pseudo Discord et tag Ankama", () => {
        expect(hasPseudoDiscordMismatch("Wylan 👑 (LEAD)", "michmich8956392#4777")).toBe(true);
        expect(hasPseudoDiscordMismatch("Michmich", "Michmich#4777")).toBe(false);
        expect(hasPseudoDiscordMismatch("Mich-Mich", "michmich#4777")).toBe(false);
        expect(hasPseudoDiscordMismatch(null, "Michmich#4777")).toBe(false);
    });
});
