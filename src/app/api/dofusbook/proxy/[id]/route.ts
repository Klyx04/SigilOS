import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { redis } from "@/lib/redis";

const execAsync = promisify(exec);

// Cache TTL: 24 hours for builds
const BUILD_CACHE_TTL = 86400;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const cacheKey = `dofusbook:build:${id}`;

    try {
        // 1. Check Redis Cache
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return NextResponse.json(JSON.parse(cachedData), {
                headers: { "X-Cache": "HIT" }
            });
        }

        let finalId = id;

        // Si l'ID contient autre chose que des chiffres (ex: "1R9xf" format url courte d-bk.net)
        if (!/^\d+$/.test(id)) {
            const shortUrl = `https://d-bk.net/fr/d/${id}`;
            const { stdout: headers } = await execAsync(`curl -sI "${shortUrl}"`);
            const locationMatch = headers.match(/Location:\s*([^\r\n]+)/i);

            if (locationMatch) {
                const redirectUrl = locationMatch[1].trim();
                const idMatch = redirectUrl.match(/equipement\/(?:[a-z]+\/)?(\d+)/i);
                if (idMatch) {
                    finalId = idMatch[1];
                } else {
                    return NextResponse.json({ error: "L'URL raccourcie ne redirige pas vers un équipement valide" }, { status: 400 });
                }
            } else {
                return NextResponse.json({ error: "Impossible de résoudre le lien Dofusbook raccourci" }, { status: 404 });
            }
        }

        const url = `https://www.dofusbook.net/api/stuffs/dofus/public/${finalId}`;
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
        const referer = "https://www.dofusbook.net/";

        // Execute curl command
        const { stdout, stderr } = await execAsync(
            `curl -L "${url}" -A "${userAgent}" -H "Referer: ${referer}" -H "Accept: application/json" --max-time 15`
        );

        if (!stdout) {
            console.error(`[Dofusbook Proxy] Empty response for ${id}. Stderr: ${stderr}`);
            return NextResponse.json({ error: "Empty response" }, { status: 502 });
        }

        if (stdout.trim().startsWith("<!DOCTYPE html>") || stdout.includes("<html")) {
            console.error(`[Dofusbook Proxy] WAF/HTML detected instead of JSON for ${id}.`);
            return NextResponse.json({ error: "Blocked by provider protection" }, { status: 403 });
        }

        const data = JSON.parse(stdout);

        // 3. Save to Redis
        await redis.setex(cacheKey, BUILD_CACHE_TTL, JSON.stringify(data));

        return NextResponse.json(data, {
            headers: { "X-Cache": "MISS" }
        });

    } catch (error: any) {
        console.error(`[Dofusbook Proxy] Error for build ${id}:`, error.message);
        return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }
}
