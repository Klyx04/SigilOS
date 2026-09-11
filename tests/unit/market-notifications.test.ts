/**
 * Module « Marché » — tests des notifications vendeur (S4.8, §11.9 / D30 / Q12).
 *
 * Deux niveaux pour un seul contrat :
 *   1. `@/lib/market/notifications` (**pur**) : table `NotificationType` → clé
 *      `notificationPrefs.market[<clé>]`, règle **fail-closed** (seul un `false`
 *      explicite coupe), nettoyage des libellés (§13.7 : la copie ne peut ni
 *      ping une guilde, ni porter un montant/un pseudo) et deep-link **relatif** ;
 *   2. `@/server/market/notifications` : **jamais d'exception** et **aucun DM**
 *      (D30) — trace dashboard + mention du créateur dans le fil de son annonce.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/server/discord", () => ({
    sendChannelMessage: vi.fn().mockResolvedValue("message-1"),
}));

vi.mock("@/server/actions/notification-actions", () => ({
    createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/prisma", () => ({
    db: {
        account: { findFirst: vi.fn() },
        marketDiscordMessage: { findUnique: vi.fn() },
    },
}));

import { db } from "@/lib/prisma";
import { sendChannelMessage } from "@/server/discord";
import { createNotification } from "@/server/actions/notification-actions";
import {
    MARKET_NOTIFICATION_PREF_COUNT,
    MARKET_NOTIFICATION_PREF_KEYS,
    MARKET_NOTIFICATION_PREF_LABELS,
    MARKET_NOTIFICATION_TYPES,
    buildMarketNotificationCopy,
    buildMarketNotificationLink,
    buildMarketOwnerMentionCopy,
    isMarketNotificationEnabled,
    sanitizeMarketLabel,
} from "@/lib/market/notifications";
import {
    mentionMarketListingOwner,
    notifyMarketSellerActivity,
    notifyMarketUser,
    resolveMarketDiscordUserId,
} from "@/server/market/notifications";

const GUILD_DISCORD_ID = "123456789012345678";
const OTHER_GUILD_DISCORD_ID = "999999999999999999";
const LISTING_ID = "cm5marketlisting0001";
const OWNER_USER_ID = "user-seller";
const OWNER_PROFILE_ID = "profile-seller";
const BUYER_PROFILE_ID = "profile-buyer";
const OWNER_DISCORD_ID = "987654321098765432";
const CHANNEL_ID = "555555555555555555";
const ITEM_LABEL = "Dofus Turquoise";
const EXPECTED_LINK = `/dashboard/${GUILD_DISCORD_ID}/marche/${LISTING_ID}`;

type Mock = ReturnType<typeof vi.fn>;

/** Destinataire type d'une notification Marché (vendeur propriétaire). */
const target = {
    userId: OWNER_USER_ID,
    discordGuildId: GUILD_DISCORD_ID,
    listingId: LISTING_ID,
    itemLabel: ITEM_LABEL,
};

/** Paramètres type d'une mention Discord du créateur (Q12). */
const mentionParams = {
    ownerUserId: OWNER_USER_ID,
    listingId: LISTING_ID,
    discordGuildId: GUILD_DISCORD_ID,
    itemLabel: ITEM_LABEL,
};

describe("market notifications — table de préférences §11.9", () => {
    it("expose huit interrupteurs, un par type de notification Marché", () => {
        expect(MARKET_NOTIFICATION_PREF_COUNT).toBe(8);
        expect(MARKET_NOTIFICATION_TYPES).toHaveLength(8);
        expect(new Set(MARKET_NOTIFICATION_TYPES).size).toBe(8);
        expect(MARKET_NOTIFICATION_PREF_KEYS.MARKET_RESERVED).toBe("reserved");
        expect(MARKET_NOTIFICATION_PREF_KEYS.MARKET_OFFER_RECEIVED).toBe("offer_received");
    });

    it("fournit un libellé et une aide pour chaque interrupteur (UI du profil)", () => {
        for (const type of MARKET_NOTIFICATION_TYPES) {
            const entry = MARKET_NOTIFICATION_PREF_LABELS[MARKET_NOTIFICATION_PREF_KEYS[type]];
            expect(entry?.label).toBeTruthy();
            expect(entry?.hint).toBeTruthy();
        }
    });
});

describe("isMarketNotificationEnabled — fail-closed §11.9", () => {
    it("active par défaut : préférences absentes, vides ou Json inattendu", () => {
        expect(isMarketNotificationEnabled(undefined, "MARKET_RESERVED")).toBe(true);
        expect(isMarketNotificationEnabled(null, "MARKET_RESERVED")).toBe(true);
        expect(isMarketNotificationEnabled("nope", "MARKET_RESERVED")).toBe(true);
        expect(isMarketNotificationEnabled({}, "MARKET_RESERVED")).toBe(true);
        expect(isMarketNotificationEnabled({ market: null }, "MARKET_RESERVED")).toBe(true);
        expect(isMarketNotificationEnabled({ market: "off" }, "MARKET_RESERVED")).toBe(true);
    });

    it("ne coupe que sur un `false` explicite, et type par type", () => {
        const prefs = { market: { reserved: false } };
        expect(isMarketNotificationEnabled(prefs, "MARKET_RESERVED")).toBe(false);
        expect(isMarketNotificationEnabled(prefs, "MARKET_OFFER_RECEIVED")).toBe(true);
    });

    it("ignore une valeur non booléenne (le réglage n'est jamais deviné)", () => {
        expect(isMarketNotificationEnabled({ market: { reserved: "false" } }, "MARKET_RESERVED")).toBe(true);
        expect(isMarketNotificationEnabled({ market: { reserved: 0 } }, "MARKET_RESERVED")).toBe(true);
        expect(isMarketNotificationEnabled({ market: { reserved: true } }, "MARKET_RESERVED")).toBe(true);
    });
});

describe("sanitizeMarketLabel — §13.7, aucune injection", () => {
    it("neutralise les mentions Discord et le markdown", () => {
        const clean = sanitizeMarketLabel("@everyone <@123456> <@&654321> **Kamas** `x` <@!42> @here");

        expect(clean).not.toMatch(/@everyone/i);
        expect(clean).not.toMatch(/@here/i);
        expect(clean).not.toContain("<@");
        expect(clean).not.toContain("*");
        expect(clean).not.toContain("`");
        expect(clean).toContain("Kamas");
    });

    it("normalise les espaces et les caractères de contrôle, puis tronque", () => {
        expect(sanitizeMarketLabel("  Dofus\n\tEmeraude  ")).toBe("Dofus Emeraude");

        const long = sanitizeMarketLabel("A".repeat(200));
        expect(long.length).toBeLessThanOrEqual(80);
        expect(long.endsWith("…")).toBe(true);
        expect(sanitizeMarketLabel("A".repeat(200), 10).length).toBeLessThanOrEqual(10);
    });

    it("retourne une chaîne vide pour tout ce qui n'est pas un titre", () => {
        expect(sanitizeMarketLabel(undefined)).toBe("");
        expect(sanitizeMarketLabel(42)).toBe("");
        expect(sanitizeMarketLabel({ toString: () => "piège" })).toBe("");
    });
});

describe("buildMarketNotificationCopy — copie pauvre §13.7", () => {
    it("associe un titre distinct à chacun des huit types", () => {
        expect(buildMarketNotificationCopy("MARKET_OFFER_RECEIVED", { itemLabel: ITEM_LABEL }).title)
            .toContain("Nouvelle offre reçue");
        expect(buildMarketNotificationCopy("MARKET_RESERVED", { itemLabel: ITEM_LABEL }).title)
            .toContain("Annonce réservée");
        expect(buildMarketNotificationCopy("MARKET_OFFER_ANSWERED", { itemLabel: ITEM_LABEL }).title)
            .toContain("Réponse à ton offre");
        expect(buildMarketNotificationCopy("MARKET_REPORT_OPENED", { itemLabel: ITEM_LABEL }).title)
            .toContain("Signalement Marché à traiter");

        const titles = MARKET_NOTIFICATION_TYPES.map(
            (type) => buildMarketNotificationCopy(type, { itemLabel: ITEM_LABEL }).title
        );
        expect(new Set(titles).size).toBe(8);
        expect(titles.every((title) => title.length > 0)).toBe(true);
    });

    it("ne publie ni montant ni compteur (le détail reste dans le dashboard)", () => {
        const { message } = buildMarketNotificationCopy("MARKET_OFFER_RECEIVED", { itemLabel: ITEM_LABEL });

        expect(message).toContain(ITEM_LABEL);
        expect(message).not.toMatch(/\d/);
        expect(message).not.toMatch(/kamas/i);
    });

    it("reprend la durée de réservation, ou reste neutre si elle est absente", () => {
        const withHours = buildMarketNotificationCopy("MARKET_RESERVED", {
            itemLabel: ITEM_LABEL,
            reservationHours: 12,
        });
        expect(withHours.message).toContain("12 h");

        const withoutHours = buildMarketNotificationCopy("MARKET_RESERVED", {
            itemLabel: ITEM_LABEL,
            reservationHours: 0,
        });
        expect(withoutHours.message).toContain("Contacte l'acheteur");
    });

    it("distingue annulation/expiration et les trois issues de négociation", () => {
        const cancelled = buildMarketNotificationCopy("MARKET_RESERVATION_ENDED", {
            itemLabel: ITEM_LABEL,
            endReason: "cancelled",
        });
        const expired = buildMarketNotificationCopy("MARKET_RESERVATION_ENDED", {
            itemLabel: ITEM_LABEL,
            endReason: "expired",
        });
        expect(cancelled.message).toContain("annulée");
        expect(expired.message).toContain("expiré");
        expect(cancelled.message).not.toBe(expired.message);

        const decisions = (["accepted", "rejected", "counter"] as const).map(
            (decision) => buildMarketNotificationCopy("MARKET_OFFER_ANSWERED", {
                itemLabel: ITEM_LABEL,
                decision,
            }).message
        );
        expect(new Set(decisions).size).toBe(3);
        expect(decisions[0]).toContain("acceptée");
        expect(decisions[1]).toContain("refusée");
        expect(decisions[2]).toContain("contre-offre");
    });

    it("nettoie le libellé et retombe sur « ton annonce » s'il est vide", () => {
        const clean = buildMarketNotificationCopy("MARKET_OFFER_RECEIVED", {
            itemLabel: "@everyone <@1> Dofus",
        });
        expect(clean.message).not.toMatch(/@everyone/i);
        expect(clean.message).toContain("Dofus");

        const fallback = buildMarketNotificationCopy("MARKET_OFFER_RECEIVED", { itemLabel: "   " });
        expect(fallback.message).toContain("ton annonce");
    });
});

describe("buildMarketOwnerMentionCopy — Q12", () => {
    it("préfixe la mention du créateur quand son snowflake est connu", () => {
        const text = buildMarketOwnerMentionCopy("MARKET_RESERVED", {
            itemLabel: ITEM_LABEL,
            reservationHours: 6,
            discordUserId: OWNER_DISCORD_ID,
        });

        expect(text.startsWith(`<@${OWNER_DISCORD_ID}> `)).toBe(true);
        expect(text).toContain("6 h");
    });

    it("n'invente jamais de ping sans snowflake (aucun faux « @ »)", () => {
        const bare = buildMarketOwnerMentionCopy("MARKET_RESERVED", {
            itemLabel: ITEM_LABEL,
            discordUserId: null,
        });

        expect(bare).not.toContain("<@");
        expect(bare).toBe(buildMarketNotificationCopy("MARKET_RESERVED", { itemLabel: ITEM_LABEL }).message);
    });
});

describe("buildMarketNotificationLink — deep-link relatif", () => {
    it("pointe la fiche SigilOS de l'annonce, sans hôte ni protocole", () => {
        const link = buildMarketNotificationLink(GUILD_DISCORD_ID, LISTING_ID);

        expect(link).toBe(EXPECTED_LINK);
        expect(link.startsWith("/")).toBe(true);
        expect(link).not.toContain("http");
    });
});

beforeEach(() => {
    vi.clearAllMocks();
    (createNotification as unknown as Mock).mockResolvedValue({});
    (sendChannelMessage as unknown as Mock).mockResolvedValue("message-1");
    (db.marketDiscordMessage.findUnique as unknown as Mock).mockResolvedValue({
        discordChannelId: CHANNEL_ID,
        discordGuildId: GUILD_DISCORD_ID,
    });
    (db.account.findFirst as unknown as Mock).mockResolvedValue({ providerAccountId: OWNER_DISCORD_ID });
});

describe("notifyMarketUser — trace dashboard §11.9", () => {
    it("crée une Notification de catégorie MARKET avec le deep-link de l'annonce", async () => {
        const ok = await notifyMarketUser("MARKET_RESERVED", target, { reservationHours: 12 });

        expect(ok).toBe(true);
        expect(createNotification).toHaveBeenCalledTimes(1);

        const [userId, type, title, message, link, discordGuildId, category] =
            (createNotification as unknown as Mock).mock.calls[0];
        expect(userId).toBe(OWNER_USER_ID);
        expect(type).toBe("MARKET_RESERVED");
        expect(title).toContain("Annonce réservée");
        expect(message).toContain(ITEM_LABEL);
        expect(link).toBe(EXPECTED_LINK);
        expect(discordGuildId).toBe(GUILD_DISCORD_ID);
        expect(category).toBe("MARKET");
    });

    it("ne lève jamais : renvoie `false` si la trace échoue", async () => {
        (createNotification as unknown as Mock).mockRejectedValue(new Error("db down"));

        await expect(notifyMarketUser("MARKET_SOLD", target)).resolves.toBe(false);
    });
});

describe("resolveMarketDiscordUserId — Account Auth.js", () => {
    it("lit le snowflake du provider `discord`", async () => {
        await expect(resolveMarketDiscordUserId(OWNER_USER_ID)).resolves.toBe(OWNER_DISCORD_ID);

        const where = (db.account.findFirst as unknown as Mock).mock.calls[0][0].where;
        expect(where).toEqual({ userId: OWNER_USER_ID, provider: "discord" });
    });

    it("renvoie `null` sans compte Discord lié", async () => {
        (db.account.findFirst as unknown as Mock).mockResolvedValue(null);

        await expect(resolveMarketDiscordUserId(OWNER_USER_ID)).resolves.toBeNull();
    });
});

describe("mentionMarketListingOwner — Q12, jamais un DM (D30)", () => {
    it("mentionne le créateur dans le fil de l'annonce, embeds neutralisés", async () => {
        const ok = await mentionMarketListingOwner({ type: "MARKET_OFFER_RECEIVED", ...mentionParams });

        expect(ok).toBe(true);
        const lookup = (db.marketDiscordMessage.findUnique as unknown as Mock).mock.calls[0][0];
        expect(lookup.where).toEqual({ listingId: LISTING_ID });

        const [channelId, content, options] = (sendChannelMessage as unknown as Mock).mock.calls[0];
        expect(channelId).toBe(CHANNEL_ID);
        expect(content.startsWith(`<@${OWNER_DISCORD_ID}> `)).toBe(true);
        expect(content).toContain(ITEM_LABEL);
        expect(options).toMatchObject({ suppressEmbeds: true });
    });

    it("ne mentionne rien pour une annonce non publiée (aucun fil)", async () => {
        (db.marketDiscordMessage.findUnique as unknown as Mock).mockResolvedValue(null);

        await expect(mentionMarketListingOwner({ type: "MARKET_RESERVED", ...mentionParams }))
            .resolves.toBe(false);
        expect(sendChannelMessage).not.toHaveBeenCalled();
    });

    it("refuse une guilde Discord différente (§16.2)", async () => {
        (db.marketDiscordMessage.findUnique as unknown as Mock).mockResolvedValue({
            discordChannelId: CHANNEL_ID,
            discordGuildId: OTHER_GUILD_DISCORD_ID,
        });

        await expect(mentionMarketListingOwner({ type: "MARKET_RESERVED", ...mentionParams }))
            .resolves.toBe(false);
        expect(sendChannelMessage).not.toHaveBeenCalled();
    });

    it("sans compte Discord lié : pas de ping, et pas d'échec", async () => {
        (db.account.findFirst as unknown as Mock).mockResolvedValue(null);

        await expect(mentionMarketListingOwner({ type: "MARKET_RESERVED", ...mentionParams }))
            .resolves.toBe(false);
        expect(sendChannelMessage).not.toHaveBeenCalled();
    });

    it("ne lève jamais si Discord refuse le message", async () => {
        (sendChannelMessage as unknown as Mock).mockRejectedValue(new Error("discord down"));

        await expect(mentionMarketListingOwner({ type: "MARKET_RESERVED", ...mentionParams }))
            .resolves.toBe(false);
    });
});

describe("notifyMarketSellerActivity — arrivée d'offre / réservation §11.9", () => {
    const activity = {
        type: "MARKET_RESERVED" as const,
        ownerUserId: OWNER_USER_ID,
        ownerProfileId: OWNER_PROFILE_ID,
        actorProfileId: BUYER_PROFILE_ID,
        listingId: LISTING_ID,
        discordGuildId: GUILD_DISCORD_ID,
        itemLabel: ITEM_LABEL,
        reservationHours: 12,
    };

    it("alerte le vendeur sur le dashboard **et** dans le fil de son annonce", async () => {
        await notifyMarketSellerActivity(activity);

        expect(createNotification).toHaveBeenCalledTimes(1);
        expect(sendChannelMessage).toHaveBeenCalledTimes(1);
        expect((createNotification as unknown as Mock).mock.calls[0][4]).toBe(EXPECTED_LINK);
    });

    it("ne s'auto-notifie pas quand l'auteur de l'action est le vendeur", async () => {
        await notifyMarketSellerActivity({ ...activity, actorProfileId: OWNER_PROFILE_ID });

        expect(createNotification).not.toHaveBeenCalled();
        expect(sendChannelMessage).not.toHaveBeenCalled();
        expect(db.marketDiscordMessage.findUnique).not.toHaveBeenCalled();
    });

    it("reste non bloquant : le fil est mentionné même si le dashboard échoue", async () => {
        (createNotification as unknown as Mock).mockRejectedValue(new Error("db down"));

        await expect(notifyMarketSellerActivity({ ...activity, type: "MARKET_OFFER_RECEIVED" }))
            .resolves.toBeUndefined();
        expect(sendChannelMessage).toHaveBeenCalledTimes(1);
    });
});



