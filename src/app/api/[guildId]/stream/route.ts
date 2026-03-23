import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { emitGuildActivity } from "@/server/actions/activity-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE endpoint — streams new GuildActivity events to connected clients.
 * Also emits a LOGIN or NEW_MEMBER event on connect so all other clients see it.
 * GET /api/[guildId]/stream
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { guildId } = await params;

    // Verify guild membership
    const config = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
    });
    if (!config) return new Response("Guild not found", { status: 404 });

    const profile = await db.userProfile.findFirst({
        where: { guildId: config.id, userId: session.user.id, status: "ACTIVE" },
        select: {
            id: true,
            discordNickname: true,
            pseudoDofus: true,
            lastActivityAt: true,
            user: { select: { name: true, image: true } },
        },
    });
    if (!profile) return new Response("Forbidden", { status: 403 });

    // ── Emit connection event (login or new member) ──────────────────────────
    const isSilent = req.nextUrl.searchParams.get("silent") === "1";
    const actorName = profile.pseudoDofus || profile.discordNickname || profile.user.name || "Membre";
    const actorImage = profile.user.image ?? null;

    if (!isSilent) {
        if (!profile.lastActivityAt) {
            // First ever visit → NEW_MEMBER
            await emitGuildActivity(config.id, "NEW_MEMBER", actorName, actorImage).catch(() => { });
        } else {
            // Regular connection → LOGIN
            await emitGuildActivity(config.id, "LOGIN", actorName, actorImage).catch(() => { });
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Start SSE stream
    let since = new Date();
    let closed = false;

    // Max stream lifetime: 3 minutes. After this the client's EventSource
    // auto-reconnects, keeping connections fresh and avoiding pool exhaustion.
    const MAX_STREAM_LIFETIME_MS = 3 * 60 * 1000;

    const closeStream = (controller: ReadableStreamDefaultController, poll: ReturnType<typeof setInterval>, maxLifetime: ReturnType<typeof setTimeout>) => {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearTimeout(maxLifetime);
        try { controller.close(); } catch { }
    };

    const stream = new ReadableStream({
        async start(controller) {
            const encode = (data: string) => new TextEncoder().encode(data);

            // Send initial ping
            controller.enqueue(encode(": ping\n\n"));

            let isPolling = false;
            const poll = setInterval(async () => {
                if (closed || isPolling) return;
                isPolling = true;

                try {
                    const events = await db.guildActivity.findMany({
                        where: { guildId: config.id, createdAt: { gt: since } },
                        orderBy: { createdAt: "asc" },
                        take: 20,
                    });

                    if (closed) return;

                    if (events.length > 0) {
                        since = events[events.length - 1].createdAt;
                        for (const evt of events) {
                            const payload = JSON.stringify({
                                id: evt.id,
                                type: evt.type,
                                actorName: evt.actorName,
                                actorImage: evt.actorImage,
                                meta: evt.meta,
                                createdAt: evt.createdAt,
                            });
                            controller.enqueue(encode(`data: ${payload}\n\n`));
                        }
                    } else {
                        // Keep-alive ping
                        controller.enqueue(encode(": ping\n\n"));
                    }
                } catch {
                    closeStream(controller, poll, maxLifetime);
                } finally {
                    isPolling = false;
                }
            }, 8000); // Poll DB every 8s

            // Auto-close after max lifetime — client EventSource reconnects automatically
            const maxLifetime = setTimeout(() => {
                closeStream(controller, poll, maxLifetime);
            }, MAX_STREAM_LIFETIME_MS);

            req.signal.addEventListener("abort", () => {
                closeStream(controller, poll, maxLifetime);
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
