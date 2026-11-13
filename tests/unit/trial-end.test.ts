import { readFileSync } from "node:fs";
/**
 * 🎓 Fin d'essai (demande user du 25/10/2026) : **aucune** validation automatique —
 * on ne fait que **signaler** l'échéance passée, une fois par membre et par échéance.
 * L'essai validé reste validé (même si sa date est ancienne), et sans échéance il n'y a
 * rien à signaler.
 */

import { describe, expect, it } from "vitest";

import { isTrialEnded, trialEndNoticeKey } from "@/lib/trial-end";

const now = new Date("2026-10-25T12:00:00.000Z");

describe("un essai est-il arrivé à échéance ?", () => {
    it("vrai quand la date est passée et l'essai non validé", () => {
        expect(isTrialEnded({ validated: false, endsAt: "2026-10-20T00:00:00.000Z", now })).toBe(true);
        expect(isTrialEnded({ validated: false, endsAt: "2026-10-25T12:00:00.000Z", now })).toBe(true);
    });

    it("faux tant que l'échéance est future", () => {
        expect(isTrialEnded({ validated: false, endsAt: "2026-10-30T00:00:00.000Z", now })).toBe(false);
    });

    it("faux si l'essai est déjà validé (on ne relance jamais un membre validé)", () => {
        expect(isTrialEnded({ validated: true, endsAt: "2026-01-01T00:00:00.000Z", now })).toBe(false);
    });

    it("faux sans échéance ou avec une date illisible", () => {
        expect(isTrialEnded({ validated: false, endsAt: null, now })).toBe(false);
        expect(isTrialEnded({ validated: false, endsAt: "pas-une-date", now })).toBe(false);
    });
});

describe("clé d'idempotence de l'embed", () => {
    it("dépend du membre ET de l'échéance (repogrammer réautorise un embed)", () => {
        const first = trialEndNoticeKey("g1", "m1", "2026-10-20T00:00:00.000Z");
        const second = trialEndNoticeKey("g1", "m1", "2026-11-20T00:00:00.000Z");
        expect(first).toBe("trial-end:g1:m1:2026-10-20");
        expect(second).not.toBe(first);
    });

    it("reste stable pour la même échéance (relances du cron = pas de doublon)", () => {
        expect(trialEndNoticeKey("g1", "m1", new Date("2026-10-20T18:30:00.000Z"))).toBe(
            trialEndNoticeKey("g1", "m1", "2026-10-20T02:00:00.000Z")
        );
    });
});
describe("notification fin d'essai — format staff uniquement", () => {
    it("n'envoie aucun message de ping personnel (message staff par embed pur)", () => {
        const actionsSource = readFileSync("src/server/actions/trial-end-actions.ts", "utf8");
        expect(actionsSource).not.toContain("ton essai est arrivé à échéance");
        expect(actionsSource).not.toContain("content:");
        expect(actionsSource).toContain("embeds: [{");
    });
});
