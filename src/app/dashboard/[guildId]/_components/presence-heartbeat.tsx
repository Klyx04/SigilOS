"use client";

import { useEffect } from "react";
import { updateHeartbeat } from "@/server/actions/presence-actions";

export function PresenceHeartbeat({ guildId, userId }: { guildId: string, userId: string }) {
    useEffect(() => {
        // Initial heartbeat
        updateHeartbeat(guildId, userId);

        // Heartbeat every 5 minutes
        const interval = setInterval(() => {
            updateHeartbeat(guildId, userId);
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [guildId, userId]);

    return null; // Silent component
}
