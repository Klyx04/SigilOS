"use client";

import { useEffect, useState } from "react";
import { Tv, ExternalLink, Rss, CirclePlay, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getAggregatedFeed, markFeedAsRead } from "@/server/actions/feed-actions";
import { ExtractedContent } from "@/lib/feed-aggregators";
import Link from "next/link";
import { toast } from "sonner";

export function FeedBell({ guildId, className }: { guildId: string, className?: string }) {
    const [feed, setFeed] = useState<ExtractedContent[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFeed = async (force = false) => {
        setIsLoading(true);
        const res = await getAggregatedFeed(guildId, force);
        if (res.success && res.data) {
            setFeed(res.data as any);
            // If the popover is currently open, we consider everything seen
            if (!isOpen) {
                setUnreadCount(res.unreadCount || 0);
            } else {
                setUnreadCount(0);
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchFeed();
        // Since it's a "Lazy Pull" system, polling too often is fine, 
        // the server won't hammer external APIs unless cache expires.
        const interval = setInterval(fetchFeed, 60000 * 5); // check every 5 mins
        return () => clearInterval(interval);
    }, [guildId]);

    const handleOpenChange = async (open: boolean) => {
        setIsOpen(open);
        if (open && unreadCount > 0) {
            // Mark as read when opening the popover
            await markFeedAsRead(guildId);
            setUnreadCount(0);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case "YOUTUBE": return <CirclePlay className="w-4 h-4 text-danger" />;
            case "TWITCH": return <Tv className="w-4 h-4 text-info" />;
            case "NEWS": return <Rss className="w-4 h-4 text-success" />;
            default: return <Rss className="w-4 h-4 text-muted-foreground" />;
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("relative text-muted-foreground hover:text-foreground transition-colors", className)}>
                    <Rss className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 z-10 flex min-w-[1rem] h-4 px-1 items-center justify-center rounded-full bg-success text-[9px] font-black text-success-foreground ring-2 ring-background animate-in zoom-in duration-200 shadow-sm">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Nouveautés Communauté</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-84 p-0 overflow-hidden rounded-2xl border border-border bg-popover/98 backdrop-blur-xl shadow-2xl" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
                    <div className="flex items-center gap-2">
                        <Rss className="h-4 w-4 text-success" />
                        <h4 className="font-bold text-xs uppercase tracking-widest text-foreground">Créateurs & Dofus</h4>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-caption font-bold uppercase tracking-wider text-muted-foreground hover:text-success hover:bg-success/10 gap-1.5 transition-colors"
                        onClick={async (e) => { 
                            e.stopPropagation(); 
                            await fetchFeed(true); 
                            // After a manual refresh while looking at it, mark all as read again 
                            // to ensure the badge doesn't pop back up due to fresh timestamps
                            await markFeedAsRead(guildId);
                            setUnreadCount(0);
                        }}
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                        RAFRAÎCHIR
                    </Button>
                </div>

                <ScrollArea className="h-[350px]">
                    {isLoading && feed.length === 0 ? (
                        <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-4">
                            <span className="animate-pulse">Analyse des flux...</span>
                        </div>
                    ) : feed.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-4">
                            <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center">
                                <Rss className="h-6 w-6 opacity-30 text-muted-foreground" />
                            </div>
                            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Aucune nouveauté</p>
                        </div>
                    ) : (
                        <div className="grid divide-y divide-border">
                            {feed.map((n, i) => (
                                <a
                                    key={i}
                                    href={n.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-4 hover:bg-elevated/50 transition-colors flex items-start gap-3 group"
                                >
                                    <div className="mt-1 h-8 w-8 rounded-lg bg-surface border border-border flex items-center justify-center overflow-hidden shrink-0 relative">
                                        {n.thumbnail ? (
                                            <img
                                                src={n.thumbnail}
                                                alt={n.creatorId}
                                                referrerPolicy="no-referrer"
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                            />
                                        ) : (
                                            getIcon(n.type)
                                        )}
                                    </div>
                                    <div className="space-y-1 overflow-hidden flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            {getIcon(n.type)}
                                            <span className="text-caption uppercase font-bold tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                                                {n.creatorId}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-foreground leading-tight truncate group-hover:text-foreground transition-colors">{n.title}</p>
                                        <p className="text-caption text-muted-foreground font-mono pt-1">
                                            {new Date(n.published).toLocaleDateString("fr-FR")} à {new Date(n.published).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1 opacity-0 group-hover:opacity-100" />
                                </a>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t border-border bg-surface">
                    <Button variant="ghost" size="sm" className="w-full text-caption font-bold uppercase tracking-wider h-9 hover:bg-elevated hover:text-foreground transition-colors" asChild>
                        <Link href={`/dashboard/${guildId}/ressources`}>
                            Ouvrir le module Ressources
                        </Link>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
