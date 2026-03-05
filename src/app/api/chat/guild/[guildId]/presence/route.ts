import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import redis from "@/lib/redis";
import { NextRequest, NextResponse } from "next/server";
import { chatOnlineUsersKey, chatPubSubChannel, CHAT_TTL_SECONDS } from "@/lib/chat-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PATCH /api/chat/guild/[guildId]/presence
 * Updates the isActive status of a specific connection in Redis.
 * Called when the user minimizes or re-opens the chat widget.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { guildId: discordGuildId } = await params;

    let body: { connectionId?: string; isActive?: boolean };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { connectionId, isActive } = body;
    if (!connectionId || typeof isActive !== "boolean") {
        return NextResponse.json({ error: "Missing connectionId or isActive" }, { status: 400 });
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true },
    });
    if (!guild) return NextResponse.json({ error: "Guild not found" }, { status: 404 });

    const profile = await (db.userProfile as any).findFirst({
        where: { guildId: guild.id, userId: session.user.id, status: "ACTIVE" },
        select: { id: true, discordNickname: true, pseudoDofus: true, user: { select: { image: true, name: true } } },
    });
    if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const onlineKey = chatOnlineUsersKey(discordGuildId);
    const fieldId = `${session.user.id}:${connectionId}`;

    // Read current value
    const current = await redis.hget(onlineKey, fieldId);
    if (!current) {
        // Connection not found (expired or never registered) — no-op
        return NextResponse.json({ ok: true, note: "connection_not_found" });
    }

    try {
        const parsed = JSON.parse(current);
        const wasActive = parsed.isActive === true;

        // Update isActive in Redis
        await redis.hset(onlineKey, fieldId, JSON.stringify({
            ...parsed,
            isActive,
            lastSeen: Date.now(),
        }));
        await redis.expire(onlineKey, CHAT_TTL_SECONDS);

        // If active status changed, broadcast updated presence list
        if (wasActive !== isActive) {
            const all = await redis.hgetall(onlineKey);
            const now = Date.now();
            const CONNECTION_TTL_SECONDS = 60;
            const activeUsers: Record<string, { id: string; name: string; image?: string }> = {};

            for (const [_fId, val] of Object.entries(all)) {
                try {
                    const p = JSON.parse(val);
                    const age = (now - (p.lastSeen || 0)) / 1000;
                    if (p.isActive === true && age < CONNECTION_TTL_SECONDS) {
                        activeUsers[p.id] = { id: p.id, name: p.name, image: p.image };
                    }
                } catch { }
            }

            const onlineUsers = Object.values(activeUsers);
            const presenceMsg = {
                id: `presence-update-${Date.now()}-${session.user.id}`,
                type: "presence",
                text: isActive
                    ? `${parsed.name} a rejoint le chat de guilde`
                    : `${parsed.name} a quitté le chat`,
                authorId: "system",
                authorName: "Système",
                createdAt: new Date().toISOString(),
                onlineUsers,
            };

            await redis.publish(chatPubSubChannel(discordGuildId), JSON.stringify(presenceMsg));
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[PATCH presence] Error:", e);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
