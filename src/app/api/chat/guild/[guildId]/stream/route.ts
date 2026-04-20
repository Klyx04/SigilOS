import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import redis from "@/lib/redis";
import { NextRequest } from "next/server";
import { chatKey, chatPubSubChannel, CHAT_TTL_SECONDS, chatOnlineUsersKey, CHAT_HISTORY_LIMIT } from "@/lib/chat-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TTL des connexions dans Redis — si le heartbeat s'arrête (tab crash, réseau), le champ expire
const CONNECTION_TTL_SECONDS = 60; // 3× le heartbeat interval (20s)

/**
 * SSE endpoint — streams live chat messages for a guild.
 * GET /api/chat/guild/[guildId]/stream
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { guildId: discordGuildId } = await params;

    // Guild membership check
    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true },
    });
    if (!guild) return new Response("Guild not found", { status: 404 });

    const profile = await (db.userProfile as any).findFirst({
        where: { guildId: guild.id, userId: session.user.id, status: "ACTIVE" },
        select: { id: true, discordNickname: true, pseudoDofus: true, user: { select: { image: true, name: true } } },
    });
    if (!profile) return new Response("Forbidden", { status: 403 });

    // Module chat supprimé — accès libre si membre authentifié

    const encoder = new TextEncoder();
    let closed = false;

    // Presence Data
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get("connectionId") || Math.random().toString(36).slice(2);
    const isActive = searchParams.get("active") === "true";

    const userData = {
        id: session.user.id,
        name: profile.discordNickname || profile.pseudoDofus || profile.user?.name || session.user.name || "Inconnu",
        image: profile.user?.image || session.user.image || undefined,
    };
    const onlineKey = chatOnlineUsersKey(discordGuildId);
    const pubChannel = chatPubSubChannel(discordGuildId);

    // One-time fix: Delete if old non-hash type exists
    const keyTypeBefore = await redis.type(onlineKey);
    if (keyTypeBefore !== "hash" && keyTypeBefore !== "none") await redis.del(onlineKey);

    // Field: userId:connectionId — unique per browser tab
    const fieldId = `${userData.id}:${connectionId}`;
    const fieldValue = JSON.stringify({ ...userData, lastSeen: Date.now(), isActive, ttl: CONNECTION_TTL_SECONDS });

    // Helper: Get all unique users who are ACTIVELY in the chat (isActive=true, lastSeen recent)
    const getAllOnlineUsers = async (): Promise<{ id: string; name: string; image?: string }[]> => {
        try {
            const all = await redis.hgetall(onlineKey);
            const now = Date.now();
            const activeUsers: Record<string, { id: string; name: string; image?: string }> = {};

            for (const [_fId, val] of Object.entries(all)) {
                try {
                    const p = JSON.parse(val);
                    // Must be active AND have been seen within CONNECTION_TTL_SECONDS
                    const age = (now - (p.lastSeen || 0)) / 1000;
                    if (p.isActive === true && age < CONNECTION_TTL_SECONDS) {
                        activeUsers[p.id] = { id: p.id, name: p.name, image: p.image };
                    }
                } catch { }
            }
            return Object.values(activeUsers);
        } catch { return []; }
    };

    // Helper: Get active connections for a specific user (excluding stale ones)
    const getActiveConnectionsForUser = async (userId: string) => {
        const all = await redis.hgetall(onlineKey);
        const now = Date.now();
        return Object.entries(all).filter(([fId, val]) => {
            if (!fId.startsWith(`${userId}:`)) return false;
            try {
                const p = JSON.parse(val);
                const age = (now - (p.lastSeen || 0)) / 1000;
                return p.isActive === true && age < CONNECTION_TTL_SECONDS;
            } catch { return false; }
        });
    };

    // Check if user was already active before this connection
    const activeConnectionsBefore = await getActiveConnectionsForUser(userData.id);
    const wasAlreadyActive = activeConnectionsBefore.length > 0;

    // Register this connection in Redis
    await redis.hset(onlineKey, fieldId, fieldValue);
    await redis.expire(onlineKey, CHAT_TTL_SECONDS);

    // Subscribe to the guild's pub/sub channel
    const subscriber = redis.duplicate();
    await subscriber.subscribe(pubChannel);

    const stream = new ReadableStream({
        async start(controller) {

            // Heartbeat every 20s: refreshes lastSeen AND isActive in Redis
            const heartbeat = setInterval(async () => {
                if (closed) { clearInterval(heartbeat); return; }
                try {
                    controller.enqueue(encoder.encode(": ping\n\n"));
                    // CRITICAL: persist isActive on every heartbeat so stale detection works
                    await redis.hset(onlineKey, fieldId, JSON.stringify({
                        ...userData,
                        lastSeen: Date.now(),
                        isActive,  // preserve original active state
                    }));
                    await redis.expire(onlineKey, CHAT_TTL_SECONDS);
                } catch { clearInterval(heartbeat); }
            }, 20_000);

            // Sweep stale connections every 45s and broadcast updated user list
            const staleSweep = setInterval(async () => {
                if (closed) { clearInterval(staleSweep); return; }
                try {
                    const all = await redis.hgetall(onlineKey);
                    const now = Date.now();
                    const staleFields: string[] = [];

                    for (const [fId, val] of Object.entries(all)) {
                        try {
                            const p = JSON.parse(val);
                            const age = (now - (p.lastSeen || 0)) / 1000;
                            if (age >= CONNECTION_TTL_SECONDS) staleFields.push(fId);
                        } catch {
                            staleFields.push(fId); // invalid entry, remove
                        }
                    }

                    if (staleFields.length > 0) {
                        await redis.hdel(onlineKey, ...staleFields);
                        const freshUsers = await getAllOnlineUsers();
                        const sweepMsg = {
                            id: `presence-sweep-${Date.now()}`,
                            type: "presence",
                            text: "Presence updated",
                            authorId: "system",
                            authorName: "Système",
                            createdAt: new Date().toISOString(),
                            onlineUsers: freshUsers,
                        };
                        await redis.publish(pubChannel, JSON.stringify(sweepMsg));
                    }
                } catch { }
            }, 45_000);

            // 1. Initial ping
            controller.enqueue(encoder.encode(": ping\n\n"));

            // 2. Initial presence list — send to connecting client
            const currentOnlineUsers = await getAllOnlineUsers();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                id: "presence-init",
                type: "presence",
                text: "Initial presence",
                authorId: "system",
                authorName: "Système",
                createdAt: new Date().toISOString(),
                onlineUsers: currentOnlineUsers
            })}\n\n`));

            // 3. Join Message — broadcast to others if user becomes newly active
            if (isActive && !wasAlreadyActive) {
                const updatedUsers = await getAllOnlineUsers();
                const joinMsg = {
                    id: `presence-join-${Date.now()}-${userData.id}`,
                    type: "presence",
                    text: `${userData.name} a rejoint le chat de guilde`,
                    authorId: "system",
                    authorName: "Système",
                    createdAt: new Date().toISOString(),
                    onlineUsers: updatedUsers,
                };

                const listKey = chatKey(discordGuildId);
                await redis.rpush(listKey, JSON.stringify(joinMsg));
                await redis.ltrim(listKey, -CHAT_HISTORY_LIMIT, -1);
                await redis.publish(pubChannel, JSON.stringify(joinMsg));

                controller.enqueue(encoder.encode(`data: ${JSON.stringify(joinMsg)}\n\n`));
            }

            // 4. Subscribe to new messages
            subscriber.on("message", (_channel, data) => {
                if (closed) return;
                try { controller.enqueue(encoder.encode(`data: ${data}\n\n`)); } catch { }
            });

            // 5. Cleanup on client disconnect (tab close, navigation, minimize→close)
            req.signal.addEventListener("abort", async () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);
                clearInterval(staleSweep);

                try {
                    // Remove this specific connection from Redis immediately
                    await redis.hdel(onlineKey, fieldId);

                    // Small delay to allow multi-tab: check if any active connections remain
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const remainingActive = await getActiveConnectionsForUser(userData.id);

                    // Only broadcast "leave" if user had NO other active tab open
                    if (isActive && remainingActive.length === 0) {
                        const updatedUsers = await getAllOnlineUsers();
                        const leaveMsg = {
                            id: `presence-leave-${Date.now()}-${userData.id}`,
                            type: "presence",
                            text: `${userData.name} a quitté le chat`,
                            authorId: "system",
                            authorName: "Système",
                            createdAt: new Date().toISOString(),
                            onlineUsers: updatedUsers,
                        };

                        const listKey = chatKey(discordGuildId);
                        // Use a fresh redis client — subscriber may be closing
                        await redis.rpush(listKey, JSON.stringify(leaveMsg));
                        await redis.ltrim(listKey, -CHAT_HISTORY_LIMIT, -1);
                        await redis.publish(pubChannel, JSON.stringify(leaveMsg));
                    }
                } catch (e) {
                    console.error("[SSE] Error during cleanup:", e);
                } finally {
                    try { await subscriber.unsubscribe(); subscriber.disconnect(); } catch { }
                    try { controller.close(); } catch { }
                }
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        },
    });
}
