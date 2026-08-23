"use client";

import { AlmanaxItem } from "@/server/actions/resources-actions";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState, useMemo } from "react";
import { Filter, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, LayoutGrid, View, Flame } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_FR = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const MONTHS_FULL = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTHS_SHORT = ["Jan.", "Fév.", "Mar.", "Avr.", "Mai", "Jun.", "Jul.", "Aoû.", "Sep.", "Oct.", "Nov.", "Déc."];

function parseUTCDate(dateStr: string) {
    return new Date(dateStr + "T12:00:00Z");
}

function formatKamas(k: number): string {
    if (k >= 1_000_000) return `${(k / 1_000_000).toFixed(1)} Mk`;
    if (k >= 1_000) return `${Math.round(k / 1_000)} kk`;
    return `${k.toLocaleString("fr-FR")} k`;
}

// ─── Bonus type style ─────────────────────────────────────────────────────────

const BONUS_STYLES: Record<string, { color: string; emoji: string }> = {
    // Spécifiques en premier (priorité)
    "Avis de recherche": { color: "#b91c1c", emoji: "🚨" },
    "Kolizétons": { color: "#dc2626", emoji: "🛡️" },
    "Concassage": { color: "#ec4899", emoji: "💥" },
    "Percepteur": { color: "#3b82f6", emoji: "🐴" },
    "Anomalie": { color: "#f97316", emoji: "🌀" },
    "Trésor": { color: "#fbbf24", emoji: "🗝️" },
    "Élevage": { color: "#d946ef", emoji: "🐾" },

    // Mots clés fonctionnels
    "Qualité": { color: "#f59e0b", emoji: "✨" },
    "Challenge": { color: "#ef4444", emoji: "🎯" },
    "Butin": { color: "#a855f7", emoji: "💎" },
    "Économie": { color: "#06b6d4", emoji: "⚖️" },

    // Récolte
    "Récolte": { color: "#84cc16", emoji: "🌿" },
    "Cueillette": { color: "#ec4899", emoji: "🌸" },
    "Bois": { color: "#d97706", emoji: "🌲" },
    "Pêche": { color: "#0ea5e9", emoji: "🎣" },

    // Craft
    "Fabrication": { color: "#6366f1", emoji: "🔨" },
    "Fabrique": { color: "#6366f1", emoji: "🏭" },
    "Métier": { color: "#3b82f6", emoji: "⚒️" },

    // Généralités
    "Quête": { color: "#facc15", emoji: "📜" },
    "Donjon": { color: "#7c3aed", emoji: "🏰" },
    "Combat": { color: "#ef4444", emoji: "⚔️" },
    "Expérience": { color: "#10b981", emoji: "⭐" },
};

function getBonusStyle(typeName: string): { color: string; emoji: string } {
    if (!typeName) return { color: "#10b981", emoji: "✦" };
    for (const [key, style] of Object.entries(BONUS_STYLES)) {
        if (typeName.toLowerCase().includes(key.toLowerCase())) return style;
    }
    return { color: "#10b981", emoji: "✦" };
}

// ─── Hero Card ────────────────────────────────────────────────────────────────

function HeroCard({ item, dayOffset }: { item: AlmanaxItem; dayOffset: number }) {
    const d = parseUTCDate(item.date);
    const { color, emoji } = getBonusStyle(item.bonus.type?.name ?? "");
    const iconSd = item.tribute.item.image_urls?.sd;
    const iconSmall = item.tribute.item.image_urls?.icon;

    return (
        <div
            className="relative overflow-hidden rounded-2xl p-6 transition-all duration-300"
            style={{
                background: "linear-gradient(135deg, #13100a 0%, #0d100d 100%)",
                border: `1px solid ${color}22`,
                boxShadow: `0 0 40px -12px ${color}20`,
            }}
        >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-10"
                style={{ background: color, transform: "translate(30%, -30%)" }} />
            <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none" viewBox="0 0 600 260">
                <circle cx="500" cy="130" r="120" fill="none" stroke={color} strokeWidth="0.8" />
                <circle cx="500" cy="130" r="80" fill="none" stroke={color} strokeWidth="0.4" />
                <path d="M0 130 L600 100" stroke={color} strokeWidth="0.4" />
            </svg>

            <div className="relative flex items-start gap-6">
                <div className="flex-shrink-0 space-y-1 pt-1">
                    <div className="text-caption font-black uppercase tracking-widest" style={{ color }}>
                        {dayOffset === 0 ? "✦ Aujourd'hui" : dayOffset === 1 ? "✦ Demain" : `✦ J+${dayOffset}`}
                    </div>
                    <div className="text-6xl font-black text-foreground leading-none tracking-tight">{d.getUTCDate()}</div>
                    <div className="text-sm font-medium text-muted-foreground">
                        {DAYS_FR[d.getUTCDay()]} {MONTHS_FULL[d.getUTCMonth()]}
                    </div>
                </div>

                <div className="flex-1 space-y-4 min-w-0">
                    {item.bonus.type?.name && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-caption font-black uppercase tracking-widest"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
                            {emoji} {item.bonus.type.name}
                        </div>
                    )}
                    <div className="p-4 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="text-foreground/90 text-sm leading-relaxed">{item.bonus.description}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                {iconSmall
                                    ? <Image src={iconSmall} alt={item.tribute.item.name} width={32} height={32} className="object-contain" unoptimized />
                                    : <span className="text-lg">🎁</span>}
                            </div>
                            <div>
                                <div className="text-caption text-muted-foreground uppercase tracking-widest font-bold">Offrande</div>
                                <div className="text-foreground text-sm font-semibold">
                                    <span style={{ color }}>{item.tribute.quantity}×</span> {item.tribute.item.name}
                                </div>
                            </div>
                        </div>
                        {item.reward_kamas && (
                            <div className="ml-auto text-right">
                                <div className="text-caption text-muted-foreground uppercase tracking-widest font-bold">Récompense</div>
                                <div className="font-black text-lg" style={{ color }}>{formatKamas(item.reward_kamas)}</div>
                            </div>
                        )}
                    </div>
                </div>

                {iconSd && (
                    <div className="relative flex-shrink-0 hidden sm:block">
                        <div className="absolute inset-0 rounded-2xl blur-xl opacity-25" style={{ background: color }} />
                        <div className="relative w-24 h-24 rounded-2xl flex items-center justify-center"
                            style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${color}30` }}>
                            <Image src={iconSd} alt={item.tribute.item.name} width={88} height={88}
                                className="object-contain  transition-transform duration-300" unoptimized />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Day strip (7 days) ───────────────────────────────────────────────────────

function DayStrip({ items, selectedIdx, activeFilter, onSelect }: {
    items: AlmanaxItem[];
    selectedIdx: number;
    activeFilter: string;
    onSelect: (i: number) => void;
}) {
    return (
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-4 pt-2 snap-x">
            {items.slice(0, 30).map((item, i) => {
                const d = parseUTCDate(item.date);
                const icon = item.tribute.item.image_urls?.icon;
                const typeName = item.bonus.type?.name ?? "";
                const { color } = getBonusStyle(typeName);
                const selected = i === selectedIdx;
                const isMuted = activeFilter !== "Tous" && typeName !== activeFilter;

                return (
                    <button key={item.date} onClick={() => onSelect(i)}
                        className={cn(
                            "shrink-0 w-24 snap-start group relative overflow-hidden rounded-xl p-3 flex flex-col items-center gap-1.5 text-center transition-all duration-200 cursor-pointer",
                            isMuted && !selected ? "opacity-30 grayscale hover:opacity-100 hover:grayscale-0" : "hover:-translate-y-0.5",
                            selected && "scale-[1.05]"
                        )}
                        title={`${item.tribute.quantity}× ${item.tribute.item.name} — ${typeName}`}
                        style={{
                            background: selected ? `linear-gradient(135deg, ${color}20, rgba(13,16,13,0.9))` : "rgba(255,255,255,0.02)",
                            border: `1px solid ${selected ? color + "50" : isMuted ? "transparent" : "rgba(255,255,255,0.05)"}`,
                            boxShadow: selected ? `0 0 20px -6px ${color}40` : "none",
                        }}>
                        {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />}
                        <div className="text-caption font-black uppercase tracking-widest text-muted-foreground">{DAYS_FR[d.getUTCDay()]}</div>
                        <div className="text-xl font-black text-foreground leading-none">{d.getUTCDate()}</div>
                        <div className="text-caption text-muted-foreground">{MONTHS_SHORT[d.getUTCMonth()]}</div>
                        <div className="w-9 h-9 flex items-center justify-center">
                            {icon
                                ? <Image src={icon} alt={item.tribute.item.name} width={32} height={32} className="object-contain group- transition-transform" unoptimized />
                                : <span className="text-base">🎁</span>}
                        </div>
                        <div className="text-caption text-muted-foreground leading-tight line-clamp-2 w-full h-6">{item.tribute.item.name}</div>
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"
                            style={{ background: `radial-gradient(circle at center, ${color}10, transparent)` }} />
                    </button>
                );
            })}
        </div>
    );
}

// ─── 3-Month Full Calendar ────────────────────────────────────────────────────



// ─── Main Component ───────────────────────────────────────────────────────────

interface AlmanaxWidgetProps { items: AlmanaxItem[] }

export function AlmanaxWidget({ items }: AlmanaxWidgetProps) {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [activeFilter, setActiveFilter] = useState<string>("Tous");

    // Top filter categories in the next 30 days
    const filterTypes = useMemo(() => {
        if (!Array.isArray(items)) return [];
        const map = new Map<string, number>();
        items.slice(0, 30).forEach((item) => {
            const name = item.bonus.type?.name ?? "";
            if (name) map.set(name, (map.get(name) ?? 0) + 1);
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5); // Keep top 5 to avoid clutter
    }, [items]);

    if (!Array.isArray(items) || items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-surface border border-border rounded-2xl h-[300px]">
                <Flame className="w-10 h-10 text-warning/50 mb-4 animate-pulse" />
                <h3 className="text-lg font-bold text-foreground mb-2">Almanax momentanément indisponible</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                    L'Oracle Temporel (API Dofusdu) semble en maintenance temporelle. Les données ne sont pas accessibles pour le moment.
                </p>
            </div>
        );
    }

    const selected = items[selectedIdx] ?? items[0];
    if (!selected) return null;

    const handleFilterClick = (type: string) => {
        setActiveFilter(type);
        if (type !== "Tous") {
            const firstIdx = items.slice(0, 30).findIndex(i => (i.bonus.type?.name ?? "") === type);
            if (firstIdx >= 0) {
                setSelectedIdx(firstIdx);
            }
        } else {
            // Reset to default
            setSelectedIdx(0);
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Action bar (Filters) ───────────────────────────── */}
            <div className="flex items-center gap-2 pb-2 overflow-x-auto custom-scrollbar">
                <span className="text-xs text-muted-foreground font-medium mr-1 whitespace-nowrap">Filtrer (30 jours) :</span>
                <button
                    onClick={() => handleFilterClick("Tous")}
                    className={cn(
                        "px-3 py-1 text-caption rounded-full transition-all border font-medium whitespace-nowrap",
                        activeFilter === "Tous"
                            ? "bg-surface text-foreground border-border-strong"
                            : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-surface"
                    )}
                >
                    Tous
                </button>

                {filterTypes.map(([type]) => {
                    const { color, emoji } = getBonusStyle(type);
                    const isActive = activeFilter === type;
                    return (
                        <button key={type}
                            onClick={() => handleFilterClick(type)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 text-caption rounded-full transition-all border font-medium whitespace-nowrap opacity-90 hover:opacity-100"
                            )}
                            style={isActive
                                ? { background: `${color}20`, border: `1px solid ${color}40`, color }
                                : { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }}
                        >
                            <span>{emoji}</span> {type}
                        </button>
                    );
                })}
            </div>

            {/* ── Content Area ────────────────────────────────────────── */}
            <HeroCard item={selected} dayOffset={selectedIdx} />
            <DayStrip items={items} selectedIdx={selectedIdx} activeFilter={activeFilter} onSelect={setSelectedIdx} />
        </div>
    );
}
