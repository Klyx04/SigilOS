"use client";

import { Tv, Loader2, Youtube, MonitorPlay, Sparkles } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { getContentCreators } from "@/server/actions/resources-actions";
import { getAggregatedFeed } from "@/server/actions/feed-actions";

interface Creator {
    id?: string;
    name: string;
    role: string;
    youtube?: string | null;
    twitch?: string | null;
    handle?: string | null;
    color: string;
    order: number;
}

/**
 * Déslop + gouvernance 10/10/2026 — vitrine **lecture seule** : la gestion (ajout,
 * édition, suppression + modales) vit côté God, plus ici. Aucune RBAC requise pour
 * lire (le module reste soumis à `canViewResources` par la page).
 */
export function CreatorsWidget({
    guildId,
}: {
    guildId: string;
}) {
    const [creators, setCreators] = useState<Creator[]>([]);
    const [liveData, setLiveData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            // 1. Get creators from DB
            const data = await getContentCreators(guildId);
            setCreators(data || []);

            // 2. Get status/feed data
            const res = await getAggregatedFeed(guildId);
            if (res.success && res.data) {
                setLiveData(res.data);
            }
        } catch {
            // Silently fail — component shows empty state gracefully

        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        load();
    }, [load]);

    const getCreatorActivity = (handle?: string | null) => {
        if (!handle || !liveData.length) return { status: "offline" };
        const h = handle.toLowerCase().replace('@', '').trim();

        // Filter live items for this handle
        const creatorItems = liveData.filter(d =>
            d.creatorId?.toLowerCase().includes(h)
        );

        if (creatorItems.length === 0) return { status: "offline" };

        // Check Twitch Live status
        const liveStream = creatorItems.find(i => i.type === "TWITCH");
        if (liveStream) return { status: "live", link: liveStream.url, item: liveStream };

        // Check if recent YouTube video (within 48h)
        const sorted = [...creatorItems].sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
        const youngest = sorted[0];
        const ageHours = (new Date().getTime() - new Date(youngest.published).getTime()) / (1000 * 60 * 60);

        if (ageHours < 48) return { status: "video", link: youngest.url, item: youngest };

        return { status: "offline", link: youngest.url, item: youngest };
    };

    if (loading) return (
        <div className="w-full h-40 flex flex-col items-center justify-center bg-surface border border-border rounded-2xl gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Chargement des créateurs...</span>
        </div>
    );

    return (
        <div className="w-full flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center border border-border">
                        <Tv className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground tracking-tight">Créateurs suivis</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-caption text-muted-foreground font-semibold uppercase tracking-widest">Flux communautaire</span>
                            <div className="h-1 w-1 rounded-full bg-muted" />
                            <span className="text-caption text-muted-foreground font-semibold uppercase tracking-widest">{creators.length} créateur(s)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid display with scrollable container */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pr-2 max-h-[700px] overflow-y-auto custom-scrollbar pb-6 px-1">
                {creators.length === 0 ? (
                    <div className="col-span-full py-20 text-center border border-dashed border-border rounded-2xl bg-surface">
                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">Aucun créateur configuré</p>
                    </div>
                ) : creators.map((c) => {
                    const activity = getCreatorActivity(c.handle ?? undefined);
                    const status = activity.status;

                    // Generate an avatar URL based on handle or link
                    let avatarUrl = null;
                    if (c.youtube) {
                        const handleMatch = c.youtube.match(/@([a-zA-Z0-9_-]+)/);
                        if (handleMatch) avatarUrl = `https://unavatar.io/youtube/${handleMatch[1]}?fallback=false`;
                    }
                    if (!avatarUrl && c.twitch) {
                        const twitchName = c.twitch.split('/').pop();
                        if (twitchName) avatarUrl = `https://unavatar.io/twitch/${twitchName}?fallback=false`;
                    }

                    return (
                        <div
                            key={c.id}
                            className="group relative rounded-2xl p-6 border border-border bg-surface/60 transition-colors hover:border-border-strong"
                        >
                            <div
                                className="absolute top-8 left-0 w-1 h-12 rounded-r-full"
                                style={{ background: c.color }}
                            />

                            <div className="flex items-start gap-5 mb-6">
                                <div
                                    className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold relative overflow-hidden shrink-0"
                                    style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}25` }}
                                >
                                    {avatarUrl ? (
                                        <>
                                            <img
                                                src={avatarUrl}
                                                alt={c.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLElement).style.display = 'none';
                                                    (e.target as HTMLElement).nextElementSibling!.classList.remove('hidden');
                                                }}
                                            />
                                            <span className="hidden">
                                                {c.name.substring(0, 2).toUpperCase()}
                                            </span>
                                        </>
                                    ) : (
                                        <span>{c.name.substring(0, 2).toUpperCase()}</span>
                                    )}
                                    {status === "live" && (
                                        <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-danger border-2 border-background animate-pulse z-20" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                    <div className="text-lg font-bold text-foreground truncate">
                                        {c.name}
                                    </div>
                                    <div className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mt-1 truncate">{c.role}</div>
                                </div>
                            </div>

                            <div className="h-10 mb-6 flex items-center">
                                {status === "live" ? (
                                    <a href={activity.link || c.twitch || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-danger bg-danger/10 hover:bg-danger/20 px-4 py-2 rounded-2xl border border-danger/20 w-fit transition-colors">
                                        <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                                        <span className="text-caption font-bold uppercase tracking-widest">En Direct</span>
                                    </a>
                                ) : status === "video" ? (
                                    <a href={activity.link || c.youtube || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-info bg-info/10 hover:bg-info/20 px-4 py-2 rounded-2xl border border-info/20 w-fit transition-colors">
                                        <div className="w-2 h-2 rounded-full bg-info" />
                                        <span className="text-caption font-bold uppercase tracking-widest">Nouveau Contenu</span>
                                    </a>
                                ) : (
                                    <div className="text-muted-foreground text-caption font-semibold uppercase tracking-widest ml-1 opacity-60">Hors ligne</div>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {c.youtube && (
                                    <a href={c.youtube} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-caption font-bold uppercase tracking-widest text-[#ef4444] bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444]/10 transition-colors">
                                        <Youtube className="h-4 w-4" /> YouTube
                                    </a>
                                )}
                                {c.twitch && (
                                    <a href={c.twitch} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-caption font-bold uppercase tracking-widest text-[#a855f7] bg-[#a855f7]/10 hover:bg-[#a855f7]/20 border border-[#a855f7]/10 transition-colors">
                                        <MonitorPlay className="h-4 w-4" /> Twitch
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
