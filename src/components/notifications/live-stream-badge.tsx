"use client";

import { useEffect, useState } from "react";
import { Tv, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLiveStreamers } from "@/server/actions/feed-actions";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LiveStreamer {
    creatorId: string;
    url: string;
    title: string;
    avatarUrl?: string | null;
}

export function LiveStreamBadge({ guildId }: { guildId: string }) {
    const [liveStreamers, setLiveStreamers] = useState<LiveStreamer[]>([]);
    const [isHidden, setIsHidden] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
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
        const interval = setInterval(fetchLive, 1000 * 60 * 5);
        return () => clearInterval(interval);
    }, [guildId]);

    const handleDismiss = (e: React.SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.setItem(`live-badge-dismissed-${guildId}`, Date.now().toString());
        setIsDismissed(true);
    };

    const handleBadgeClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (liveStreamers.length === 1) {
            // Single streamer: open directly
            window.open(liveStreamers[0].url, "_blank", "noopener");
        } else {
            // Multiple: show picker modal
            setIsModalOpen(true);
        }
    };

    if (isHidden || isDismissed || liveStreamers.length === 0) return null;

    const count = liveStreamers.length;
    const first = liveStreamers[0];
    const text = count === 1 ? `${first.creatorId} est en LIVE` : `${count} Créateurs en LIVE`;

    return (
        <>
            <div className="relative group/badge">
                <button
                    onClick={handleBadgeClick}
                    className={cn(
                        "flex h-8 items-center gap-2 px-3 rounded-full bg-danger/10 border border-danger/20 hover:bg-danger/15 transition-colors shrink-0 cursor-pointer",
                        "animate-in fade-in duration-150"
                    )}
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
                    </span>

                    <Tv className="w-3 h-3 text-danger" />

                    <span className="text-caption font-semibold uppercase tracking-wider text-foreground leading-none whitespace-nowrap">
                        {text}
                    </span>

                    <span
                        role="button"
                        tabIndex={0}
                        onClick={handleDismiss}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDismiss(e);
                            }
                        }}
                        className="ml-1 p-0.5 rounded-full hover:bg-black/20 text-foreground/20 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Cacher pour 4h"
                        aria-label="Cacher pour 4h"
                    >
                        <X className="w-2.5 h-2.5" />
                    </span>
                </button>
            </div>

            {/* Streamer Picker Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="w-[90vw] max-w-sm bg-background border border-border p-0 overflow-hidden shadow-2xl rounded-2xl">
                    <div className="p-4 border-b border-border bg-surface">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0">
                                <Tv className="h-4 w-4 text-danger" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-wider truncate">Créateurs en LIVE</DialogTitle>
                                <p className="text-caption text-muted-foreground font-medium">Choisis un streamer à regarder</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto">
                        {liveStreamers.map((streamer) => (
                            <a
                                key={streamer.creatorId}
                                href={streamer.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl bg-elevated/30 hover:bg-elevated/60 border border-border hover:border-danger/30 transition-all group"
                            >
                                <div className="relative shrink-0">
                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={streamer.avatarUrl || undefined} className="object-cover" />
                                            <AvatarFallback className="bg-danger/20 text-danger text-xs font-black">
                                                {streamer.creatorId?.[0]?.toUpperCase() || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-danger border-2 border-zinc-900 animate-pulse" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-foreground group-hover:text-foreground uppercase tracking-tight truncate">
                                        {streamer.creatorId}
                                    </p>
                                    <p className="text-caption text-muted-foreground font-bold truncate mt-0.5">
                                        {streamer.title || "En direct"}
                                    </p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-danger/50 group-hover:text-danger shrink-0 transition-colors" />
                            </a>
                        ))}
                    </div>

                    {liveStreamers.length > 1 && (
                        <div className="px-4 pb-4">
                            <a
                                href={`/dashboard/${guildId}/ressources?tab=creators`}
                                className="block w-full text-center py-2.5 rounded-xl bg-surface hover:bg-surface text-muted-foreground hover:text-foreground text-xs font-black uppercase tracking-wider transition-all border border-border"
                            >
                                Voir tous les créateurs
                            </a>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}