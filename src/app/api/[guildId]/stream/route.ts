import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { emitGuildActivity } from "@/server/actions/activity-actions";
import { getDisplayName } from "@/lib/display-name";
import { createSseChannel } from "@/lib/sse";

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
    const actorName = getDisplayName(profile);
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

    // Max stream lifetime: 3 minutes. After this the client's EventSource
    // auto-reconnects, keeping connections fresh and avoiding pool exhaustion.
    const MAX_STREAM_LIFETIME_MS = 3 * 60 * 1000;

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            // Canal partagé : `abort`, erreur de sondage et fin de vie ferment **une
            // seule fois** (jamais de second `close()` sur un contrôleur détruit).
            const channel = createSseChannel(controller);

            // Send initial ping
            channel.send(": ping\n\n");

            let isPolling = false;
            // ⚠️ Sentry signale une « N+1 Query » sur cette route (08/10/2026) : c'est un
            // **faux positif** de sa détection — la même requête (GuildActivity de la
            // guilde) est rejouée par le **sondage volontaire de 8 s** ci-dessous, une
            // fois par battement, pas dans une boucle imbriquée. Mesure : la requête est
            // bornée (`take: 20`, `createdAt > since`, indexée par guilde) et il n'y a
            // **aucune** requête par événement. Ne pas la « corriger » en boucle plus
            // large : ça ne réduirait pas le nombre d'appels, ça augmenterait la latence.
            const poll = setInterval(async () => {
                if (!channel.open || isPolling) return;
                isPolling = true;

                try {
                    const events = await db.guildActivity.findMany({
                        where: { guildId: config.id, createdAt: { gt: since } },
                        orderBy: { createdAt: "asc" },
                        take: 20,
                    });

                    if (!channel.open) return;

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
                            if (!channel.send(`data: ${payload}\n\n`)) return;
                        }
                    } else {
                        // Keep-alive ping
                        channel.send(": ping\n\n");
                    }
                } catch {
                    channel.close();
                } finally {
                    isPolling = false;
                }
            }, 8000); // Poll DB every 8s

            // Auto-close after max lifetime — client EventSource reconnects automatically
            const maxLifetime = setTimeout(() => channel.close(), MAX_STREAM_LIFETIME_MS);

            // Un seul nettoyage, joué à la fermeture quel qu'en soit le signal.
            channel.onClose(() => {
                clearInterval(poll);
                clearTimeout(maxLifetime);
            });

            req.signal.addEventListener("abort", () => channel.close());
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
