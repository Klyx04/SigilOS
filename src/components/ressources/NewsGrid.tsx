"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, Newspaper, Zap, Scroll, Shield, Sparkles, Globe2, ChevronDown, RefreshCw, Rss } from "lucide-react";
import { cn } from "@/lib/utils";
import { KralamoureWidget } from "@/components/ressources/KralamoureWidget";

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

// ─── Featured card ────────────────────────────────────────────────────────────

function FeaturedCard({ item, feedColor, feedLabel }: { item: NewsItem; feedColor: string; feedLabel: string }) {
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
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl"
                style={{ background: `radial-gradient(ellipse at 20% 50%, ${feedColor}12, transparent 60%)` }}
            />

            {/* Image / Placeholder */}
            <div className="relative h-52 lg:h-60 overflow-hidden">
                {item.imageUrl && !imgError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
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
                        {/* Center icon */}
                        <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                style={{ background: `${feedColor}15`, border: `1px solid ${feedColor}30` }}>
                                <Newspaper className="h-8 w-8" style={{ color: feedColor }} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest opacity-60"
                                style={{ color: feedColor }}>{feedLabel}</span>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Content */}
            <div className="relative p-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                    {item.category && (
                        <span className="text-[9px] font-black uppercase tracking-[0.25em] px-2 py-0.5 rounded-full"
                            style={{ background: `${feedColor}15`, color: feedColor, border: `1px solid ${feedColor}30` }}>
                            {item.category}
                        </span>
                    )}
                    {item.pubDate && (
                        <span className="text-[10px] text-zinc-600">{formatPubDate(item.pubDate)}</span>
                    )}
                </div>
                <h3 className="text-lg font-bold text-white leading-tight line-clamp-3 group-hover:opacity-80 transition-opacity">
                    {item.title}
                </h3>
                {item.description && (
                    <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2">{item.description}</p>
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

function SideCard({ item, idx, feedColor }: { item: NewsItem; idx: number; feedColor: string }) {
    const [imgError, setImgError] = useState(false);
    const grad = CARD_PALETTE[(idx + 1) % CARD_PALETTE.length];

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/5"
            style={{ border: "1px solid rgba(255,255,255,0.03)" }}
        >
            <div className="relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${grad.from}, #0d1117)`, border: `1px solid ${grad.accent}20` }}>
                {item.imageUrl && !imgError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <Newspaper className="h-5 w-5" style={{ color: grad.accent, opacity: 0.5 }} />
                )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
                {item.pubDate && (
                    <time className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 block">
                        {formatPubDate(item.pubDate)}
                    </time>
                )}
                <h4 className="text-sm font-semibold text-white group-hover:opacity-75 transition-opacity leading-tight line-clamp-2">
                    {item.title}
                </h4>
            </div>
            <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity mt-1"
                style={{ color: feedColor }} />
        </a>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-3 rounded-2xl bg-white/5 animate-pulse" style={{ minHeight: 380 }} />
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
    showKralamoure = false
}: {
    defaultFeed?: FeedKey;
    hideSelector?: boolean;
    title?: string;
    maxItems?: number;
    showKralamoure?: boolean;
}) {
    const [activeFeed, setActiveFeed] = useState<FeedKey>(defaultFeed);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [items, setItems] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currentFeed = FEEDS.find(f => f.key === activeFeed) ?? FEEDS[0];

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
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
                    </div>
                ) : !hideSelector ? (
                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(o => !o)}
                            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-white/5"
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
                                            "w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-all hover:bg-white/5",
                                            activeFeed === feed.key ? "font-bold" : "font-medium text-zinc-400"
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
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-zinc-500 hover:text-white transition-all hover:bg-white/5 disabled:opacity-40"
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
                        <p className="text-white font-semibold">
                            {error ?? "Aucun article trouvé"}
                        </p>
                        <p className="text-zinc-500 text-sm mt-1">
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
            ) : (
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-5 items-stretch">
                    {featured && (
                        <div className="lg:col-span-3">
                            <FeaturedCard item={featured} feedColor={currentFeed.color} feedLabel={currentFeed.label} />
                            {showKralamoure && <div className="mt-3"><KralamoureWidget /></div>}
                        </div>
                    )}
                    <div className="lg:col-span-2 flex flex-col gap-1 max-h-[500px] lg:max-h-none overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                        {rest.slice(0, maxItems - 1).map((item, i) => (
                            <SideCard key={i} item={item} idx={i} feedColor={currentFeed.color} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
