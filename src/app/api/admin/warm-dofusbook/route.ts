import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";

/**
 * Admin-only endpoint: force re-warm all Dofusbook Redis caches for a guild.
 * GET /api/admin/warm-dofusbook?guildId=xxx
 */
export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isGod = await isSuperAdmin();
    if (!isGod) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get("guildId");
    if (!guildId) {
        return NextResponse.json({ error: "guildId required" }, { status: 400 });
    }

    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true }
    });

    if (!guildConfig) {
        return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    // Collect all Dofusbook URLs from the guild
    const profiles = await db.userProfile.findMany({
        where: { guildId: guildConfig.id, status: "ACTIVE" },
        select: { dofusBookLinks: true }
    });

    const urlIdPairs: { url: string; id: string }[] = [];
    profiles.forEach(p => {
        const links = (p.dofusBookLinks as any[]) || [];
        links.forEach(link => {
            if (link?.url) {
                const m = link.url.match(
                    /(?:equipement\/(?:[a-z]+\/)?(\d+)|d-bk\.net\/(?:fr\/)?d\/([a-zA-Z0-9]+))/i
                );
                const id = m ? (m[1] || m[2]) : null;
                if (id) urlIdPairs.push({ url: link.url, id });
            }
        });
    });

    // Check which ones are NOT in Redis
    const uncached: string[] = [];
    for (const pair of urlIdPairs) {
        const exists = await redis.exists(`dofusbook:build:${pair.id}`);
        if (!exists) uncached.push(pair.id);
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const results: { id: string; status: number; cache: string | null }[] = [];

    // Sequentially fetch (with delay) to avoid rate limits
    for (const id of uncached) {
        try {
            const res = await fetch(`${baseUrl}/api/dofusbook/proxy/${id}`, {
                headers: { "x-internal-warm": "1" }
            });
            results.push({ id, status: res.status, cache: res.headers.get("X-Cache") });
            // 600ms delay between each fetch
            await new Promise(r => setTimeout(r, 600));
        } catch (e) {
            results.push({ id, status: 0, cache: "ERROR" });
        }
    }

    return NextResponse.json({
        total: urlIdPairs.length,
        alreadyCached: urlIdPairs.length - uncached.length,
        warmed: results.length,
        results
    });
}
