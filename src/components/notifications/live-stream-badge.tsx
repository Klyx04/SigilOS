"use client";

import { useEffect, useState } from "react";
import { Tv, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLiveStreamers } from "@/server/actions/feed-actions";
import { Button } from "@/components/ui/button";

interface LiveStreamer {
    creatorId: string;
    url: string;
    title: string;
}

export function LiveStreamBadge({ guildId }: { guildId: string }) {
    const [liveStreamers, setLiveStreamers] = useState<LiveStreamer[]>([]);
    const [isHidden, setIsHidden] = useState(true); // Default to true while loading
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check if dismissed in last 4 hours
        const lastDismiss = localStorage.getItem(`live-badge-dismissed-${guildId}`);
        if (lastDismiss) {
            const dimissTime = parseInt(lastDismiss, 10);
            if (Date.now() - dimissTime < 1000 * 60 * 60 * 4) {
                setIsDismissed(true);
                return;
            }
        }

        const fetchLive = async () => {
            const res = await getLiveStreamers(guildId);
            if (res.success && res.data && res.data.length > 0) {
                setLiveStreamers(res.data);
                setIsHidden(false);
            } else {
                setIsHidden(true);
            }
        };

        fetchLive();
        const interval = setInterval(fetchLive, 1000 * 60 * 5); // 5 mins
        return () => clearInterval(interval);
    }, [guildId]);

    const handleDismiss = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.setItem(`live-badge-dismissed-${guildId}`, Date.now().toString());
        setIsDismissed(true);
    };

    if (isHidden || isDismissed || liveStreamers.length === 0) return null;

    const count = liveStreamers.length;
    const first = liveStreamers[0];
    const text = count === 1 ? `${first.creatorId} est en LIVE` : `${count} Créateurs en LIVE`;

    return (
        <div className="relative group/badge">
            <a
                href={count === 1 ? first.url : `/dashboard/${guildId}/ressources`}
                target={count === 1 ? "_blank" : "_self"}
                rel={count === 1 ? "noopener noreferrer" : ""}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 transition-all duration-300 group shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]",
                    "animate-in fade-in slide-in-from-top-2 duration-700"
                )}
            >
                {/* Status Dot */}
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>

                <Tv className="w-3.5 h-3.5 text-red-500" />

                <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none whitespace-nowrap">
                    {text}
                </span>

                {/* Dismiss Button */}
                <button
                    onClick={handleDismiss}
                    className="ml-1 p-0.5 rounded-full hover:bg-black/20 text-white/30 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    title="Cacher pour 4h"
                >
                    <X className="w-2.5 h-2.5" />
                </button>
            </a>

            {/* Ambient Glow */}
            <div className="absolute -inset-1 bg-red-500/5 blur-lg rounded-full -z-10 group-hover:bg-red-500/10 transition-colors" />
        </div>
    );
}
