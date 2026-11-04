"use client";

/**
 * Bloc « est en LIVE » de la barre du haut — **déslopé le 02/11/2026**.
 *
 * Ce qui change (et pourquoi) :
 * - la **vraie photo du streamer** remplace la miniature du stream (l'ancien code mettait
 *   `thumbnailUrl` dans `avatarUrl` : ce n'était pas un visage) ;
 * - la **marque** (Twitch) est un SVG local, pas une icône lucide dépréciée ;
 * - un seul accent (`danger`), rayons ≤ 12 px, plus de `font-black`, plus de double
 *   `animate-ping` : règle de deslop de `docs/RULES.md`.
 *
 * Aucune donnée inventée : si l'avatar manque, on retombe sur la marque, jamais sur un faux.
 */
import { useEffect, useState } from "react";
import { X, ExternalLink, Eye } from "lucide-react";
import { getLiveStreamers } from "@/server/actions/feed-actions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TwitchIcon } from "@/components/icons/brand-icons";

interface LiveStreamer {
    creatorId: string;
    url: string;
    title: string;
    avatarUrl?: string | null;
    gameName?: string | null;
    viewers?: number | null;
    platform?: "TWITCH" | string;
    login?: string | null;
}

const DISMISS_MS = 4 * 60 * 60 * 1000;
const POLL_MS = 5 * 60 * 1000;

export function LiveStreamBadge({ guildId }: { guildId: string }) {
    const [liveStreamers, setLiveStreamers] = useState<LiveStreamer[]>([]);
    const [isHidden, setIsHidden] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const lastDismiss = localStorage.getItem(`live-badge-dismissed-${guildId}`);
        if (lastDismiss) {
            const dismissTime = parseInt(lastDismiss, 10);
            if (Number.isFinite(dismissTime) && Date.now() - dismissTime < DISMISS_MS) {
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
                setLiveStreamers([]);
                setIsHidden(true);
            }
        };

        fetchLive();
        const interval = setInterval(fetchLive, POLL_MS);
        return () => clearInterval(interval);
    }, [guildId]);

    const handleDismiss = (event: React.SyntheticEvent) => {
        event.preventDefault();
        event.stopPropagation();
        localStorage.setItem(`live-badge-dismissed-${guildId}`, Date.now().toString());
        setIsDismissed(true);
    };

    const handleBadgeClick = (event: React.MouseEvent) => {
        event.preventDefault();
        if (liveStreamers.length === 1) {
            window.open(liveStreamers[0].url, "_blank", "noopener");
        } else {
            setIsModalOpen(true);
        }
    };

    if (isHidden || isDismissed || liveStreamers.length === 0) return null;

    const count = liveStreamers.length;
    const first = liveStreamers[0];
    const label = count === 1 ? `${first.creatorId} est en live` : `${count} créateurs en live`;

    return (
        <>
            <div className="relative group/badge shrink-0">
                <button
                    type="button"
                    onClick={handleBadgeClick}
                    aria-label={
                        count === 1
                            ? `${first.creatorId} est en direct — ouvrir le stream`
                            : `${count} créateurs en direct — voir la liste`
                    }
                    className="flex h-9 items-center gap-2 pl-1 pr-2.5 rounded-xl bg-danger/10 border border-danger/20 hover:bg-danger/15 transition-colors cursor-pointer"
                >
                    <span className="relative flex h-6 w-6 items-center justify-center shrink-0">
                        {first.avatarUrl ? (
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={first.avatarUrl} alt="" className="object-cover" />
                                <AvatarFallback className="bg-danger/15 text-danger text-[10px] font-semibold">
                                    {first.creatorId?.[0]?.toUpperCase() ?? "?"}
                                </AvatarFallback>
                            </Avatar>
                        ) : (
                            <TwitchIcon className="h-3.5 w-3.5 text-danger" />
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
                    </span>

                    <span className="hidden xl:inline text-xs font-semibold text-foreground max-w-[190px] truncate">{label}</span>

                    {count > 1 && (
                        <span className="text-[10px] font-semibold text-danger bg-danger/15 rounded-md px-1.5 py-0.5">
                            {count}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Masquer les annonces de live pendant 4 heures"
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-surface border border-border text-muted-foreground hover:text-foreground items-center justify-center hidden group-hover/badge:flex"
                >
                    <X className="h-2.5 w-2.5" />
                </button>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="w-[min(420px,calc(100vw-2rem))] p-0 gap-0 overflow-hidden rounded-xl">
                    <div className="flex items-center gap-3 p-4 border-b border-border">
                        <span className="h-9 w-9 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0">
                            <TwitchIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="text-sm font-semibold text-foreground">Créateurs en direct</DialogTitle>
                            <p className="text-caption text-muted-foreground">Choisis le stream à regarder</p>
                        </div>
                    </div>

                    <div className="p-2 max-h-[320px] overflow-y-auto">
                        {liveStreamers.map((streamer) => (
                            <a
                                key={streamer.creatorId}
                                href={streamer.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-elevated/50 transition-colors group"
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={streamer.avatarUrl || undefined} alt="" className="object-cover" />
                                        <AvatarFallback className="bg-danger/15 text-danger text-xs font-semibold">
                                            {streamer.creatorId?.[0]?.toUpperCase() || "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-background" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                                        {streamer.creatorId}
                                        <TwitchIcon className="h-3 w-3 text-[#9146FF] shrink-0" />
                                    </p>
                                    <p className="text-caption text-muted-foreground truncate">{streamer.title || "En direct"}</p>
                                    {(streamer.gameName || typeof streamer.viewers === "number") && (
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                            {streamer.gameName && <span className="truncate">{streamer.gameName}</span>}
                                            {typeof streamer.viewers === "number" && (
                                                <span className="flex items-center gap-1 shrink-0">
                                                    <Eye className="h-3 w-3" />
                                                    {streamer.viewers.toLocaleString("fr-FR")}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>

                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                            </a>
                        ))}
                    </div>

                    {liveStreamers.length > 1 && (
                        <div className="px-2 pb-2">
                            <a
                                href={`/dashboard/${guildId}/ressources?tab=creators`}
                                className="block w-full text-center py-2 rounded-lg bg-elevated/50 hover:bg-elevated text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
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
