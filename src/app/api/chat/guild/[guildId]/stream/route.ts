import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import redis from "@/lib/redis";
import { NextRequest } from "next/server";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { chatKey, chatPubSubChannel, CHAT_TTL_SECONDS, chatOnlineUsersKey, CHAT_HISTORY_LIMIT } from "@/lib/chat-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    // Module check
    const enabled = await isModuleEnabled(discordGuildId, "chat");
    if (!enabled) return new Response("Chat module disabled", { status: 403 });

    const encoder = new TextEncoder();
    let closed = false;

    // Presence Data
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get("connectionId") || "legacy";
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

    // Field: userId:connectionId
    const fieldId = `${userData.id}:${connectionId}`;

    // Helper: Get active status for a user
    const getActiveConnectionsForUser = async (userId: string) => {
        const all = await redis.hgetall(onlineKey);
        return Object.entries(all).filter(([fId, val]) => {
            if (!fId.startsWith(`${userId}:`)) return false;
            try { return JSON.parse(val).isActive === true; } catch { return false; }
        });
    };

    // Check if user is ALREADY active before adding this connection
    const activeConnectionsBefore = await getActiveConnectionsForUser(userData.id);
    const wasAlreadyActive = activeConnectionsBefore.length > 0;

    // Add current connection
    await redis.hset(onlineKey, fieldId, JSON.stringify({ ...userData, lastSeen: Date.now(), isActive }));
    await redis.expire(onlineKey, CHAT_TTL_SECONDS);

    // Fetch all unique users who are ACTIVELY in the chat
    const getAllOnlineUsers = async () => {
        try {
            const all = await redis.hvals(onlineKey);
            const activeUsers: Record<string, any> = {};
            all.forEach(r => {
                try {
                    const p = JSON.parse(r);
                    if (p.isActive === true) activeUsers[p.id] = { id: p.id, name: p.name, image: p.image };
                } catch { }
            });
            return Object.values(activeUsers);
        } catch { return []; }
    };

    // ... (rest of the stream initialization) ...
    const subscriber = redis.duplicate();
    await subscriber.subscribe(pubChannel);

    const stream = new ReadableStream({
        async start(controller) {
            // Heartbeat every 20s + Refresh timestamp in Redis
            const heartbeat = setInterval(async () => {
                if (closed) { clearInterval(heartbeat); return; }
                try {
                    controller.enqueue(encoder.encode(": ping\n\n"));
                    await redis.hset(onlineKey, fieldId, JSON.stringify({ ...userData, lastSeen: Date.now() }));
                } catch { clearInterval(heartbeat); }
            }, 20_000);

            // 1. Initial ping
            controller.enqueue(encoder.encode(": ping\n\n"));

            // 2. Initial presence list
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

            // 3. Join Message (if becoming active for the first time)
            if (isActive && !wasAlreadyActive) {
                const joinMsg = {
                    id: `presence-join-${Date.now()}-${userData.id}`,
                    type: "presence",
                    text: `${userData.name} a rejoint le chat de guilde`,
                    authorId: "system",
                    authorName: "Système",
                    createdAt: new Date().toISOString(),
                    onlineUsers: currentOnlineUsers
                };

                const listKey = chatKey(discordGuildId);
                await redis.rpush(listKey, JSON.stringify(joinMsg));
                await redis.ltrim(listKey, -CHAT_HISTORY_LIMIT, -1);
                await redis.publish(pubChannel, JSON.stringify(joinMsg));

                controller.enqueue(encoder.encode(`data: ${JSON.stringify(joinMsg)}\n\n`));
            }

            // 4. Subscriber
            subscriber.on("message", (_channel, data) => {
                if (closed) return;
                try { controller.enqueue(encoder.encode(`data: ${data}\n\n`)); } catch { }
            });

            // Cleanup on client disconnect
            req.signal.addEventListener("abort", async () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);

                try {
                    // Remove individual connection
                    await redis.hdel(onlineKey, fieldId);

                    // DELAY: Wait to see if user is still active in another tab
                    setTimeout(async () => {
                        try {
                            const remainingActive = await getActiveConnectionsForUser(userData.id);

                            // If user was active and now has NO active connections left
                            if (isActive && remainingActive.length === 0) {
                                const updatedUsers = await getAllOnlineUsers();
                                const leaveMsg = {
                                    id: `presence-leave-${Date.now()}-${userData.id}`,
                                    type: "presence",
                                    text: `${userData.name} a quitté le chat`,
                                    authorId: "system",
                                    authorName: "Système",
                                    createdAt: new Date().toISOString(),
                                    onlineUsers: updatedUsers
                                };

                                const listKey = chatKey(discordGuildId);
                                await redis.rpush(listKey, JSON.stringify(leaveMsg));
                                await redis.ltrim(listKey, -CHAT_HISTORY_LIMIT, -1);
                                await redis.publish(pubChannel, JSON.stringify(leaveMsg));
                            }
                        } catch (err) {
                            console.error("[SSE-Cleanup-Delayed] Error:", err);
                        }
                    }, 3500);

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
