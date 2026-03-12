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


async function fetchWithProxyFallback(url: string): Promise<string | null> {
    // 1. Direct fetch attempt
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Accept': 'application/rss+xml, text/xml' },
            next: { revalidate: 900 }
        });
        if (res.ok) {
            const text = await res.text();
            if (text.length > 500) return text;
        }
    } catch (e) {
        console.warn(`[feed-aggregator] Direct fetch failed for ${url}, trying Curl...`);
    }

    // 2. Curl attempt (Linux/Docker fallback)
    try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);
        const { stdout } = await execAsync(`curl -L "${url}" -A "Mozilla/5.0" --max-time 15 --compressed`);
        if (stdout && stdout.length > 500) return stdout;
    } catch (e) {
        console.warn(`[feed-aggregator] Curl failed for ${url}, trying proxies...`);
    }

    // 3. Proxy attempts
    const proxies = [
        (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
        (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
        (u: string) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`
    ];

    for (const proxyFn of proxies) {
        try {
            const proxyUrl = proxyFn(url);
            const res = await fetch(proxyUrl, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (!res.ok) continue;

            if (proxyUrl.includes('allorigins')) {
                const json = await res.json();
                if (json.contents) return json.contents;
            } else {
                const text = await res.text();
                if (text.length > 500) return text;
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
        const url = 'https://haapi.ankama.com/json/Ankama/v5/Cms/Items/Get?site=DOFUS&lang=fr&template_key=NEWS';
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 900 }
        });

        if (!res.ok) throw new Error("Could not fetch Dofus Haapi API: " + res.status);

        const items: any[] = await res.json();

        const feedItems = items.slice(0, 6).map((item, idx) => {
            const descriptionHtml = item.baseline || "";
            const plainDescription = descriptionHtml.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ").trim();

            let thumbnail = item.image_url || item.image || item.picture || null;
            if (thumbnail && typeof thumbnail === 'string') {
                if (thumbnail.startsWith('http')) {
                    // Nothing to do, already absolute
                } else if (thumbnail.startsWith('//')) {
                    thumbnail = 'https:' + thumbnail;
                } else if (thumbnail.startsWith('/')) {
                    thumbnail = 'https://static.ankama.com' + thumbnail;
                } else {
                    // Maybe just a path?
                    thumbnail = 'https://static.ankama.com/' + thumbnail;
                }
            }

            // Cleanup potential double slashes (except after protocol)
            if (thumbnail && typeof thumbnail === 'string') {
                const parts = thumbnail.split('://');
                if (parts.length > 1) {
                    thumbnail = parts[0] + '://' + parts[1].replace(/\/+/g, '/');
                } else {
                    thumbnail = thumbnail.replace(/\/+/g, '/');
                }
            }

            return {
                type: "NEWS" as const,
                creatorId: "Ankama",
                title: item.name || "Nouvelle annonce Dofus",
                url: item.url || "https://www.dofus.com/fr",
                thumbnail: thumbnail as string | null,
                description: plainDescription || undefined,
                published: new Date(Date.now() - idx * 60000) // pseudo-chronological
            };
        });

        return feedItems;
    } catch (e) {
        console.error("Failed to fetch Dofus Haapi API", e);
        return [];
    }
}

export async function fetchDofusChangelogs(): Promise<ExtractedContent[]> {
    try {
        const url = 'https://haapi.ankama.com/json/Ankama/v5/Cms/Items/Get?site=DOFUS&lang=fr&template_key=CHANGELOG';
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 3600 } // Changelogs are less frequent
        });

        if (!res.ok) throw new Error("Could not fetch Dofus Changelog Haapi API: " + res.status);

        const items: any[] = await res.json();

        // Fallback image strategy: find the first non-null image in the list to use as a default for patch notes
        let commonImage = items.find(i => i.image_url)?.image_url || null;
        if (!commonImage) {
            // Very last fallback: generic dofus news image
            commonImage = "https://static.ankama.com/ankama/cms/images/282/2026/01/21/1765851.jpg"; 
        }

        return items.slice(0, 10).map((item, idx) => {
            const descriptionHtml = item.baseline || "";
            const plainDescription = descriptionHtml.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ").trim();

            let thumbnail = item.image_url || item.image || item.picture || commonImage;
            if (thumbnail && typeof thumbnail === 'string') {
                if (!thumbnail.startsWith('http')) {
                    if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
                    else if (thumbnail.startsWith('/')) thumbnail = 'https://static.ankama.com' + thumbnail;
                    else thumbnail = 'https://static.ankama.com/' + thumbnail;
                }
            }

            // Try to find a real date, otherwise use pseudo-chronological
            const pubDateStr = item.date_publication || item.publication_date || item.created_at || item.date;
            const published = pubDateStr ? new Date(pubDateStr) : new Date(Date.now() - idx * 86400000);

            return {
                type: "NEWS" as const,
                creatorId: "Ankama",
                title: item.name || "Patch Notes Dofus",
                url: item.url || "https://www.dofus.com/fr/mmorpg/actualites/maj/correctifs",
                thumbnail: thumbnail as string | null,
                description: plainDescription || undefined,
                published,
            };
        });
    } catch (e) {
        console.error("Failed to fetch Dofus Changelog Haapi API", e);
        return [];
    }
}

// ─── DOFUS POUR LES NOOBS HOMEPAGE SCRAPER ────────────────────────
export async function fetchDPLNNews(): Promise<ExtractedContent[]> {
    try {
        const baseUrl = 'https://www.dofuspourlesnoobs.com';
        const html = await fetchWithProxyFallback(baseUrl);

        if (!html) throw new Error(`Could not fetch DPLN (Direct & Proxy failed)`);


        const items: ExtractedContent[] = [];
        const now = new Date();

        // 1. New Approach: Find article sliders/images which wrap image + text in a single <a> tag
        const aRegex = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let aMatch;
        let count = 0;

        while ((aMatch = aRegex.exec(html)) !== null && count < 8) {
            const path = aMatch[1];
            const innerHtml = aMatch[2];

            // Ignore standard navigation/social
            if (path.startsWith('http') && !path.includes('dofuspourlesnoobs')) continue;
            if (path === '/' || path.includes('#') || path.includes('mailto')) continue;

            // Check for image inside the link
            const imgMatch = innerHtml.match(/<img[^>]+src="([^"]+)"/i);
            if (!imgMatch) continue;

            const imgUrl = imgMatch[1];
            // Ignore generic UI icons
            if (imgUrl.includes('logo') || imgUrl.includes('spacer') || imgUrl.includes('icon')) continue;

            // Extract text from HTML, removing all tags
            let fullText = innerHtml.replace(/<[^>]+>/g, '').trim();
            if (!fullText) {
                const altMatch = innerHtml.match(/<img[^>]+alt="([^"]+)"/i);
                if (altMatch) fullText = altMatch[1];
            }

            if (fullText && fullText.length > 5 && imgUrl) {
                let url = path;
                if (url.startsWith('/')) url = baseUrl + url;

                let thumbnail = imgUrl;
                if (thumbnail.startsWith('/')) thumbnail = baseUrl + thumbnail;

                // Avoid duplicates
                if (!items.find(i => i.url === url)) {
                    // Split title from potential description block
                    const textParts = fullText.split('\n').map(p => p.trim()).filter(Boolean);
                    const title = textParts[0];
                    const description = textParts.slice(1).join(' ') || undefined;

                    items.push({
                        type: "NEWS" as const,
                        creatorId: "DPLN",
                        title,
                        url,
                        thumbnail,
                        description,
                        published: new Date(now.getTime() - count * 60000)
                    });
                    count++;
                }
            }
        }

        // 2. Fallback: Standard Weebly lists (for when sliders break entirely)
        if (items.length === 0) {
            const listRegex = /<li><a\s+href="([^"]+)"[^>]*>(.*?)<\/a><\/li>/g;
            let listMatch;
            while ((listMatch = listRegex.exec(html)) !== null && count < 10) {
                let url = listMatch[1];
                if (url.startsWith('/')) url = baseUrl + url;
                const title = listMatch[2].replace(/<[^>]+>/g, '').trim();

                if (title && !title.includes('Mise à jour')) {
                    items.push({
                        type: "NEWS" as const,
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
