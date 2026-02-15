"use client";

import { useEffect } from "react";
import { updateHeartbeat } from "@/server/actions/presence-actions";

export function PresenceHeartbeat({ guildId }: { guildId: string }) {
    useEffect(() => {
        // Initial heartbeat
        updateHeartbeat(guildId);

        // Heartbeat every 45 seconds
        const interval = setInterval(() => {
            updateHeartbeat(guildId);
        }, 45 * 1000);

        return () => clearInterval(interval);
    }, [guildId]);

    return null; // Silent component
}
