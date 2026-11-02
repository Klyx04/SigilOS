/**
 * Nouvelle vidéo YouTube — **règles pures** (`src/lib/youtube-watch.ts`).
 *
 * Ce que ce verrou protège :
 * 1. le parseur du **flux RSS** (gratuit) : entités décodées, entrée incomplète ignorée, bornes ;
 * 2. **une annonce par vidéo** (clé par `videoId`), garde d'âge 24 h, interrupteur de guilde ;
 * 3. l'embed : marque YouTube, **spécialité** (donnée SigilOS), date lisible, ping optionnel.
 */
import { describe, expect, it } from "vitest";
import {
    YOUTUBE_DEDUP_TTL_SECONDS,
    YOUTUBE_EMBED_COLOR,
    YOUTUBE_MAX_VIDEO_AGE_MS,
    buildYouTubeAnnouncement,
    formatPublishedAt,
    parseYouTubeFeed,
    shouldAnnounceVideo,
    youtubeChannelKey,
    youtubeDedupKey,
} from "@/lib/youtube-watch";

const NOW = new Date("2026-11-02T20:00:00.000Z");

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <id>yt:video:abc123DEF45</id>
    <yt:videoId>abc123DEF45</yt:videoId>
    <title>SRAM MODE MULTI &amp; CHIMIQUE</title>
    <published>2026-11-02T13:09:00+00:00</published>
    <media:group>
      <media:title>SRAM</media:title>
      <media:thumbnail url="https://i1.ytimg.com/vi/abc123DEF45/hqdefault.jpg" width="480" height="360"/>
    </media:group>
  </entry>
  <entry>
    <id>yt:video:zzz999ZZZ99</id>
    <yt:videoId>zzz999ZZZ99</yt:videoId>
    <title>Ancienne vid&#39;eo</title>
    <published>2026-10-30T10:00:00+00:00</published>
  </entry>
  <entry>
    <title>Entrée sans identifiant</title>
    <published>pas une date</published>
  </entry>
</feed>`;

describe("parseYouTubeFeed", () => {
    it("lit les entrées valides, décode les entités et garde l'ordre du flux", () => {
        const videos = parseYouTubeFeed(FEED);

        expect(videos).toHaveLength(2);
        expect(videos[0]).toMatchObject({
            videoId: "abc123DEF45",
            title: "SRAM MODE MULTI & CHIMIQUE",
            url: "https://www.youtube.com/watch?v=abc123DEF45",
            thumbnailUrl: "https://i1.ytimg.com/vi/abc123DEF45/hqdefault.jpg",
        });
        expect(videos[0].publishedAt.toISOString()).toBe("2026-11-02T13:09:00.000Z");
        expect(videos[1].title).toBe("Ancienne vid'eo");
    });

    it("ignore une entrée incomplète plutôt que de la deviner", () => {
        const videos = parseYouTubeFeed(FEED);
        expect(videos.some((video) => video.title === "Entrée sans identifiant")).toBe(false);
    });

    it("un flux vide ou illisible ne rend rien", () => {
        expect(parseYouTubeFeed("")).toEqual([]);
        expect(parseYouTubeFeed("<feed></feed>")).toEqual([]);
        expect(parseYouTubeFeed(null as unknown as string)).toEqual([]);
    });
});

describe("une annonce par vidéo", () => {
    it("la clé mêle la guilde et l'identifiant de vidéo", () => {
        expect(youtubeDedupKey("guild-a", "abc123DEF45")).toBe("yt:notified:guild-a:abc123DEF45");
        expect(YOUTUBE_DEDUP_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
        expect(youtubeChannelKey("@Huzounet")).toBe("yt:channel:huzounet");
    });

    it("annonce une vidéo fraîche, refuse une vidéo déjà annoncée", () => {
        const published = new Date(NOW.getTime() - 60 * 60_000);
        expect(
            shouldAnnounceVideo({ channelId: "123456789012345678", alreadyNotified: false, publishedAt: published, now: NOW })
                .announce,
        ).toBe(true);

        expect(
            shouldAnnounceVideo({ channelId: "123456789012345678", alreadyNotified: true, publishedAt: published, now: NOW }),
        ).toEqual({ announce: false, reason: "already_notified" });
    });

    it("refuse sans salon, si la guilde a coupé YouTube, ou au-delà de 24 h", () => {
        const published = new Date(NOW.getTime() - 60 * 60_000);
        expect(shouldAnnounceVideo({ channelId: null, alreadyNotified: false, publishedAt: published, now: NOW })).toEqual({
            announce: false,
            reason: "no_channel",
        });
        expect(
            shouldAnnounceVideo({
                channelId: "123456789012345678",
                enabled: false,
                alreadyNotified: false,
                publishedAt: published,
                now: NOW,
            }),
        ).toEqual({ announce: false, reason: "disabled" });

        const vieille = new Date(NOW.getTime() - YOUTUBE_MAX_VIDEO_AGE_MS - 60_000);
        expect(
            shouldAnnounceVideo({ channelId: "123456789012345678", alreadyNotified: false, publishedAt: vieille, now: NOW }),
        ).toEqual({ announce: false, reason: "too_old" });
    });

    it("une date illisible ne notifie jamais", () => {
        expect(
            shouldAnnounceVideo({ channelId: "123456789012345678", alreadyNotified: false, publishedAt: "nope", now: NOW }),
        ).toEqual({ announce: false, reason: "invalid_date" });
    });
});

describe("embed de vidéo", () => {
    const video = {
        videoId: "abc123DEF45",
        title: "SRAM MODE MULTI & CHIMIQUE",
        url: "https://www.youtube.com/watch?v=abc123DEF45",
        publishedAt: new Date("2026-11-02T13:09:00.000Z"),
        thumbnailUrl: "https://i1.ytimg.com/vi/abc123DEF45/hqdefault.jpg",
    };

    it("porte la marque, la spécialité SigilOS et la miniature", () => {
        const payload = buildYouTubeAnnouncement(
            video,
            { displayName: "Huzounet", role: "Forgemagie & Économie", avatarUrl: "https://yt/avatar.png" },
            { now: NOW },
        );

        expect(payload.embedTitle).toContain("SRAM MODE MULTI & CHIMIQUE");
        expect(payload.embedColor).toBe(YOUTUBE_EMBED_COLOR);
        expect(payload.embedUrl).toBe(video.url);
        expect(payload.embedAuthor.name).toBe("Huzounet · YouTube");
        expect(payload.embedAuthor.iconUrl).toBe("https://yt/avatar.png");
        expect(payload.embedImage).toBe(video.thumbnailUrl);
        expect(payload.fields[0]).toEqual({ name: "🎯 Spécialité", value: "Forgemagie & Économie", inline: true });
        expect(payload.mentionContent).toBeUndefined();
    });

    it("ping seulement si un rôle valide est configuré, jamais @everyone", () => {
        const payload = buildYouTubeAnnouncement(
            video,
            { displayName: "Huzounet", role: null },
            { now: NOW, pingRoleIds: ["123456789012345678", "@everyone"] as unknown as string[] },
        );
        expect(payload.mentionContent).toBe("<@&123456789012345678>");
        expect(payload.fields[0].value).toBe("Non renseignée");
    });

    it("la date est lisible (fr-FR)", () => {
        expect(formatPublishedAt(video.publishedAt)).toMatch(/^\d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}$/);
    });
});
