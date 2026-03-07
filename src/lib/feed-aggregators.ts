import Parser from 'rss-parser';

export interface ExtractedContent {
    type: "NEWS" | "TWITCH" | "YOUTUBE";
    creatorId: string;
    title: string;
    url: string;
    thumbnail: string | null;
    published: Date;
    description?: string;
}

// ─── UTILS: PROXY FETCH ───────────────────────────────────────────
const PROXY_LIST = [
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function fetchWithProxyFallback(url: string): Promise<string | null> {
    // 1. Direct fetch attempt
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
            next: { revalidate: 900 }
        });
        if (res.ok) {
            const text = await res.text();
            if (text.length > 500) return text;
        }
    } catch (e) {
        console.warn(`[feed-aggregator] Direct fetch failed for ${url}, trying proxies...`);
    }

    // 2. Proxy attempts
    for (const proxyFn of PROXY_LIST) {
        try {
            const proxyUrl = proxyFn(url);
            const res = await fetch(proxyUrl, { cache: 'no-store' });
            if (!res.ok) continue;

            if (proxyUrl.includes('allorigins')) {
                const json = await res.json();
                if (json.contents) return json.contents;
            } else {
                return await res.text();
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

// ─── DOFUS RSS FEED ──────────────────────────────────────────────
export async function fetchDofusNews(): Promise<ExtractedContent[]> {
    try {
        const url = 'https://www.dofus.com/fr/rss/news.xml';
        const xml = await fetchWithProxyFallback(url);

        if (!xml) throw new Error("Could not fetch RSS feed (Direct & Proxy failed)");

        const parser = new Parser();
        const feed = await parser.parseString(xml);

        return feed.items.slice(0, 5).map(item => ({
            type: "NEWS",
            creatorId: "Ankama",
            title: item.title || "Nouvelle annonce Dofus",
            url: item.link || "https://www.dofus.com/fr",
            thumbnail: null,
            published: item.isoDate ? new Date(item.isoDate) : new Date()
        }));
    } catch (e) {
        console.error("Failed to fetch Dofus RSS", e);
        return [];
    }
}

// ─── DOFUS POUR LES NOOBS HOMEPAGE SCRAPER ────────────────────────
export async function fetchDPLNNews(): Promise<ExtractedContent[]> {
    try {
        const baseUrl = 'https://www.dofuspourlesnoobs.com';
        const html = await fetchWithProxyFallback(baseUrl);

        if (!html) throw new Error(`Could not fetch DPLN (Direct & Proxy failed)`);


        // More robust approach: Find all news boxes or h3 headings and extract links
        const items: ExtractedContent[] = [];
        const now = new Date();

        // 1. First attempt: Look for .h-news-box containers (the main news)
        const newsBoxRegex = /<div class="h-news-box">([\s\S]*?)<\/div>/g;
        let boxMatch;
        let count = 0;

        while ((boxMatch = newsBoxRegex.exec(html)) !== null && count < 8) {
            const content = boxMatch[1];

            // Extract Title: <h3>Title</h3>
            const titleMatch = content.match(/<h3>(.*?)<\/h3>/);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : "";
            if (!title) continue;

            // Extract Link: search for the first href
            const linkMatch = content.match(/<a\s+href="([^"]+)"/);
            let url = linkMatch ? linkMatch[1] : baseUrl;
            if (url.startsWith('/')) url = baseUrl + url;

            // Extract Image: <img src="...">
            const imgMatch = content.match(/<img\s+src="([^"]+)"/);
            let thumbnail = imgMatch ? imgMatch[1] : null;
            if (thumbnail && thumbnail.startsWith('/')) thumbnail = baseUrl + thumbnail;

            // Extract Description: <p>...</p>
            const descMatch = content.match(/<p>(.*?)<\/p>/);
            const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : "";

            items.push({
                type: "NEWS",
                creatorId: "DPLN",
                title,
                url,
                thumbnail,
                description,
                published: new Date(now.getTime() - count * 60000)
            });
            count++;
        }

        // 2. Fallback: If no boxes found, look for list links <li><a...>...</a></li>
        if (items.length === 0) {
            const listRegex = /<li><a\s+href="([^"]+)"[^>]*>(.*?)<\/a><\/li>/g;
            let listMatch;
            while ((listMatch = listRegex.exec(html)) !== null && count < 10) {
                let url = listMatch[1];
                if (url.startsWith('/')) url = baseUrl + url;
                const title = listMatch[2].replace(/<[^>]+>/g, '').trim();

                if (title && !title.includes('Mise à jour')) {
                    items.push({
                        type: "NEWS",
                        creatorId: "DPLN",
                        title,
                        url,
                        thumbnail: null,
                        published: new Date(now.getTime() - count * 60000)
                    });
                    count++;
                }
            }
        }

        return items;
    } catch (e) {
        console.error("Failed to scrape DPLN homepage", e);
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
