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
        // 1. Direct regex for full URLs (handling public, private, or direct)
        const fullUrlMatch = url.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
        if (fullUrlMatch) return fullUrlMatch[1];

        // 2. Short URL resolution
        if (url.includes("d-bk.net")) {
            const response = await fetch(url, {
                method: "HEAD",
                redirect: "follow",
                headers: {
                    "User-Agent": "SigilOS-Bot/1.0 (+https://sigilos.fr)"
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

        // 2. Fetch from API
        // Simplified headers to match working curl test
        const response = await fetch(`${DOFUSBOOK_API}${id}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Referer": "https://www.dofusbook.net/"
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            console.error(`[Dofusbook] API Error ${response.status} for build ${id}`);
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
