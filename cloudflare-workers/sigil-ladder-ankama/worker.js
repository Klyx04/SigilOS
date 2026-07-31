/**
 * SigilOS — Dofus Ladder Scraper Worker (VERSION COMPLÈTE avec classe + rang)
 * Deployed on Cloudflare Workers (edge network)
 *
 * Purpose: Fetch success points / general XP from the official Dofus ladder
 * Route:   GET /?server_id=295&name=Pseudo&type=succes|general
 *
 * Auth: X-SigilOS-Key header REQUIRED (fail-closed if WORKER_SECRET missing)
 *
 * NOTE (audit 31/07/2026) : ce worker est la version « la plus complète »
 * (revoie `classe` et `rank` en plus). Il correspond au dashboard CF
 * `sigil-ladder-ankama`. F-19 fail-closed + F-27 erreurs neutres appliqués.
 */

// Constant-time string comparison helper (avoids timing side-channel on secrets)
function timingSafeEqualStr(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

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

        // 🔐 Secret check — FAIL-CLOSED (F-19): refuse if WORKER_SECRET is not set
        const workerSecret = env.WORKER_SECRET;
        if (!workerSecret) {
            return new Response(JSON.stringify({ error: "Server misconfigured" }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }
        const providedSecret = request.headers.get("X-SigilOS-Key") || "";
        if (providedSecret.length !== workerSecret.length ||
            !timingSafeEqualStr(providedSecret, workerSecret)) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        const url = new URL(request.url);
        const serverId = url.searchParams.get("server_id") || "295";
        const name = url.searchParams.get("name");
        const type = url.searchParams.get("type") || "succes";

        if (!name) {
            return new Response(JSON.stringify({ error: "Character name is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const validTypes = ["succes", "general"];
        if (!validTypes.includes(type)) {
            return new Response(JSON.stringify({ error: "Invalid type param" }), { status: 400 });
        }

        const ladderUrl = `https://www.dofus.com/fr/mmorpg/communaute/ladder/${type}?server_id=${serverId}&name=${encodeURIComponent(name)}`;

        try {
            // --- MANUALLY HANDLE REDIRECTS TO CAPTURE COOKIES (ANKAMA SSO BYPASS) ---
            let currentUrl = ladderUrl;
            let cookies = "";
            let response;
            let redirectCount = 0;
            const maxRedirects = 10;

            const baseHeaders = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,all;q=0.8",
                "Accept-Language": "fr-FR,fr;q=0.9",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            };

            while (redirectCount < maxRedirects) {
                response = await fetch(currentUrl, {
                    method: "GET",
                    headers: {
                        ...baseHeaders,
                        ...(cookies ? { "Cookie": cookies } : {}),
                        "Referer": "https://www.dofus.com/fr/mmorpg/communaute/ladder/succes",
                    },
                    redirect: "manual"
                });

                // Extract new cookies
                const setCookieHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get("Set-Cookie")].filter(Boolean);
                if (setCookieHeaders.length > 0) {
                    const newCookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
                    cookies = cookies ? `${cookies}; ${newCookies}` : newCookies;
                }

                if (response.status >= 300 && response.status < 400) {
                    const location = response.headers.get("Location");
                    if (!location) break;

                    // Handle relative locations
                    currentUrl = new URL(location, currentUrl).href;
                    redirectCount++;
                } else {
                    break;
                }
            }

            if (!response || !response.ok) {
                // F-27: neutral error — no debug_url leaking internal details
                return new Response(JSON.stringify({
                    error: "Upstream request failed"
                }), {
                    status: response ? response.status : 502,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const html = await response.text();

            // Scoping to the table body to avoid false positives
            const tableBodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
            const tableBody = tableBodyMatch ? tableBodyMatch[1] : html;

            // --- ROBUST PARSING STRATEGY ---
            // 1. Split by <tr> to isolate rows
            const rows = html.split(/<tr[^>]*>/i);
            let targetRow = "";

            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const nameRegex = new RegExp(`<span[^>]*class="ak-nickname"[^>]*>\\s*${escapedName}\\s*<\\/span>`, "i");

            for (const row of rows) {
                if (nameRegex.test(row)) {
                    targetRow = row;
                    break;
                }
            }

            if (!targetRow) {
                // FALLBACK: maybe the span class is different or missing
                const simpleNameRegex = new RegExp(`>\\s*${escapedName}\\s*<`, "i");
                for (const row of rows) {
                    if (simpleNameRegex.test(row)) {
                        targetRow = row;
                        break;
                    }
                }
            }

            if (!targetRow) {
                return new Response(JSON.stringify({
                    found: false,
                    error: "Character not found",
                    name,
                    serverId
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }

            // 2. Extract cells from the target row
            const cells = targetRow.split(/<td[^>]*>/i).slice(1).map(c => c.split(/<\/td>/i)[0]);

            // According to inspection:
            // 0: Rank, 1: Name, 2: Class, 3: Server, 4: Level, 5: Points
            if (cells.length < 6) {
                return new Response(JSON.stringify({
                    found: false,
                    error: "Character found but response structure is unexpected."
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const rawRank = cells[0].replace(/<[^>]*>/g, "").trim();
            const rawLevel = cells[4].replace(/<[^>]*>/g, "").trim();
            const rawValue = cells[5].replace(/<[^>]*>/g, "").trim();
            const rawClass = cells[2].replace(/<[^>]*>/g, "").trim();

            const level = parseInt(rawLevel.replace(/\s/g, ""), 10);

            // In 'general' it's Total XP, in 'succes' it's Points.
            const valueAsNumber = parseInt(rawValue.replace(/\s/g, ""), 10);

            // Handle ranking (Top 1000 has "#", some unranked players don't have numbers)
            const parsedRank = parseInt(rawRank.replace(/\s/g, "").replace("#", ""), 10);
            const rank = isNaN(parsedRank) ? null : parsedRank;

            if (isNaN(level) || isNaN(valueAsNumber)) {
                return new Response(JSON.stringify({
                    found: false,
                    error: "Could not parse numeric values."
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const responsePayload = {
                found: true,
                success: true,
                name,
                serverId,
                level,
                classe: rawClass.slice(0, 50),   // F-26 bound
                rank: rank,
                timestamp: new Date().toISOString()
            };

            if (type === "succes") {
                responsePayload.points = valueAsNumber;
            } else if (type === "general") {
                // Remove everything that's not a digit to avoid trailing page content/scripts
                responsePayload.totalXp = rawValue.replace(/\D/g, "");
            }

            return new Response(JSON.stringify(responsePayload), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=3600",
                }
            });

        } catch (err) {
            // F-27: neutral error — no internal details leaked
            return new Response(
                JSON.stringify({ error: "Worker fetch failed" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }
};