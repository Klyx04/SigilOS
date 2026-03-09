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
            // For now, simplify or use actual unread check
            setUnreadCount(res.unreadCount || 0);
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
            case "YOUTUBE": return <CirclePlay className="w-4 h-4 text-red-500" />;
            case "TWITCH": return <Tv className="w-4 h-4 text-purple-500" />;
            case "NEWS": return <Rss className="w-4 h-4 text-emerald-500" />;
            default: return <Rss className="w-4 h-4 text-zinc-500" />;
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("relative text-zinc-400 hover:text-white transition-colors", className)}>
                    <Rss className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white ring-2 ring-zinc-950 animate-in zoom-in duration-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Nouveautés Communauté</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl border-white/10 bg-[#0d0f11]/95 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.7)]" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-emerald-500/10 to-transparent">
                    <div className="flex items-center gap-2">
                        <Rss className="h-4 w-4 text-emerald-500" />
                        <h4 className="font-bold text-xs uppercase tracking-widest text-white">Créateurs & Dofus</h4>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[8px] font-black uppercase tracking-widest text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 transition-all"
                        onClick={(e) => { e.stopPropagation(); fetchFeed(true); }}
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                        RAFRAÎCHIR
                    </Button>
                </div>

                <ScrollArea className="h-[350px]">
                    {isLoading && feed.length === 0 ? (
                        <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center gap-4">
                            <span className="animate-pulse">Analyse des flux...</span>
                        </div>
                    ) : feed.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-zinc-500 gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                <Rss className="h-6 w-6 opacity-20" />
                            </div>
                            <p className="text-xs font-medium uppercase tracking-widest">Aucune nouveauté</p>
                        </div>
                    ) : (
                        <div className="grid divide-y divide-white/5">
                            {feed.map((n, i) => (
                                <a
                                    key={i}
                                    href={n.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-4 hover:bg-white/[0.03] transition-colors flex items-start gap-3 group"
                                >
                                    <div className="mt-1 h-8 w-8 rounded bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative">
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
                                        <div className="absolute inset-0 ring-1 ring-inset ring-black/50 pointer-events-none" />
                                    </div>
                                    <div className="space-y-1 overflow-hidden">
                                        <div className="flex items-center gap-1.5">
                                            {getIcon(n.type)}
                                            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400 group-hover:text-zinc-300 transition-colors">
                                                {n.creatorId}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-zinc-100 leading-tight group-hover:text-white transition-colors">{n.title}</p>
                                        <p className="text-[10px] text-zinc-600 font-mono pt-1">
                                            {new Date(n.published).toLocaleDateString()} à {new Date(n.published).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-white/60 transition-colors shrink-0 mt-1 opacity-0 group-hover:opacity-100" />
                                </a>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t border-white/5 bg-white/5">
                    <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest h-10 hover:bg-white/5 hover:text-white transition-all" asChild>
                        <Link href={`/dashboard/${guildId}/ressources`}>
                            Ouvrir le module Ressources
                        </Link>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
