/**
 * Script de pre-chauffe du cache Dofusbook.
 * Usage: node scripts/warm-dofusbook-cache.mjs
 * Lit tous les dofusBookLinks de la DB et appelle le proxy pour chaque build non caché.
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";

const db = new PrismaClient();
const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

function extractBuildId(url) {
    const m = url.match(/(?:equipement\/(?:[a-z]+\/)?(\d+)|d-bk\.net\/(?:fr\/)?d\/([a-zA-Z0-9]+))/i);
    return m ? (m[1] || m[2]) : null;
}

async function resolveBuildId(id) {
    if (/^\d+$/.test(id)) return id;
    // Resolve short URL
    try {
        const res = await fetch(`https://d-bk.net/fr/d/${id}`, { method: "HEAD", redirect: "manual", headers: { "User-Agent": randomUA() } });
        const loc = res.headers.get("location");
        if (loc) {
            const m = loc.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
            if (m) return m[1];
        }
    } catch {}
    return id;
}

async function fetchAndCache(buildId, redis) {
    const cacheKey = `dofusbook:build:${buildId}`;
    const staleKey = `dofusbook:stale:${buildId}`;

    // Already cached?
    const exists = await redis.exists(cacheKey);
    if (exists) {
        console.log(`  [HIT] ${buildId} — already cached`);
        return "HIT";
    }

    const finalId = await resolveBuildId(buildId);
    const apiUrl = `https://www.dofusbook.net/api/stuffs/dofus/public/${finalId}`;

    const res = await fetch(apiUrl, {
        headers: {
            "User-Agent": randomUA(),
            "Referer": "https://www.dofusbook.net/fr/personnage/equipements",
            "Origin": "https://www.dofusbook.net",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "fr-FR,fr;q=0.9",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        }
    });

    if (!res.ok) {
        console.warn(`  [${res.status}] ${buildId} — API error`);
        return res.status;
    }

    const data = await res.json();
    const serialized = JSON.stringify(data);
    await Promise.all([
        redis.setEx(cacheKey, 86400, serialized),
        redis.setEx(staleKey, 86400 * 7, serialized)
    ]);

    console.log(`  [CACHED] ${buildId} ${data.name || ""} Lvl${data.stuff?.level || "?"}`);
    return "CACHED";
}

async function main() {
    const redis = createClient({ url: REDIS_URL });
    await redis.connect();
    console.log("[Warm] Redis connected");

    const profiles = await db.userProfile.findMany({
        where: { status: "ACTIVE" },
        select: { dofusBookLinks: true, pseudoDofus: true }
    });

    const allIds = new Set();
    profiles.forEach(p => {
        (p.dofusBookLinks || []).forEach(link => {
            if (link?.url) {
                const id = extractBuildId(link.url);
                if (id) allIds.add(id);
            }
        });
    });

    console.log(`[Warm] Found ${allIds.size} unique builds to check`);

    let warmed = 0, hits = 0, errors = 0;
    for (const id of allIds) {
        const result = await fetchAndCache(id, redis);
        if (result === "HIT") hits++;
        else if (result === "CACHED") warmed++;
        else errors++;

        // Throttle: 600ms between requests
        if (result !== "HIT") {
            await new Promise(r => setTimeout(r, 600));
        }
    }

    console.log(`\n[Warm] Done: ${warmed} warmed, ${hits} cached hits, ${errors} errors`);
    await redis.disconnect();
    await db.$disconnect();
}

main().catch(console.error);
