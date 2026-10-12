"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, Zap, Scroll, ChevronDown, RefreshCw, Rss, Send, Bell, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { KralamoureWidget } from "@/components/ressources/KralamoureWidget";
import { useParams } from "next/navigation";
import { getUserContext, type UserContext } from "@/server/actions/user-actions";
import { sendNewsToDiscord, type DiscordNewsItem } from "@/server/actions/news-discord-actions";
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

// ─── News Actions Subcomponent ────────────────────────────────────────────────

// Déslop 10/10/2026 — l'ancienne `CARD_PALETTE` (dégradés sombres + orbes + lignes SVG
// par carte) est supprimée : carte plate sur tokens, l'info c'est l'image et le titre.

function NewsActions({ 
    item, 
    userCtx, 
    sending, 
    handleSendToDiscord, 
    variant = "default"
}: { 
    item: NewsItem; 
    userCtx: UserContext | null; 
    sending: string | null;
    handleSendToDiscord: (item: NewsItem) => void;
    variant?: "default" | "minimal"
}) {
    // Only show to admins if enabled, or if SuperAdmin
    if (!userCtx?.isAdmin) return null;
    if (!userCtx.newsBroadcastEnabled && !userCtx.isSuperAdmin) return null;

    const isSending = sending === item.link;

    return (
        <div className={cn(
            "flex items-center gap-2 transition-colors",
            variant === "default" ? "opacity-0 group-hover:opacity-100" : "opacity-40 group-hover:opacity-100"
        )}>
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSendToDiscord(item); }}
                disabled={isSending}
                className={cn(
                    "rounded-lg transition-colors disabled:opacity-50",
                    variant === "default" 
                        ? "p-2 bg-[#5865F2]/10 border border-[#5865F2]/20 text-[#5865F2] hover:bg-[#5865F2] hover:text-foreground"
                        : "p-1.5 bg-surface border border-border text-muted-foreground hover:text-[#5865F2] hover:border-[#5865F2]/30"
                )}
                title="Partager sur Discord"
            >
                <Bell className={cn(variant === "default" ? "w-4 h-4" : "w-3.5 h-3.5", isSending && "animate-spin")} />
            </button>
        </div>
    );
}

// ─── Featured card ────────────────────────────────────────────────────────────

function FeaturedCard({ 
    item, 
    feedLabel,
    userCtx,
    sending,
    handleSendToDiscord,
}: { 
    item: NewsItem; 
    feedLabel: string;
    userCtx: UserContext | null;
    sending: string | null;
    handleSendToDiscord: (item: NewsItem) => void;
}) {
    const [imgError, setImgError] = useState(false);

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-2xl cursor-pointer block bg-surface/60 border border-border hover:border-border-strong transition-colors"
        >
            {/* Image / Placeholder */}
            <div className="relative h-52 lg:h-60 overflow-hidden border-b border-border">
                {item.imageUrl && !imgError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-elevated">
                        {/* Center icon / Logo */}
                        <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden bg-background border border-border">
                                <img src="/assets/ui/logo-v2.png" alt="SigilOS" className="w-12 h-12 object-contain" />
                            </div>
                            <span className="text-caption font-bold uppercase tracking-widest text-muted-foreground">{feedLabel}</span>
                        </div>
                    </div>
                )}
                
                {/* ACTIONS TOP RIGHT */}
                <div className="absolute top-4 right-4 z-20">
                    {feedLabel !== "Changelog" && (
                        <NewsActions 
                            item={item} 
                            userCtx={userCtx} 
                            sending={sending} 
                            handleSendToDiscord={handleSendToDiscord} 
                        />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="relative p-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                    {item.category && (
                        <span className="text-caption font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-elevated text-foreground border border-border">
                            {item.category}
                        </span>
                    )}
                    {item.pubDate && (
                        <span className="text-caption text-muted-foreground">{formatPubDate(item.pubDate)}</span>
                    )}
                </div>
                <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-3">
                    {item.title}
                </h3>
                {item.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    Lire l&apos;article <ExternalLink className="h-3 w-3" />
                </div>
            </div>
        </a>
    );
}

// ─── Side card ────────────────────────────────────────────────────────────────

function SideCard({ 
    item, 
    feedColor,
    userCtx,
    sending,
    handleSendToDiscord,
}: { 
    item: NewsItem; 
    feedColor: string;
    userCtx: UserContext | null;
    sending: string | null;
    handleSendToDiscord: (item: NewsItem) => void;
}) {
    const [imgError, setImgError] = useState(false);

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 p-3 rounded-xl cursor-pointer border border-transparent hover:border-border-strong hover:bg-elevated transition-colors"
        >
            <div className="relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-elevated border border-border">
                {item.imageUrl && !imgError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <img src="/assets/ui/logo-v2.png" alt="SigilOS" className="w-8 h-8 object-contain opacity-40" />
                )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
                {item.pubDate && (
                    <time className="text-caption font-bold uppercase tracking-widest text-muted-foreground block">
                        {formatPubDate(item.pubDate)}
                    </time>
                )}
                <h4 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
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
}: { 
    item: NewsItem; 
    userCtx: UserContext | null; 
    currentFeed: any; 
    sending: string | null; 
    handleSendToDiscord: (item: NewsItem) => void; 
}) {
    const [imgError, setImgError] = useState(false);

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center gap-6 p-3 rounded-2xl bg-surface/40 border border-border hover:bg-elevated hover:border-border-strong transition-colors"
        >
            {/* Dot / Timeline */}
            <div className="relative z-10 w-24 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-elevated border border-border flex items-center justify-center">
                {item.imageUrl && !imgError ? (
                    <img 
                        src={item.imageUrl} 
                        alt="" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" 
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-elevated">
                        {currentFeed.key === "changelog" ? (
                            <img src="/module-dofus/Dofus_Emeraude.png" alt="" className="w-10 h-10 object-contain opacity-80" />
                        ) : (
                            <Scroll className="w-6 h-6 text-muted-foreground" />
                        )}
                    </div>
                )}
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                    <span className="text-caption font-bold uppercase tracking-widest text-muted-foreground">
                        {formatPubDate(item.pubDate)}
                    </span>
                    <div className="h-px w-8 bg-border" />
                </div>
                <h4 className="text-base font-bold text-foreground line-clamp-1">
                    {item.title}
                </h4>
            </div>

            {currentFeed.key !== "changelog" && (
                <NewsActions 
                    item={item} 
                    userCtx={userCtx} 
                    sending={sending} 
                    handleSendToDiscord={handleSendToDiscord} 
                />
            )}

            <div className="px-4 py-1.5 rounded-lg bg-elevated border border-border text-caption font-bold uppercase tracking-widest text-muted-foreground">
                Détails
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-2 mr-2" />
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
                    <div key={i} className="h-20 rounded-xl bg-elevated animate-pulse" />
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
    const [previewItem, setPreviewItem] = useState<{ item: NewsItem } | null>(null);
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
        setPreviewItem({ item });
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
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-elevated border border-border">
                            <currentFeed.icon className="h-4 w-4" style={{ color: currentFeed.color }} />
                        </div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">{title}</h3>
                    </div>
                ) : !hideSelector ? (
                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(o => !o)}
                            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-surface border border-border text-foreground hover:bg-elevated hover:border-border-strong transition-colors"
                        >
                            <currentFeed.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {currentFeed.label}
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", dropdownOpen && "rotate-180")} />
                        </button>

                        {dropdownOpen && (
                            <div
                                className="absolute top-full mt-2 left-0 z-50 min-w-[160px] rounded-xl overflow-hidden bg-elevated border border-border shadow-xl"
                            >
                                {FEEDS.map((feed) => (
                                    <button
                                        key={feed.key}
                                        onClick={() => { setActiveFeed(feed.key); setDropdownOpen(false); }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-surface",
                                            activeFeed === feed.key ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                                        )}
                                    >
                                        <feed.icon className="h-3.5 w-3.5 text-muted-foreground" />
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
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors hover:bg-elevated border border-border disabled:opacity-40"
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
                    className="rounded-2xl p-10 flex flex-col items-center justify-center min-h-[200px] text-center gap-4 bg-surface/60 border border-border"
                >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-elevated border border-border">
                        <currentFeed.icon className="h-7 w-7 text-muted-foreground" />
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
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-elevated border border-border text-foreground hover:bg-surface transition-colors"
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
                        />
                    ))}
                </div>
            ) : (
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-5 items-stretch">
                    {featured && (
                        <div className="lg:col-span-3">
                            <FeaturedCard 
                                item={featured} 
                                feedLabel={currentFeed.label} 
                                userCtx={userCtx}
                                sending={sending}
                                handleSendToDiscord={handleSendToDiscord}
                            />
                            {showKralamoure && <div className="mt-3"><KralamoureWidget /></div>}
                        </div>
                    )}
                    <div className="lg:col-span-2 flex flex-col gap-1 max-h-[500px] lg:max-h-none overflow-y-auto pr-1 custom-scrollbar">
                        {rest.slice(0, maxItems - 1).map((item, i) => (
                            <SideCard 
                                key={i} 
                                item={item} 
                                feedColor={currentFeed.color} 
                                userCtx={userCtx}
                                sending={sending}
                                handleSendToDiscord={handleSendToDiscord}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* PREVIEW MODAL — envoi au salon de notifications de LA guilde (la diffusion
                toutes guildes a été retirée le 10/10/2026 : pilotée côté God). */}
            <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
                <DialogContent className="max-w-2xl bg-background border-border rounded-2xl p-0 overflow-hidden ">
                    <DialogHeader className="p-8 pb-4">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-2xl border flex items-center justify-center bg-info/10 border-info/20">
                                <Bell className="w-5 h-5 text-info" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-foreground">
                                    Notification de Guilde
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground font-medium">
                                    Vérifiez le rendu visuel avant l'envoi dans votre salon de notifications.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-8 py-4 pb-8">
                        <div className="space-y-3">
                            <div className="flex items-center gap-4 p-5 rounded-2xl border transition-colors bg-info/5 border-info/20">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-info/10 border-info/20">
                                    <Hash className="w-6 h-6 text-info" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-caption font-bold uppercase tracking-widest text-muted-foreground">Destination de publication</span>
                                    <span className="text-sm font-bold text-foreground flex items-center gap-2">
                                        Posté dans 
                                        <span className="italic font-bold text-info">
                                            #{targetChannelName}
                                        </span>
                                    </span>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-surface border border-border rounded-2xl">
                                <p className="text-caption text-muted-foreground font-medium leading-relaxed italic">
                                    Le post inclura le titre, la description et l'image de l'article avec un lien direct vers la source officielle.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 pt-4 bg-surface border-t border-border flex items-center gap-4">
                        <button
                            onClick={() => setPreviewItem(null)}
                            className="flex-1 h-12 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={() => previewItem && confirmSendToDiscord(previewItem.item)}
                            className="flex-[2] h-12 rounded-xl text-caption font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-3 bg-info hover:bg-info text-info-foreground"
                        >
                            <Send className="w-4 h-4" />
                            Envoyer sur Discord
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
