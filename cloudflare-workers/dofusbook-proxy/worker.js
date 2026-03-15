/**
 * SigilOS — Dofusbook Proxy Worker
 * Deployed on Cloudflare Workers (edge network)
 *
 * Purpose: Fetch Dofusbook build data from CF edge IPs (not blocked like our VPS)
 * Route:   GET /:id  → https://www.dofusbook.net/api/stuffs/dofus/public/:id
 *
 * Auth: X-SigilOS-Key header required (set WORKER_SECRET in CF env vars)
 *       Protects against quota abuse while keeping Dofusbook calls clean.
 */

export default {
    async fetch(request, env, ctx) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET",
                    "Access-Control-Allow-Headers": "X-SigilOS-Key",
                }
            });
        }

        if (request.method !== "GET") {
            return new Response("Method not allowed", { status: 405 });
        }

        // 🔐 Secret check — only our Next.js server can call this
        // WORKER_SECRET is set in Cloudflare Dashboard → Worker → Settings → Variables
        const workerSecret = env.WORKER_SECRET;
        if (workerSecret) {
            const providedSecret = request.headers.get("X-SigilOS-Key");
            if (providedSecret !== workerSecret) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        const url = new URL(request.url);
        const pathParts = url.pathname.split("/").filter(Boolean);
        const buildId = pathParts[pathParts.length - 1];

        if (!buildId || !/^\d+$/.test(buildId)) {
            return new Response(JSON.stringify({ error: "Invalid build ID" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const dofusbookUrl = `https://www.dofusbook.net/api/stuffs/dofus/public/${buildId}`;

        try {
            // NOTE: Do NOT forward the X-SigilOS-Key to Dofusbook — only used between us and the Worker
            const response = await fetch(dofusbookUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "fr-FR,fr;q=0.9",
                    "Referer": `https://www.dofusbook.net/fr/equipement/${buildId}`,
                    "Origin": "https://www.dofusbook.net",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                }
            });

            const body = await response.text();

            return new Response(body, {
                status: response.status,
                headers: {
                    "Content-Type": response.headers.get("Content-Type") || "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=86400",
                    "X-Proxied-By": "SigilOS-CF-Worker",
                    "X-Dofusbook-Status": String(response.status),
                }
            });

        } catch (err) {
            return new Response(
                JSON.stringify({ error: "Worker fetch failed", details: err.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }
};
