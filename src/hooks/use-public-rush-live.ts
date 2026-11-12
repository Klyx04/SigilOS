"use client";

/**
 * Rush Live des visiteurs (V2c) — **abonnement client** au flux SSE.
 *
 * Trois états, et aucun autre :
 *  · `off`         — pas de compte connecté : aucun appel réseau (comme V1d) ;
 *  · `connecting`  — le flux n'a pas encore parlé (ou se reconnecte) ;
 *  · `live`        — le serveur a répondu : `members` est une **mesure** ;
 *  · `unavailable` — la source manque (Redis muet, réseau coupé) : on ne compte rien.
 *
 * Le serveur ferme le flux toutes les 3 min : `EventSource` se reconnecte seul. On ne bascule
 * donc pas en `unavailable` au premier `onerror` (ce serait un clignotement mensonger toutes
 * les trois minutes) — on laisse 10 s au navigateur pour rouvrir, puis on dit l'état réel.
 */

import { useEffect, useRef, useState } from "react";
import {
    PUBLIC_RUSH_LIVE_MAX_FRAME_EVENTS,
    parsePublicRushLiveFrame,
    type PublicRushLiveEvent,
    type PublicRushLiveMember,
} from "@/lib/public-rush-live";

export type PublicRushLiveStatus = "off" | "connecting" | "live" | "unavailable";

/** Délai laissé à `EventSource` pour rouvrir avant d'annoncer l'indisponibilité. */
const RECONNECT_GRACE_MS = 10_000;

export function usePublicRushLive({
    enabled,
    reloadKey = 0,
}: {
    enabled: boolean;
    /** Incrémenté quand le consentement change : le flux est rouvert avec le nouvel état. */
    reloadKey?: number;
}) {
    const [status, setStatus] = useState<PublicRushLiveStatus>(enabled ? "connecting" : "off");
    const [members, setMembers] = useState<PublicRushLiveMember[]>([]);
    const [events, setEvents] = useState<PublicRushLiveEvent[]>([]);
    /**
     * Curseur par **identifiant** (monotone côté serveur), pas par longueur de tableau :
     * le flux est plafonné à 20 événements, une longueur seule cesserait d'avancer.
     */
    const lastEventId = useRef(0);

    useEffect(() => {
        if (!enabled) {
            setStatus("off");
            setMembers([]);
            return;
        }
        if (typeof window === "undefined" || typeof EventSource === "undefined") {
            setStatus("unavailable");
            return;
        }

        setStatus("connecting");
        let grace: ReturnType<typeof setTimeout> | null = null;
        const source = new EventSource("/api/visiteurs/rush-live");

        const clearGrace = () => {
            if (grace) {
                clearTimeout(grace);
                grace = null;
            }
        };

        source.onopen = () => {
            clearGrace();
            setStatus("live");
        };

        source.onerror = () => {
            // Le flux a une durée de vie de 3 min : un `onerror` est d'abord une reconnexion.
            setStatus("connecting");
            clearGrace();
            grace = setTimeout(() => setStatus("unavailable"), RECONNECT_GRACE_MS);
        };

        source.onmessage = (message) => {
            let raw: unknown;
            try {
                raw = JSON.parse(message.data);
            } catch {
                return;
            }
            const frame = parsePublicRushLiveFrame(raw);
            if (!frame) return;

            if (frame.type === "presence") {
                clearGrace();
                setStatus(frame.status);
                setMembers(frame.members);
                return;
            }

            const fresh = frame.events.filter((event) => event.id > lastEventId.current);
            if (fresh.length === 0) return;
            lastEventId.current = fresh[fresh.length - 1].id;
            setEvents((prev) => [...prev, ...fresh].slice(-PUBLIC_RUSH_LIVE_MAX_FRAME_EVENTS));
        };

        return () => {
            clearGrace();
            source.close();
        };
    }, [enabled, reloadKey]);

    return { status, members, events };
}
