"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, Newspaper, Zap, Scroll, Shield, Sparkles, Globe2, ChevronDown, RefreshCw, Rss, Send, Globe, CheckCircle2, XCircle, Bell, Megaphone, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { KralamoureWidget } from "@/components/ressources/KralamoureWidget";
import { useParams } from "next/navigation";
import { getUserContext, type UserContext } from "@/server/actions/user-actions";
import { sendNewsToDiscord, broadcastNewsToAllGuilds, type DiscordNewsItem } from "@/server/actions/news-discord-actions";
import { toast } from "sonner";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";


// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
    title: string;
    link: string;
    pubDate: string;
    description: string;
    imageUrl?: string;
    category?: string;
}

// ─── Feed options ─────────────────────────────────────────────────────────────

const FEEDS = [
    { key: "news", label: "Actualités", icon: Rss, color: "#3b82f6" },
    { key: "changelog", label: "Changelog", icon: Scroll, color: "#10b981" },
    { key: "devblog", label: "Devblog", icon: Zap, color: "#a855f7" },
    { key: "dpln", label: "Guides & Quêtes (DPLN)", icon: Scroll, color: "#f59e0b" },
] as const;

type FeedKey = typeof FEEDS[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_FR = ["jan.", "fév.", "mar.", "avr.", "mai", "jun.", "jul.", "aoû.", "sep.", "oct.", "nov.", "déc."];

function formatPubDate(raw: string): string {
    if (!raw) return "";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const CARD_PALETTE = [
    { from: "#1a0a2e", accent: "#a855f7", icon: Sparkles },
    { from: "#0a1a2e", accent: "#3b82f6", icon: Zap },
    { from: "#1a1000", accent: "#f59e0b", icon: Scroll },
    { from: "#0a1a10", accent: "#10b981", icon: Shield },
    { from: "#1a0a10", accent: "#ef4444", icon: Globe2 },
    { from: "#0f0a1a", accent: "#8b5cf6", icon: Zap },
];

// ─── News Actions Subcomponent ────────────────────────────────────────────────

function NewsActions({ 
    item, 
    userCtx, 
    sending, 
    handleSendToDiscord, 
    handleBroadcast, 
    broadcasting,
    variant = "default"
}: { 
    item: NewsItem; 
    userCtx: UserContext | null; 
    sending: string | null;
    handleSendToDiscord: (item: NewsItem) => void;
    handleBroadcast: (item: NewsItem) => void;
    broadcasting: boolean;
    variant?: "default" | "minimal"
}) {
    // Only show to admins if enabled, or if SuperAdmin
    if (!userCtx?.isAdmin) return null;
    if (!userCtx.newsBroadcastEnabled && !userCtx.isSuperAdmin) return null;

    const isSending = sending === item.link;

    return (
        <div className={cn(
            "flex items-center gap-2 transition-all duration-300",
            variant === "default" ? "opacity-0 group-hover:opacity-100" : "opacity-40 group-hover:opacity-100"
        )}>
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSendToDiscord(item); }}
                disabled={isSending}
                className={cn(
                    "rounded-lg transition-all disabled:opacity-50",
                    variant === "default" 
                        ? "p-2 bg-[#5865F2]/10 border border-[#5865F2]/20 text-[#5865F2] hover:bg-[#5865F2] hover:text-foreground"
                        : "p-1.5 bg-surface border border-border text-muted-foreground hover:text-[#5865F2] hover:border-[#5865F2]/30"
                )}
                title="Partager sur Discord"
            >
                <Bell className={cn(variant === "default" ? "w-4 h-4" : "w-3.5 h-3.5", isSending && "animate-spin")} />
            </button>
            
            {userCtx?.isSuperAdmin && (
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBroadcast(item); }}
                    disabled={broadcasting}
                    className={cn(
                        "rounded-lg transition-all disabled:opacity-50",
                        variant === "default" 
                            ? "p-2 bg-warning/10 border border-warning/20 text-warning hover:bg-warning hover:text-warning-foreground"
                            : "p-1.5 bg-surface border border-border text-muted-foreground hover:text-warning hover:border-warning/30"
                    )}
                    title="Diffuser à toutes les guildes (GOD MODE)"
                >
                    <Megaphone className={cn(variant === "default" ? "w-4 h-4" : "w-3.5 h-3.5", broadcasting && "animate-pulse")} />
                </button>
            )}
        </div>
    );
}

// ─── Featured card ────────────────────────────────────────────────────────────

function FeaturedCard({ 
    item, 
    feedColor, 
    feedLabel,
    userCtx,
    sending,
    handleSendToDiscord,
    handleBroadcast,
    broadcasting
}: { 
    item: NewsItem; 
    feedColor: string; 
    feedLabel: string;
    userCtx: UserContext | null;
    sending: string | null;
    handleSendToDiscord: (item: NewsItem) => void;
    handleBroadcast: (item: NewsItem) => void;
    broadcasting: boolean;
}) {
    const [imgError, setImgError] = useState(false);
    const grad = CARD_PALETTE[0];

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-2xl cursor-pointer block"
            style={{
                background: `linear-gradient(135deg, ${grad.from} 0%, #0d1117 100%)`,
                border: `1px solid ${feedColor}20`,
            }}
        >
            {/* Ambient glow on hover */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                style={{ background: `radial-gradient(ellipse at 20% 50%, ${feedColor}12, transparent 60%)` }}
            />

            {/* Image / Placeholder */}
            <div className="relative h-52 lg:h-60 overflow-hidden">
                {item.imageUrl && !imgError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group- transition-transform duration-300"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${grad.from}, #0d1117)` }}>
                        {/* Decorative orbs */}
                        <div className="absolute w-48 h-48 rounded-full blur-3xl opacity-20"
                            style={{ background: feedColor, top: "10%", left: "20%" }} />
                        <div className="absolute w-32 h-32 rounded-full blur-2xl opacity-10"
                            style={{ background: feedColor, bottom: "10%", right: "15%" }} />
                        {/* SVG lines */}
                        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 240">
                            <path d="M0 120 L400 80" stroke={feedColor} strokeWidth="1" />
                            <path d="M0 160 L400 120" stroke={feedColor} strokeWidth="0.5" />
                            <circle cx="200" cy="120" r="60" fill="none" stroke={feedColor} strokeWidth="0.5" />
                            <circle cx="200" cy="120" r="100" fill="none" stroke={feedColor} strokeWidth="0.3" />
                        </svg>
                        {/* Center icon / Logo */}
                        <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden bg-black/40 border border-border group- transition-transform duration-300 shadow-2xl">
                                <img src="/assets/ui/logo-v2.png" alt="SigilOS" className="w-12 h-12 object-contain" />
                            </div>
                            <span className="text-caption font-black uppercase tracking-widest text-foreground/40">{feedLabel}</span>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent pointer-events-none" />
                
                {/* ACTIONS TOP RIGHT */}
                <div className="absolute top-4 right-4 z-20">
                    {feedLabel !== "Changelog" && (
                        <NewsActions 
                            item={item} 
                            userCtx={userCtx} 
                            sending={sending} 
                            handleSendToDiscord={handleSendToDiscord} 
                            handleBroadcast={handleBroadcast} 
                            broadcasting={broadcasting}
                        />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="relative p-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                    {item.category && (
                        <span className="text-caption font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{ background: `${feedColor}15`, color: feedColor, border: `1px solid ${feedColor}30` }}>
                            {item.category}
                        </span>
                    )}
                    {item.pubDate && (
                        <span className="text-caption text-muted-foreground">{formatPubDate(item.pubDate)}</span>
                    )}
                </div>
                <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-3 group-hover:opacity-80 transition-opacity">
                    {item.title}
                </h3>
                {item.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider group-hover:gap-3 transition-all"
                    style={{ color: feedColor }}>
                    Lire l&apos;article <ExternalLink className="h-3 w-3" />
                </div>
            </div>
        </a>
    );
}

// ─── Side card ────────────────────────────────────────────────────────────────

function SideCard({ 
    item, 
    idx, 
    feedColor,
    userCtx,
    sending,
    handleSendToDiscord,
    handleBroadcast,
    broadcasting
}: { 
    item: NewsItem; 
    idx: number; 
    feedColor: string;
    userCtx: UserContext | null;
    sending: string | null;
    handleSendToDiscord: (item: NewsItem) => void;
    handleBroadcast: (item: NewsItem) => void;
    broadcasting: boolean;
}) {
    const [imgError, setImgError] = useState(false);
    const grad = CARD_PALETTE[(idx + 1) % CARD_PALETTE.length];

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 p-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-surface"
            style={{ border: "1px solid rgba(255,255,255,0.03)" }}
        >
            <div className="relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${grad.from}, #0d1117)`, border: `1px solid ${grad.accent}20` }}>
                {item.imageUrl && !imgError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group- transition-transform duration-300"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <img src="/assets/ui/logo-v2.png" alt="SigilOS" className="w-8 h-8 object-contain opacity-40 group-hover:opacity-100 group- transition-all duration-300" />
                )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
                {item.pubDate && (
                    <time className="text-caption font-bold uppercase tracking-widest text-muted-foreground block">
                        {formatPubDate(item.pubDate)}
                    </time>
                )}
                <h4 className="text-sm font-semibold text-foreground group-hover:opacity-75 transition-opacity leading-tight line-clamp-2">
                    {item.title}
                </h4>
            </div>
            
            {feedColor !== "#10b981" && ( /* Changelog color */
                <div className="flex flex-col items-end gap-2 h-full justify-between py-1">
                    <NewsActions 
                        item={item} 
                        userCtx={userCtx} 
                        sending={sending} 
                        handleSendToDiscord={handleSendToDiscord} 
                        handleBroadcast={handleBroadcast} 
                        broadcasting={broadcasting}
                        variant="minimal"
                    />
                </div>
            )}
        </a>
    );
}

// ─── List item card ───────────────────────────────────────────────────────────

function ListCard({ 
    item, 
    userCtx, 
    currentFeed, 
    sending, 
    handleSendToDiscord, 
    handleBroadcast, 
    broadcasting 
}: { 
    item: NewsItem; 
    userCtx: UserContext | null; 
    currentFeed: any; 
    sending: string | null; 
    handleSendToDiscord: (item: NewsItem) => void; 
    handleBroadcast: (item: NewsItem) => void; 
    broadcasting: boolean;
}) {
    const [imgError, setImgError] = useState(false);

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center gap-6 p-3 rounded-2xl bg-background/20 border border-border hover:bg-surface transition-all duration-300"
        >
            {/* Dot / Timeline */}
            <div className="relative z-10 w-24 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-surface border border-border group-hover:border-warning/30 transition-colors flex items-center justify-center">
                {item.imageUrl && !imgError ? (
                    <img 
                        src={item.imageUrl} 
                        alt="" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group- transition-transform duration-300" 
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-warning/10 to-transparent">
                        {currentFeed.key === "changelog" ? (
                            <img src="/module-dofus/Dofus_Emeraude.png" alt="" className="w-10 h-10 object-contain opacity-80" />
                        ) : (
                            <Scroll className="w-6 h-6" style={{ color: currentFeed.color, opacity: 0.5 }} />
                        )}
                        <Zap className="absolute top-2 right-2 w-3 h-3 text-warning animate-pulse" />
                    </div>
                )}
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                    <span className="text-caption font-black uppercase tracking-widest text-muted-foreground">
                        {formatPubDate(item.pubDate)}
                    </span>
                    <div className="h-px w-8 bg-surface" />
                </div>
                <h4 className="text-base font-bold text-foreground group-hover:text-warning transition-colors line-clamp-1">
                    {item.title}
                </h4>
            </div>

            {currentFeed.key !== "changelog" && (
                <NewsActions 
                    item={item} 
                    userCtx={userCtx} 
                    sending={sending} 
                    handleSendToDiscord={handleSendToDiscord} 
                    handleBroadcast={handleBroadcast} 
                    broadcasting={broadcasting}
                />
            )}

            <div className="px-4 py-1.5 rounded-lg bg-surface border border-border text-caption font-bold uppercase tracking-widest text-muted-foreground group-hover:text-warning group-hover:border-warning/20 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                Détails
            </div>
            <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity ml-2 mr-2" />
        </a>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-3 rounded-2xl bg-surface animate-pulse" style={{ minHeight: 380 }} />
            <div className="lg:col-span-2 flex flex-col gap-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-white/3 animate-pulse" />
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewsGrid({
    defaultFeed = "news",
    hideSelector = false,
    title,
    maxItems = 8,
    showKralamoure = false,
    layout = "grid"
}: {
    defaultFeed?: FeedKey;
    hideSelector?: boolean;
    title?: string;
    maxItems?: number;
    showKralamoure?: boolean;
    layout?: "grid" | "list";
}) {
    const [activeFeed, setActiveFeed] = useState<FeedKey>(defaultFeed);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [items, setItems] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userCtx, setUserCtx] = useState<UserContext | null>(null);
    const [sending, setSending] = useState<string | null>(null); // URL of item being sent
    const [broadcasting, setBroadcasting] = useState(false);
    const [previewItem, setPreviewItem] = useState<{ item: NewsItem, type: "SEND" | "BROADCAST" } | null>(null);
    const [targetChannelName, setTargetChannelName] = useState<string>("annonces");

    const params = useParams();
    const discordGuildId = params.guildId as string;


    useEffect(() => {
        getUserContext(discordGuildId).then(setUserCtx);
        
        // Fetch News Target Channel name via server action
        import("@/server/actions/news-discord-actions").then(({ getNewsTargetChannelName }) => {
            getNewsTargetChannelName(discordGuildId).then(res => {
                if (res.success && res.channelName) {
                    setTargetChannelName(res.channelName);
                }
            }).catch(() => {});
        }).catch(() => {});
    }, [discordGuildId]);


    const currentFeed = FEEDS.find(f => f.key === activeFeed) ?? FEEDS[0];

    const handleSendToDiscord = async (item: NewsItem) => {
        setPreviewItem({ item, type: "SEND" });
    };

    const handleBroadcast = async (item: NewsItem) => {
        setPreviewItem({ item, type: "BROADCAST" });
    };

    const confirmSendToDiscord = async (item: NewsItem) => {
        if (!discordGuildId) return;
        setSending(item.link);
        setPreviewItem(null);
        
        try {
            const res = await sendNewsToDiscord(discordGuildId, {
                title: item.title,
                url: item.link,
                imageUrl: item.imageUrl,
                description: item.description,
                pubDate: item.pubDate,
                category: currentFeed.label
            });

            if (res.success) {
                toast.success("Envoyé sur Discord !");
            } else {
                toast.error("Échec de l'envoi: " + (res.error || "Une erreur est survenue."));
            }
        } catch (err) {
            toast.error("Impossible de contacter l'API Discord.");
        } finally {
            setSending(null);
        }
    };

    const confirmBroadcast = async (item: NewsItem) => {
        if (!userCtx?.isSuperAdmin) return;
        setBroadcasting(true);
        setPreviewItem(null);
        
        try {
            const res = await broadcastNewsToAllGuilds({
                title: item.title,
                url: item.link,
                imageUrl: item.imageUrl,
                description: item.description,
                pubDate: item.pubDate,
                category: currentFeed.label
            });

            if (res.success) {
                toast.success(`Diffusion terminée ! (${res.results?.success} guildes)`);
            }
        } catch (err) {
            toast.error("Échec de la diffusion critique.");
        } finally {
            setBroadcasting(false);
        }
    };

    const fetchNews = useCallback(async (feedKey: FeedKey) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/resources/news?feed=${feedKey}`, {
                cache: "no-store",
            });
            const data = await res.json() as { items: NewsItem[]; error?: string };
            if (data.error && !data.items?.length) {
                setError("Flux temporairement indisponible.");
            } else {
                setItems(data.items ?? []);
            }
        } catch {
            setError("Impossible de charger le flux RSS.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews(activeFeed);
    }, [activeFeed, fetchNews]);

    const [featured, ...rest] = items;

    return (
        <div className="space-y-4">
            {/* ── Header / Selector ─────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                {title ? (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${currentFeed.color}15`, border: `1px solid ${currentFeed.color}30` }}>
                            <currentFeed.icon className="h-4 w-4" style={{ color: currentFeed.color }} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{title}</h3>
                    </div>
                ) : !hideSelector ? (
                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(o => !o)}
                            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-surface"
                            style={{
                                background: `${currentFeed.color}10`,
                                border: `1px solid ${currentFeed.color}25`,
                                color: currentFeed.color,
                            }}
                        >
                            <currentFeed.icon className="h-3.5 w-3.5" />
                            {currentFeed.label}
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", dropdownOpen && "rotate-180")} />
                        </button>

                        {dropdownOpen && (
                            <div
                                className="absolute top-full mt-2 left-0 z-50 min-w-[160px] rounded-xl overflow-hidden shadow-2xl"
                                style={{ background: "#13171A", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                                {FEEDS.map((feed) => (
                                    <button
                                        key={feed.key}
                                        onClick={() => { setActiveFeed(feed.key); setDropdownOpen(false); }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-all hover:bg-surface",
                                            activeFeed === feed.key ? "font-bold" : "font-medium text-muted-foreground"
                                        )}
                                        style={activeFeed === feed.key ? { color: feed.color } : {}}
                                    >
                                        <feed.icon className="h-3.5 w-3.5" />
                                        {feed.label}
                                        {activeFeed === feed.key && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: feed.color }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div />
                )}

                {/* Refresh */}
                <button
                    onClick={() => fetchNews(activeFeed)}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground transition-all hover:bg-surface disabled:opacity-40"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                    Rafraîchir
                </button>
            </div>

            {/* ── Content ───────────────────────────────────────────── */}
            {loading ? (
                <Skeleton />
            ) : error || !items.length ? (
                <div
                    className="rounded-2xl p-10 flex flex-col items-center justify-center min-h-[200px] text-center gap-4"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: `${currentFeed.color}10`, border: `1px solid ${currentFeed.color}20` }}>
                        <currentFeed.icon className="h-7 w-7" style={{ color: currentFeed.color }} />
                    </div>
                    <div>
                        <p className="text-foreground font-semibold">
                            {error ?? "Aucun article trouvé"}
                        </p>
                        <p className="text-muted-foreground text-sm mt-1">
                            Essaie un autre flux ou rafraîchis
                        </p>
                    </div>
                    <button
                        onClick={() => fetchNews(activeFeed)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{
                            background: `${currentFeed.color}15`,
                            color: currentFeed.color,
                            border: `1px solid ${currentFeed.color}30`,
                        }}
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Réessayer
                    </button>
                </div>
            ) : layout === "list" ? (
                <div className="flex flex-col gap-2 relative">
                    {/* Vertical line connector removed */}
                    
                    {items.slice(0, maxItems).map((item, i) => (
                        <ListCard 
                            key={i} 
                            item={item} 
                            currentFeed={currentFeed}
                            userCtx={userCtx}
                            sending={sending}
                            handleSendToDiscord={handleSendToDiscord}
                            handleBroadcast={handleBroadcast}
                            broadcasting={broadcasting}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-5 items-stretch">
                    {featured && (
                        <div className="lg:col-span-3">
                            <FeaturedCard 
                                item={featured} 
                                feedColor={currentFeed.color} 
                                feedLabel={currentFeed.label} 
                                userCtx={userCtx}
                                sending={sending}
                                handleSendToDiscord={handleSendToDiscord}
                                handleBroadcast={handleBroadcast}
                                broadcasting={broadcasting}
                            />
                            {showKralamoure && <div className="mt-3"><KralamoureWidget /></div>}
                        </div>
                    )}
                    <div className="lg:col-span-2 flex flex-col gap-1 max-h-[500px] lg:max-h-none overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                        {rest.slice(0, maxItems - 1).map((item, i) => (
                            <SideCard 
                                key={i} 
                                item={item} 
                                idx={i} 
                                feedColor={currentFeed.color} 
                                userCtx={userCtx}
                                sending={sending}
                                handleSendToDiscord={handleSendToDiscord}
                                handleBroadcast={handleBroadcast}
                                broadcasting={broadcasting}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* PREVIEW MODAL */}
            <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
                <DialogContent className="max-w-2xl bg-background border-border rounded-[2rem] p-0 overflow-hidden ">
                    <div className="absolute inset-0 bg-gradient-to-br from-info/10 via-transparent to-transparent pointer-events-none" />
                    
                    <DialogHeader className="p-8 pb-4">
                        <div className="flex items-center gap-4 mb-2">
                            <div className={cn(
                                "p-3 rounded-2xl border flex items-center justify-center",
                                previewItem?.type === "BROADCAST" ? "bg-warning/10 border-warning/20" : "bg-info/10 border-info/20"
                            )}>
                                {previewItem?.type === "BROADCAST" ? <Megaphone className="w-5 h-5 text-warning" /> : <Bell className="w-5 h-5 text-info" />}
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground italic">
                                    {previewItem?.type === "BROADCAST" ? "Diffusion Mondiale" : "Notification de Guilde"}
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground font-medium">
                                    {previewItem?.type === "BROADCAST" 
                                        ? "Vous êtes sur le point de diffuser cette annonce à toutes les guildes actives." 
                                        : "Vérifiez le rendu visuel avant l'envoi dans votre salon de notifications."}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-8 py-4 pb-8">
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className={cn(
                                "flex items-center gap-4 p-5 rounded-3xl border shadow-inner transition-all",
                                previewItem?.type === "BROADCAST" ? "bg-warning/5 border-warning/20" : "bg-info/5 border-info/20"
                            )}>
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm",
                                    previewItem?.type === "BROADCAST" ? "bg-warning/10 border-warning/20" : "bg-info/10 border-info/20"
                                )}>
                                    <Hash className={cn("w-6 h-6", previewItem?.type === "BROADCAST" ? "text-warning" : "text-info")} />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-caption font-black uppercase tracking-widest text-muted-foreground">Destination de publication</span>
                                    <span className="text-sm font-bold text-foreground flex items-center gap-2">
                                        Posté dans 
                                        <span className={cn(
                                            "italic font-black",
                                            previewItem?.type === "BROADCAST" ? "text-warning" : "text-info"
                                        )}>
                                            #{previewItem?.type === "BROADCAST" ? "annonces-globales" : targetChannelName}
                                        </span>
                                    </span>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-surface border border-border rounded-2xl">
                                <p className="text-caption text-muted-foreground font-medium leading-relaxed italic">
                                    {previewItem?.type === "BROADCAST" 
                                        ? "⚠️ Cette action est irréversible. Le message sera envoyé simultanément à toutes les guildes ayant configuré SigilOS."
                                        : "Le post inclura le titre, la description et l'image de l'article avec un lien direct vers la source officielle."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 pt-4 bg-surface border-t border-border flex items-center gap-4">
                        <button
                            onClick={() => setPreviewItem(null)}
                            className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={() => previewItem?.type === "BROADCAST" ? confirmBroadcast(previewItem.item) : confirmSendToDiscord(previewItem!.item)}
                            className={cn(
                                "flex-[2] h-12 rounded-xl text-caption font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3",
                                previewItem?.type === "BROADCAST" 
                                    ? "bg-warning hover:bg-warning text-warning-foreground shadow-amber-500/20" 
                                    : "bg-info hover:bg-info text-info-foreground shadow-indigo-600/20"
                            )}
                        >
                            {previewItem?.type === "BROADCAST" ? <Megaphone className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                            {previewItem?.type === "BROADCAST" ? "Diffuser Maintenant" : "Envoyer sur Discord"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
