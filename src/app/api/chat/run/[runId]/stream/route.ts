import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import redis from "@/lib/redis";
import { NextRequest } from "next/server";
import { runChatPubSubChannel, runChatOnlineUsersKey } from "@/lib/chat-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE endpoint — streams live chat messages for a Songes run.
 * Access restricted to confirmed run members only.
 * GET /api/chat/run/[runId]/stream
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ runId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { runId } = await params;

    // Verify run membership
    const run = await db.dreamRun.findFirst({
        where: { id: runId },
        select: { status: true, members: { select: { userId: true } }, leaderId: true, guildId: true },
    });
    if (!run) return new Response("Run not found", { status: 404 });

    const isMember = run.members.some(m => m.userId === session!.user!.id) || run.leaderId === session!.user!.id;
    if (!isMember) return new Response("Forbidden", { status: 403 });

    if (run.status === "COMPLETED" || run.status === "ABANDONED" || run.status === "FAILED") {
        return new Response("Run is closed", { status: 403 });
    }

    const encoder = new TextEncoder();
    let closed = false;

    // Presence Data
    const userData = {
        id: session.user.id,
        name: session.user.name || "Inconnu",
        image: session.user.image || undefined,
    };
    const onlineKey = runChatOnlineUsersKey(runId);
    const pubChannel = runChatPubSubChannel(runId);

    // One-time fix: Delete if old SET type exists
    const keyTypeBefore = await redis.type(onlineKey);
    if (keyTypeBefore !== "hash" && keyTypeBefore !== "none") {
        await redis.del(onlineKey);
    }

    // Initial join
    await redis.hset(onlineKey, userData.id, JSON.stringify(userData));
    const rawOnline = await redis.hvals(onlineKey);
    const onlineUsers = rawOnline.map(r => JSON.parse(r));

    await redis.publish(pubChannel, JSON.stringify({
        id: `run-presence-${Date.now()}`,
        type: "presence",
        text: `${userData.name} a joint le chat`,
        authorId: userData.id,
        authorName: userData.name,
        createdAt: new Date().toISOString(),
        onlineUsers
    }));

    const subscriber = redis.duplicate();
    await subscriber.subscribe(pubChannel);

    const stream = new ReadableStream({
        async start(controller) {
            controller.enqueue(encoder.encode(": ping\n\n"));

            // Send initial presence list
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                id: "presence-init",
                type: "presence",
                text: "Initial presence",
                authorId: "system",
                authorName: "Système",
                createdAt: new Date().toISOString(),
                onlineUsers
            })}\n\n`));

            subscriber.on("message", (_channel, data) => {
                if (closed) return;
                try { controller.enqueue(encoder.encode(`data: ${data}\n\n`)); } catch { }
            });

            const heartbeat = setInterval(() => {
                if (closed) { clearInterval(heartbeat); return; }
                try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { clearInterval(heartbeat); }
            }, 20_000);

            req.signal.addEventListener("abort", async () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);

                // Remove from presence
                await redis.hdel(onlineKey, userData.id);
                const updatedRaw = await redis.hvals(onlineKey);
                const updatedUsers = updatedRaw.map(r => JSON.parse(r));

                await redis.publish(pubChannel, JSON.stringify({
                    id: `run-presence-leave-${Date.now()}`,
                    type: "presence",
                    text: `${userData.name} a quitté le chat`,
                    authorId: userData.id,
                    authorName: userData.name,
                    createdAt: new Date().toISOString(),
                    onlineUsers: updatedUsers
                }));

                try { await subscriber.unsubscribe(); subscriber.disconnect(); } catch { }
                try { controller.close(); } catch { }
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
