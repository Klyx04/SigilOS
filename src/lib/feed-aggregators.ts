import Parser from 'rss-parser';

export interface ExtractedContent {
    type: "NEWS" | "TWITCH" | "YOUTUBE";
    creatorId: string;
    title: string;
    url: string;
    thumbnail: string | null;
    published: Date;
}

// ─── DOFUS RSS FEED ──────────────────────────────────────────────
export async function fetchDofusNews(): Promise<ExtractedContent[]> {
    try {
        const parser = new Parser({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        // Optionnel : l'URL officielle (on vérifie fr)
        const feed = await parser.parseURL('https://www.dofus.com/fr/rss/news.xml');

        return feed.items.slice(0, 5).map(item => ({
            type: "NEWS",
            creatorId: "Ankama",
            title: item.title || "Nouvelle annonce Dofus",
            url: item.link || "https://www.dofus.com/fr",
            thumbnail: null, // trigger default Rss icon fallback
            published: item.isoDate ? new Date(item.isoDate) : new Date()
        }));
    } catch (e) {
        console.error("Failed to fetch Dofus RSS", e);
        return [];
    }
}

// ─── TWITCH API ──────────────────────────────────────────────────
export async function fetchTwitchLiveStreams(twitchUsernames: string[]): Promise<ExtractedContent[]> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret || twitchUsernames.length === 0) {
        return []; // Missing keys or users
    }

    try {
        // 1. Get Access Token
        const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
            method: 'POST'
        });
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;
        if (!accessToken) return [];

        // 2. Fetch Streams
        const userQuery = twitchUsernames.map(u => `user_login=${u.toLowerCase()}`).join('&');
        const streamsRes = await fetch(`https://api.twitch.tv/helix/streams?${userQuery}`, {
            headers: {
                'Client-Id': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const streamsData = await streamsRes.json();

        const liveStreams: ExtractedContent[] = (streamsData.data || []).map((stream: any) => ({
            type: "TWITCH",
            creatorId: stream.user_name,
            title: stream.title,
            url: `https://www.twitch.tv/${stream.user_login}`,
            thumbnail: stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180'),
            published: new Date(stream.started_at)
        }));

        return liveStreams;

    } catch (e) {
        console.error("Failed to fetch Twitch streams", e);
        return [];
    }
}

// ─── YOUTUBE API ─────────────────────────────────────────────────
export async function fetchYouTubeLatestVideos(youtubeHandles: string[]): Promise<ExtractedContent[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey || youtubeHandles.length === 0) return [];

    try {
        // Unfortunately YouTube API v3 search has a high quota cost (100 units). 
        // A smarter way for minimal quota is fetching the channel's uploads playlist 
        // OR using the undocumented RSS feed but it doesn't support handles directly easily.
        // We will use standard Search API for this example, limiting queries.

        const videos: ExtractedContent[] = [];

        for (const handle of youtubeHandles) {
            // Find channel by @handle
            const searchRes = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&q=${handle}&type=channel&key=${apiKey}`);
            const searchData = await searchRes.json();
            const channelId = searchData.items?.[0]?.snippet?.channelId;

            if (!channelId) continue;

            // Fetch latest video
            const vidRes = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=1&order=date&type=video&key=${apiKey}`);
            const vidData = await vidRes.json();
            const video = vidData.items?.[0];

            if (video) {
                videos.push({
                    type: "YOUTUBE",
                    creatorId: handle.replace('@', ''),
                    title: video.snippet.title,
                    url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                    thumbnail: video.snippet.thumbnails?.medium?.url || null,
                    published: new Date(video.snippet.publishedAt)
                });
            }
        }

        return videos;

    } catch (e) {
        console.error("Failed to fetch YouTube videos", e);
        return [];
    }
}
