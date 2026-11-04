/**
 * Annonces de live — **règles pures** (`src/lib/live-notify.ts`).
 *
 * Ce que ce verrou protège :
 * 1. la normalisation du login (le `handle` God est la clé, l'URL n'est qu'un repli) ;
 * 2. **une annonce par session** (même live ⇒ même `stream.id` ⇒ une seule clé) ;
 * 3. les deux garde-fous : aucun salon ⇒ rien, live trop vieux ⇒ rien ;
 * 4. le ping : **choisi** (liste vide = aucun ping), borné, jamais `@everyone` ;
 * 5. l'embed : couleur Twitch, lien cliquable, avatar en auteur, texte assaini.
 */
import { describe, expect, it } from "vitest";
import {
    LIVE_DEDUP_TTL_SECONDS,
    LIVE_MAX_PING_ROLES,
    LIVE_NOTIFY_MAX_START_AGE_MS,
    TWITCH_EMBED_COLOR,
    buildLiveAnnouncement,
    formatLiveDuration,
    formatViewerCount,
    liveAvatarKey,
    liveDedupKey,
    livePingContent,
    normalizeTwitchLogin,
    sanitizeEmbedText,
    sanitizePingRoleIds,
    shouldAnnounceLive,
    twitchLoginOfCreator,
    type LiveStream,
} from "@/lib/live-notify";

const NOW = new Date("2026-11-02T20:00:00.000Z");

function stream(overrides: Partial<LiveStream> = {}): LiveStream {
    return {
        id: "stream-1",
        login: "huzounet",
        displayName: "Huzounet",
        title: "Run Dofus",
        gameName: "Dofus",
        viewers: 1234,
        startedAt: new Date(NOW.getTime() - 10 * 60_000),
        thumbnailUrl: "https://static-cdn.jtvnw.net/previews/x.jpg",
        avatarUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/huzounet.png",
        ...overrides,
    };
}

describe("normalisation du login Twitch", () => {
    it("accepte un login brut, un @login et une URL de chaîne", () => {
        expect(normalizeTwitchLogin("Huzounet")).toBe("huzounet");
        expect(normalizeTwitchLogin("@huzounet")).toBe("huzounet");
        expect(normalizeTwitchLogin("https://www.twitch.tv/huzounet")).toBe("huzounet");
        expect(normalizeTwitchLogin("  https://twitch.tv/Huzounet?x=1 ")).toBe("huzounet");
    });

    it("ne garde rien d'autre que [a-z0-9_] et renvoie une chaîne vide si absent", () => {
        expect(normalizeTwitchLogin("hu zou-net!")).toBe("huzounet");
        expect(normalizeTwitchLogin(null)).toBe("");
        expect(normalizeTwitchLogin(undefined)).toBe("");
    });

    it("le handle God prime, la colonne `twitch` est un repli", () => {
        expect(twitchLoginOfCreator({ handle: "huzounet", twitch: "https://twitch.tv/autre" })).toBe("huzounet");
        expect(twitchLoginOfCreator({ handle: null, twitch: "https://www.twitch.tv/skyziotv" })).toBe("skyziotv");
        expect(twitchLoginOfCreator({ handle: "", twitch: null })).toBe("");
    });
});

describe("une annonce par session de stream", () => {
    it("la clé mêle la guilde et l'identifiant de session — jamais le nom du streamer", () => {
        expect(liveDedupKey("guild-a", "stream-1")).toBe("live:notified:guild-a:stream-1");
        expect(liveDedupKey("guild-a", "stream-2")).not.toBe(liveDedupKey("guild-a", "stream-1"));
        expect(LIVE_DEDUP_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
        expect(liveAvatarKey("@Huzounet")).toBe("live:avatar:huzounet");
    });

    it("annonce un live récent, jamais deux fois le même", () => {
        expect(
            shouldAnnounceLive({ channelId: "123456789012345678", alreadyNotified: false, startedAt: NOW, now: NOW })
                .announce,
        ).toBe(true);

        expect(
            shouldAnnounceLive({ channelId: "123456789012345678", alreadyNotified: true, startedAt: NOW, now: NOW }),
        ).toEqual({ announce: false, reason: "already_notified" });
    });

    it("refuse sans salon, ou si le live est trop vieux (2 h)", () => {
        expect(shouldAnnounceLive({ channelId: null, alreadyNotified: false, startedAt: NOW, now: NOW })).toEqual({
            announce: false,
            reason: "no_channel",
        });

        const vieux = new Date(NOW.getTime() - LIVE_NOTIFY_MAX_START_AGE_MS - 60_000);
        expect(
            shouldAnnounceLive({ channelId: "123456789012345678", alreadyNotified: false, startedAt: vieux, now: NOW }),
        ).toEqual({ announce: false, reason: "too_old" });

        const limite = new Date(NOW.getTime() - LIVE_NOTIFY_MAX_START_AGE_MS + 60_000);
        expect(
            shouldAnnounceLive({ channelId: "123456789012345678", alreadyNotified: false, startedAt: limite, now: NOW })
                .announce,
        ).toBe(true);
    });

    it("interrupteur coupé ⇒ refus, même avec un salon", () => {
        expect(
            shouldAnnounceLive({
                channelId: "123456789012345678",
                enabled: false,
                alreadyNotified: false,
                startedAt: NOW,
                now: NOW,
            }),
        ).toEqual({ announce: false, reason: "disabled" });

        expect(
            shouldAnnounceLive({
                channelId: null,
                enabled: false,
                alreadyNotified: false,
                startedAt: NOW,
                now: NOW,
            }),
        ).toEqual({ announce: false, reason: "disabled" });
    });

    it("une date illisible ne notifie jamais", () => {
        expect(
            shouldAnnounceLive({
                channelId: "123456789012345678",
                alreadyNotified: false,
                startedAt: "pas une date",
                now: NOW,
            }),
        ).toEqual({ announce: false, reason: "invalid_start" });
    });
});

describe("ping : choisi, borné, jamais @everyone", () => {
    it("liste vide ⇒ aucun ping", () => {
        expect(sanitizePingRoleIds([])).toEqual([]);
        expect(livePingContent([])).toBeUndefined();
        expect(livePingContent(null)).toBeUndefined();
    });

    it("ne garde que des snowflakes, dédupliqués et bornés", () => {
        const ids = ["123456789012345678", "123456789012345678", "pas-un-id", "0", "987654321098765432"];
        expect(sanitizePingRoleIds(ids)).toEqual(["123456789012345678", "987654321098765432"]);
        expect(sanitizePingRoleIds(Array(10).fill("123456789012345678"))).toHaveLength(1);
        expect(LIVE_MAX_PING_ROLES).toBe(5);
    });

    it("produit une mention de rôle Discord", () => {
        expect(livePingContent(["123456789012345678"])).toBe("<@&123456789012345678>");
    });

    it("aucune saisie ne peut produire @everyone", () => {
        expect(sanitizeEmbedText("@everyone @here <@&123456789012345678>")).toBe("");
    });
});

describe("embed d'annonce", () => {
    it("porte la marque, le lien et l'avatar du streamer", () => {
        const payload = buildLiveAnnouncement(stream(), { now: NOW });

        expect(payload.embedTitle).toBe("🔴 Huzounet est en live");
        expect(payload.embedColor).toBe(TWITCH_EMBED_COLOR);
        expect(payload.embedUrl).toBe("https://www.twitch.tv/huzounet");
        expect(payload.embedAuthor.iconUrl).toBe(stream().avatarUrl);
        expect(payload.embedImage).toBe(stream().thumbnailUrl);
        expect(payload.mentionContent).toBeUndefined();
    });

    it("ajoute le ping seulement si un rôle est choisi", () => {
        const payload = buildLiveAnnouncement(stream(), { now: NOW, pingRoleIds: ["123456789012345678"] });
        expect(payload.mentionContent).toBe("<@&123456789012345678>");
    });

    it("assainit un titre hostile et borne la description", () => {
        const payload = buildLiveAnnouncement(stream({ displayName: "@everyone", title: "x".repeat(400) }), {
            now: NOW,
        });
        expect(payload.embedTitle).not.toContain("@everyone");
        expect(payload.embedDescription.length).toBe(300);
    });

    it("formate les spectateurs et la durée en français", () => {
        // `fr-FR` utilise une espace fine insécable (U+202F) comme séparateur de milliers.
        expect(formatViewerCount(1234).replace(/\s/g, " ")).toBe("1 234");
        expect(formatViewerCount(Number.NaN)).toBe("0");
        expect(formatLiveDuration(new Date(NOW.getTime() - 12 * 60_000), NOW)).toBe("12 min");
        expect(formatLiveDuration(new Date(NOW.getTime() - 185 * 60_000), NOW)).toBe("3 h 05");
    });
});
