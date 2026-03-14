/**
 * Script de pre-chauffe du cache Dofusbook via l'API interne.
 * Usage: node --env-file=.env scripts/warm-dofusbook-cache.cjs
 *
 * Lit les URLs depuis la DB via une connexion PostgreSQL directe (pg),
 * puis appelle l'API Dofusbook avec throttle pour peupler le cache Redis.
 */

const Redis = require("ioredis");

function getEnv(key, fallback = "") {
    const val = process.env[key];
    if (!val) return fallback;
    return val.replace(/^['"]|['"]$/g, "").trim();
}

// Redis config
const REDIS_HOST = getEnv("REDIS_HOST");
const REDIS_PORT = parseInt(getEnv("REDIS_PORT", "6379"), 10);
const REDIS_PASSWORD = getEnv("REDIS_PASSWORD");
const REDIS_URL = getEnv("REDIS_URL", "redis://127.0.0.1:6379");

function createRedis() {
    const opts = { maxRetriesPerRequest: 3, enableReadyCheck: false };
    if (REDIS_HOST) {
        opts.host = REDIS_HOST;
        opts.port = REDIS_PORT;
        if (REDIS_PASSWORD) opts.password = REDIS_PASSWORD;
        return new Redis(opts);
    }
    return new Redis(REDIS_URL, opts);
}

// Read dofusBookLinks JSON directly from Redis-stored warm or use pg
// Since we can't use Prisma easily standalone, read from the DB using pg
async function getAllBuildUrls() {
    let pg;
    try {
        pg = require("pg");
    } catch {
        // Try alternative
        console.error("[Warm] pg module not found. Install it with: npm install pg");
        process.exit(1);
    }

    const DATABASE_URL = getEnv("DATABASE_URL") || getEnv("POSTGRES_PRISMA_URL") || getEnv("POSTGRES_URL");
    if (!DATABASE_URL) {
        console.error("[Warm] No DATABASE_URL found in .env");
        process.exit(1);
    }

    const client = new pg.Client({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : false });
    await client.connect();
    console.log("[Warm] ✅ PostgreSQL connecté");

    const res = await client.query(
        `SELECT "dofusBookLinks" FROM "UserProfile" WHERE status = 'ACTIVE' AND "dofusBookLinks" IS NOT NULL AND "dofusBookLinks" != 'null'::jsonb`
    );

    await client.end();
    return res.rows.map(r => r.dofusBookLinks || []);
}

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

async function resolveFinalId(id) {
    if (/^\d+$/.test(id)) return id;
    try {
        const res = await fetch(`https://d-bk.net/fr/d/${id}`, {
            method: "HEAD", redirect: "manual",
            headers: { "User-Agent": randomUA() }
        });
        const loc = res.headers.get("location");
        if (loc) {
            const m = loc.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
            if (m) return m[1];
        }
        const getRes = await fetch(`https://d-bk.net/fr/d/${id}`, {
            method: "GET", redirect: "follow",
            headers: { "User-Agent": randomUA() }
        });
        const m2 = getRes.url.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
        if (m2) return m2[1];
    } catch (e) {
        console.warn(`  [WARN] Cannot resolve ${id}: ${e.message}`);
    }
    return id;
}

async function warmBuild(buildId, redis) {
    const cacheKey = `dofusbook:build:${buildId}`;
    const staleKey = `dofusbook:stale:${buildId}`;

    const exists = await redis.exists(cacheKey);
    if (exists) {
        console.log(`  [HIT]    ${buildId}`);
        return "HIT";
    }

    const finalId = await resolveFinalId(buildId);
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
        },
    });

    if (!res.ok) {
        console.log(`  [${res.status}]    ${buildId} (finalId=${finalId})`);
        return res.status;
    }

    const data = await res.json();
    const serialized = JSON.stringify(data);
    await Promise.all([
        redis.setex(cacheKey, 86400, serialized),
        redis.setex(staleKey, 86400 * 7, serialized)
    ]);

    const name = data.name || data.stuff?.name || "?";
    const lvl = data.stuff?.level || data.level || "?";
    console.log(`  [OK]     ${buildId} — ${name} Lvl${lvl}`);
    return "CACHED";
}

async function main() {
    const redis = createRedis();
    await new Promise((resolve, reject) => {
        redis.once("ready", resolve);
        redis.once("error", reject);
        setTimeout(() => reject(new Error("Redis timeout")), 8000);
    });
    console.log("[Warm] ✅ Redis connecté\n");

    const allLinks = await getAllBuildUrls();
    const allIds = new Set();
    allLinks.forEach(links => {
        if (!Array.isArray(links)) return;
        links.forEach(link => {
            if (link?.url) {
                const id = extractBuildId(link.url);
                if (id) allIds.add(id);
            }
        });
    });

    console.log(`[Warm] ${allIds.size} builds uniques trouvés en base\n`);

    let warmed = 0, hits = 0, errors = 0;
    for (const id of allIds) {
        const result = await warmBuild(id, redis);
        if (result === "HIT") hits++;
        else if (result === "CACHED") warmed++;
        else errors++;
        if (result !== "HIT") {
            await new Promise(r => setTimeout(r, 700));
        }
    }

    console.log(`\n[Warm] ✅ Terminé: ${warmed} mis en cache, ${hits} déjà cachés, ${errors} erreurs`);
    await redis.quit();
}

main().catch(e => { console.error("[Warm] ERROR:", e.message); process.exit(1); });
