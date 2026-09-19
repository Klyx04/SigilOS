/**
 * Rappel automatique des raids (`@/lib/raid-reminder`) — demande user du
 * 19/09/2026 : « un ping qui ping uniquement les membres inscrits (et pas les
 * rôles mentionnés dans l'embed) 1 h avant un raid, un ping automatique ».
 *
 * Ces tests verrouillent les trois invariants : mentions d'inscrits ONLY, un seul
 * envoi par raid, jamais hors de la fenêtre `notifyBefore`.
 */

import { describe, it, expect } from "vitest";
import {
    RAID_REMINDER_DEFAULT_LEAD_MIN,
    RAID_REMINDER_MAX_LEAD_MIN,
    RAID_REMINDER_MAX_MENTIONS,
    RAID_REMINDER_MIN_LEAD_MIN,
    buildRaidReminderMentions,
    pickRaidReminderChannelId,
    raidReminderLeadLabel,
    resolveRaidReminderLeadMinutes,
    shouldSendRaidReminder,
    type RaidReminderDecision,
} from "@/lib/raid-reminder";

/** Raison du refus (le test échoue si le rappel partait). */
function skipReason(decision: RaidReminderDecision): string {
    if (decision.send) return "sent";
    return decision.reason;
}

const NOW = new Date("2026-09-19T12:00:00.000Z");
const inMinutes = (min: number) => new Date(NOW.getTime() + min * 60_000);

/** Base d'un raid sain : publié, dans 1 h, 8 inscrits, salon connu, jamais rappelé. */
function baseArgs(overrides: Record<string, unknown> = {}) {
    return {
        type: "RAID_OFFICIAL",
        status: "PUBLISHED",
        startDate: inMinutes(60),
        now: NOW,
        notifyBefore: 60,
        channelId: "1357151089043964124",
        registeredCount: 8,
        autoReminderSentAt: null,
        manualReminderAt: null,
        ...overrides,
    } as Parameters<typeof shouldSendRaidReminder>[0];
}

describe("resolveRaidReminderLeadMinutes", () => {
    it("applique 1 h par défaut (« 1h avant un raid »)", () => {
        expect(RAID_REMINDER_DEFAULT_LEAD_MIN).toBe(60);
        expect(resolveRaidReminderLeadMinutes(null)).toBe(60);
        expect(resolveRaidReminderLeadMinutes(undefined)).toBe(60);
        expect(resolveRaidReminderLeadMinutes("abc")).toBe(60);
        expect(resolveRaidReminderLeadMinutes(Number.NaN)).toBe(60);
    });

    it("respecte le réglage de l'événement et borne les valeurs aberrantes", () => {
        expect(resolveRaidReminderLeadMinutes(120)).toBe(120);
        expect(resolveRaidReminderLeadMinutes("45")).toBe(45);
        expect(resolveRaidReminderLeadMinutes(1)).toBe(RAID_REMINDER_MIN_LEAD_MIN);
        expect(resolveRaidReminderLeadMinutes(-30)).toBe(RAID_REMINDER_MIN_LEAD_MIN);
        expect(resolveRaidReminderLeadMinutes(99999)).toBe(RAID_REMINDER_MAX_LEAD_MIN);
    });
});

describe("shouldSendRaidReminder", () => {
    it("envoie dans la fenêtre (raid dans 1 h, fenêtre 60 min)", () => {
        expect(shouldSendRaidReminder(baseArgs())).toEqual({ send: true, leadMinutes: 60 });
        expect(shouldSendRaidReminder(baseArgs({ startDate: inMinutes(12) })).send).toBe(true);
    });

    it("n'envoie jamais trop tôt (avant la fenêtre)", () => {
        expect(shouldSendRaidReminder(baseArgs({ startDate: inMinutes(61) }))).toEqual({
            send: false,
            reason: "too-early",
            leadMinutes: 60,
        });
        // Fenêtre personnalisée à 3 h : un raid dans 2 h passe, un raid dans 4 h non.
        expect(shouldSendRaidReminder(baseArgs({ notifyBefore: 180, startDate: inMinutes(120) })).send).toBe(true);
        expect(skipReason(shouldSendRaidReminder(baseArgs({ notifyBefore: 180, startDate: inMinutes(240) })))).toBe("too-early");
    });

    it("n'envoie jamais une fois le raid commencé", () => {
        expect(skipReason(shouldSendRaidReminder(baseArgs({ startDate: inMinutes(0) })))).toBe("already-started");
        expect(skipReason(shouldSendRaidReminder(baseArgs({ startDate: inMinutes(-5) })))).toBe("already-started");
    });

    it("un seul ping par raid (`raidReminderSentAt`)", () => {
        expect(shouldSendRaidReminder(baseArgs({ autoReminderSentAt: NOW.toISOString() }))).toEqual({
            send: false,
            reason: "already-sent",
            leadMinutes: 60,
        });
    });

    it("se tait si un rappel MANUEL vient d'être envoyé (pas de double ping)", () => {
        expect(skipReason(shouldSendRaidReminder(baseArgs({ manualReminderAt: inMinutes(-5) })))).toBe("manual-recent");
        // Un rappel manuel ancien (> 30 min) n'empêche pas le rappel auto.
        expect(shouldSendRaidReminder(baseArgs({ manualReminderAt: inMinutes(-45) })).send).toBe(true);
    });

    it("ne ping pas un raid sans inscrit, sans salon, non publié ou non-raid", () => {
        expect(skipReason(shouldSendRaidReminder(baseArgs({ registeredCount: 0 })))).toBe("no-participants");
        expect(skipReason(shouldSendRaidReminder(baseArgs({ channelId: null })))).toBe("no-channel");
        expect(skipReason(shouldSendRaidReminder(baseArgs({ status: "DRAFT" })))).toBe("not-published");
        expect(skipReason(shouldSendRaidReminder(baseArgs({ status: "COMPLETED" })))).toBe("not-published");
        expect(skipReason(shouldSendRaidReminder(baseArgs({ type: "SOCIAL" })))).toBe("not-raid");
        expect(skipReason(shouldSendRaidReminder(baseArgs({ type: "EVENT_GUILD" })))).toBe("not-raid");
    });
});


describe("buildRaidReminderMentions — le ping ne contient QUE les inscrits", () => {
    it("produit des mentions d'utilisateurs, sans doublon", () => {
        expect(buildRaidReminderMentions(["111111111111111111", "222222222222222222", "111111111111111111"]))
            .toBe("<@111111111111111111> <@222222222222222222>");
    });

    it("écarte tout ce qui n'est pas un snowflake (jamais de ping cassé)", () => {
        expect(buildRaidReminderMentions([null, undefined, "", "abc", "123", "outbox:42"])).toBe("");
        expect(buildRaidReminderMentions(["@everyone", "111111111111111111"])).toBe("<@111111111111111111>");
    });

    it("ne peut produire AUCUNE mention de rôle (`<@&…>`), même en entrée hostile", () => {
        const mentions = buildRaidReminderMentions(["111111111111111111", "<@&999999999999999999>", "@here"]);
        expect(mentions).toBe("<@111111111111111111>");
        expect(mentions).not.toContain("<@&");
        expect(mentions).not.toContain("@here");
    });

    it("borne le nombre de mentions (limite de contenu Discord)", () => {
        const many = Array.from({ length: 200 }, (_, i) => String(100000000000000000n + BigInt(i)));
        const mentions = buildRaidReminderMentions(many);
        expect(mentions.split(" ").length).toBeLessThanOrEqual(RAID_REMINDER_MAX_MENTIONS);
    });
});

describe("pickRaidReminderChannelId", () => {
    const config = {
        raidNotifyChannelId: "1357151089043964124",
        raidGigalodonNotifyChannelId: "1000000000000000001",
        raidSanctuaireNotifyChannelId: "1000000000000000002",
    };

    it("suit le type de raid, avec repli sur le salon raid", () => {
        expect(pickRaidReminderChannelId(config, "gigalodon")).toBe("1000000000000000001");
        expect(pickRaidReminderChannelId(config, "jardin")).toBe("1000000000000000002");
        expect(pickRaidReminderChannelId(config, undefined)).toBe("1357151089043964124");
    });

    it("replie sur le salon raid si le salon dédié n'est pas configuré", () => {
        expect(pickRaidReminderChannelId({ raidNotifyChannelId: "123456789012345678" }, "gigalodon")).toBe("123456789012345678");
        expect(pickRaidReminderChannelId({}, "gigalodon")).toBeNull();
        expect(pickRaidReminderChannelId({ raidNotifyChannelId: null }, null)).toBeNull();
    });
});

describe("raidReminderLeadLabel", () => {
    it("écrit le délai en clair", () => {
        expect(raidReminderLeadLabel(30)).toBe("30 min");
        expect(raidReminderLeadLabel(60)).toBe("1 h");
        expect(raidReminderLeadLabel(90)).toBe("1 h 30");
        expect(raidReminderLeadLabel(120)).toBe("2 h");
    });
});
