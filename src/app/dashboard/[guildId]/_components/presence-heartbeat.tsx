"use client";

import { useEffect, useRef } from "react";
import { updateHeartbeat } from "@/server/actions/presence-actions";

export function PresenceHeartbeat({ guildId }: { guildId: string }) {
    const lastInteractionRef = useRef<number>(Date.now());

    useEffect(() => {
        const handleUserInteraction = () => {
            lastInteractionRef.current = Date.now();
        };

        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => {
            window.addEventListener(event, handleUserInteraction, { passive: true });
        });

        const sendHeartbeat = () => {
            // User is AFK if no interaction for > 15 minutes (15 * 60 * 1000 ms)
            const isAfk = (Date.now() - lastInteractionRef.current) > 15 * 60 * 1000;
            updateHeartbeat(guildId, isAfk);
        };

        // Initial heartbeat
        sendHeartbeat();

        // Heartbeat every 45 seconds
        const interval = setInterval(sendHeartbeat, 45 * 1000);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleUserInteraction);
            });
            clearInterval(interval);
        };
    }, [guildId]);

    return null; // Silent component
}
