"use server";

import redis from "@/lib/redis";
import { z } from "zod";

import { processDofusbookRawData, type DofusbookPreviewData, type DofusbookItem } from "@/lib/dofusbook-utils";

const DOFUSBOOK_API = "https://www.dofusbook.net/api/stuffs/dofus/public/";
const CACHE_TTL = 3600 * 24; // 24 hours

/**
 * Extracts the numerical ID from a Dofusbook URL.
 * Supports both full and short URLs (by following redirects).
 */
export async function getDofusbookId(url: string): Promise<string | null> {
    try {
        // 1. Direct regex for full URLs - handles IDs followed by slugs: 16093854-sram-air...
        const fullUrlMatch = url.match(/(?:equipement|dofus)\/(?:[a-z]+\/)?(?:private\/)?(\d+)/i);
        if (fullUrlMatch) return fullUrlMatch[1];

        // 2. Short URL resolution (d-bk.net)
        if (url.includes("d-bk.net")) {
            const response = await fetch(url, {
                method: "GET", 
                redirect: "follow",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                }
            });
            const finalUrl = response.url;
            const finalMatch = finalUrl.match(/equipement\/(\d+)/);
            return finalMatch ? finalMatch[1] : null;
        }

        return null;
    } catch (e) {
        console.error("[Dofusbook] ID extraction failed:", e);
        return null;
    }
}

/**
 * Fetches preview data from Dofusbook API with Redis caching.
 */
export async function getDofusbookPreview(url: string): Promise<{ success: boolean; data?: DofusbookPreviewData; error?: string; id?: string }> {
    const id = await getDofusbookId(url);
    if (!id) return { success: false, error: "Identifiant Dofusbook introuvable" };

    const cacheKey = `sigilos:dofusbook:v5:${id}`;
    const token = `sigilos:db:lock:${id}`;

    try {
        // 1. Check Cache
        if (redis && redis.status === "ready") {
            const cached = await redis.get(cacheKey);
            if (cached) return { success: true, data: JSON.parse(cached), id };
        }

        // 2. Fetch from API with Browser-Authentic Headers
        const headers: Record<string, string> = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://www.dofusbook.net/fr/equipement/",
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        };
        const response = await fetch(`${DOFUSBOOK_API}${id}`, {
            headers,
            cache: 'no-store'
        });

        if (!response.ok) {
            console.error(`[Dofusbook] API Error ${response.status} for build ${id}.`);
            
            // 🚀 FALLBACK: If API is 403 (Cloudflare Block), try to scrape the HTML page
            // Cloudflare is often less aggressive on the main page than the API endpoint.
            if (response.status === 403) {
                console.log(`[Dofusbook] API Blocked (403), attempting HTML scraping fallback for build ${id}...`);
                try {
                    const htmlResponse = await fetch(`https://www.dofusbook.net/fr/equipement/${id}`, {
                        headers: {
                            ...headers,
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                        },
                        cache: 'no-store'
                    });

                    if (htmlResponse.ok) {
                        const html = await htmlResponse.text();
                        const { load } = await import('cheerio');
                        const $ = load(html);
                        
                        // Look for the script containing the build data
                        // It's usually in a script tag that contains "initialStuff"
                        let scrapedData: any = null;
                        
                        $('script').each((_, el) => {
                            const content = $(el).html() || '';
                            if (content.includes('initialStuff')) {
                                try {
                                    // Extract the JSON blob
                                    const match = content.match(/initialStuff\s*=\s*({.*?});/s);
                                    if (match) {
                                        scrapedData = JSON.parse(match[1]);
                                        return false; // break loop
                                    }
                                } catch (e) {
                                    console.error("[Dofusbook] Failed to parse scraped JSON:", e);
                                }
                            }
                        });

                        if (scrapedData) {
                            console.log(`[Dofusbook] Successfully scraped data from HTML for build ${id}`);
                            const data = processDofusbookRawData(id, scrapedData);
                            
                            // Store in Cache
                            if (redis && redis.status === "ready") {
                                await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL);
                            }
                            return { success: true, data, id };
                        }
                    }
                } catch (scrapeError) {
                    console.error("[Dofusbook] Scraping fallback failed:", scrapeError);
                }
                
                return { success: false, error: "Dofusbook bloque votre serveur (403). Même le scraping a échoué.", id };
            }

            if (response.status === 404) return { success: false, error: "Stuff introuvable", id };
            return { success: false, error: "Erreur API Dofusbook (" + response.status + ")", id };
        }

        const raw = await response.json();
        const data = processDofusbookRawData(id, raw);

        // 3. Store in Cache (Only if we have some data)
        if (redis && redis.status === "ready") {
            await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL);
        }

        return { success: true, data, id };
    } catch (error) {
        console.error("[Dofusbook] Preview error:", error);
        return { success: false, error: "Erreur lors de la récupération du build", id };
    }
}
