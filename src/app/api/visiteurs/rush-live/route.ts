/**
 * Rush Live des visiteurs (V2c) — **flux SSE** d'une room par serveur Dofus.
 *
 * Ce que la route garantit :
 *  · **auth** : `getPublicAccount()` (session + bannissement + profil public), sinon 401 ;
 *  · **serveur résolu côté serveur** : `profile.dofusServerId`, jamais un paramètre d'URL ;
 *  · **consentement** : `showPresence` décide seulement d'**apparaître** ; un visiteur masqué
 *    reçoit quand même les événements des autres (le consentement sert à être vu) ;
 *  · **aucun rejeu** : le curseur de départ est le dernier événement déjà en room — ouvrir le
 *    guide ne rejoue pas les validations passées ;
 *  · **état honnête** : Redis indisponible ⇒ `presence: unavailable`, jamais « 0 en ligne » ;
 *  · **durée bornée** (3 min) : le navigateur se reconnecte, la présence est réévaluée.
 */

import { NextRequest } from "next/server";
import { createSseChannel, sseFrame } from "@/lib/sse";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getPublicAccount } from "@/server/public-account";
import {
    clearPublicRushPresence,
    publicRushLiveEventHead,
    readPublicRushLiveEvents,
    readPublicRushPresence,
    refreshPublicRushPresence,
} from "@/server/public-rush-live";
import {
    PUBLIC_RUSH_LIVE_POLL_MS,
    PUBLIC_RUSH_LIVE_PRESENCE_POLL_MS,
    PUBLIC_RUSH_LIVE_PRESENCE_REFRESH_MS,
    PUBLIC_RUSH_LIVE_STREAM_LIFETIME_MS,
} from "@/lib/public-rush-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const account = await getPublicAccount();
    if (!account) return new Response("Unauthorized", { status: 401 });

    // Une connexion par onglet, renouvelée toutes les 3 min : 6/min laisse largement la place
    // à un visiteur normal, ferme la porte à une boucle d'`EventSource`.
    const limited = await rateLimit(`visitor:rush-live:${account.userId}`, 6, 60_000);
    if (!limited.success) {
        return new Response("Trop de connexions au Rush Live. Réessaie dans une minute.", { status: 429 });
    }

    const profile = account.profile;
    // Le serveur est celui du PROFIL — aucun `?serverId=` n'est lu, ici ou ailleurs.
    const serverId = profile.dofusServerId;
    const canBeSeen = profile.showPresence;
    const liveProfile = {
        id: profile.id,
        pseudoDofus: profile.pseudoDofus,
        classe: profile.classe,
        dofusServerId: serverId,
        showPresence: canBeSeen,
    };

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const channel = createSseChannel(controller);

            // Anti-rejeu : on ne renvoie que ce qui arrive APRÈS l'ouverture. Si Redis était
            // muet à la connexion, le curseur est reposé au premier battement réussi : une
            // reprise ne doit pas déverser l'historique de la room en toasts.
            let sinceId = await publicRushLiveEventHead(serverId);
            let cursorReady = sinceId > 0;
            if (!channel.open) return;

            let lastPresenceAt = 0;
            let lastPresencePushAt = 0;

            const refreshPresence = async () => {
                if (!canBeSeen) return;
                const ok = await refreshPublicRushPresence(liveProfile);
                lastPresenceAt = Date.now();
                // Échec : on force l'instantané qui suit à dire `unavailable` (une seule trame,
                // jamais un compteur provisoire).
                if (!ok) lastPresencePushAt = 0;
            };

            const pushPresence = async (force = false) => {
                if (!force && Date.now() - lastPresencePushAt < PUBLIC_RUSH_LIVE_PRESENCE_POLL_MS) return;
                lastPresencePushAt = Date.now();
                const snapshot = await readPublicRushPresence(serverId);
                channel.send(
                    sseFrame({ type: "presence", status: snapshot.status, members: snapshot.members })
                );
            };

            const tick = async () => {
                if (!channel.open) return;
                try {
                    if (canBeSeen && Date.now() - lastPresenceAt >= PUBLIC_RUSH_LIVE_PRESENCE_REFRESH_MS) {
                        await refreshPresence();
                    }
                    await pushPresence();

                    if (!cursorReady) {
                        sinceId = await publicRushLiveEventHead(serverId);
                        cursorReady = true;
                    }

                    const events = await readPublicRushLiveEvents(serverId, sinceId);
                    if (!channel.open) return;
                    if (events.length > 0) {
                        sinceId = events[events.length - 1].id;
                        channel.send(sseFrame({ type: "events", events }));
                    } else {
                        channel.send(": ping\n\n");
                    }
                } catch (error) {
                    // Une erreur de lecture ferme le flux : le navigateur rouvrira, et la
                    // présence sera réévaluée. On ne laisse pas un flux mort en vie.
                    logger.warn("[Rush Live] Flux interrompu", { error: String(error) });
                    channel.close();
                }
            };

            await refreshPresence();
            await pushPresence(true);
            if (!channel.open) return;

            const interval = setInterval(() => {
                void tick();
            }, PUBLIC_RUSH_LIVE_POLL_MS);
            const lifetime = setTimeout(
                () => channel.close(),
                PUBLIC_RUSH_LIVE_STREAM_LIFETIME_MS
            );

            channel.onClose(() => {
                clearInterval(interval);
                clearTimeout(lifetime);
                if (canBeSeen) void clearPublicRushPresence(profile.id, serverId);
            });

            request.signal.addEventListener("abort", () => channel.close());
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
