"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Sets (or removes) the sigil-god-bypass cookie based on the user's GOD status.
 * This cookie is read by the middleware to bypass maintenance mode.
 */
export function GodBypassCookie() {
    const { data: session } = useSession();

    useEffect(() => {
        const isGod = (session as any)?.isGod === true;
        const discordId = (session as any)?.user?.discordId;

        if (isGod && discordId) {
            // Secure cookie: SameSite=Strict, no JS access needed but we set it here
            // The middleware reads it server-side
            document.cookie = `sigil-god-bypass=${discordId}; path=/; SameSite=Strict; max-age=${7 * 24 * 60 * 60}`;
        } else {
            // Remove cookie if user is not GOD
            document.cookie = "sigil-god-bypass=; path=/; max-age=0";
        }
    }, [session]);

    return null;
}
