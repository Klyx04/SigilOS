"use client";

import { AlmanaxItem } from "@/server/actions/resources-actions";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState, useMemo } from "react";
import { Filter, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, LayoutGrid, View } from "lucide-react";

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
    "Combat": { color: "#ef4444", emoji: "⚔️" },
    "Expérience": { color: "#10b981", emoji: "⭐" },
    "Butin": { color: "#a855f7", emoji: "💎" },
    "Récolte": { color: "#f59e0b", emoji: "🌿" },
    "Métiers": { color: "#3b82f6", emoji: "🔨" },
    "Anomalies": { color: "#f97316", emoji: "🌀" },
    "Donjon": { color: "#ec4899", emoji: "🏰" },
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
            className="relative overflow-hidden rounded-2xl p-6 transition-all duration-500"
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
                    <div className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color }}>
                        {dayOffset === 0 ? "✦ Aujourd'hui" : dayOffset === 1 ? "✦ Demain" : `✦ J+${dayOffset}`}
                    </div>
                    <div className="text-6xl font-black text-white leading-none tracking-tight">{d.getUTCDate()}</div>
                    <div className="text-sm font-medium text-zinc-400">
                        {DAYS_FR[d.getUTCDay()]} {MONTHS_FULL[d.getUTCMonth()]}
                    </div>
                </div>

                <div className="flex-1 space-y-4 min-w-0">
                    {item.bonus.type?.name && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
                            {emoji} {item.bonus.type.name}
                        </div>
                    )}
                    <div className="p-4 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="text-white/90 text-sm leading-relaxed">{item.bonus.description}</p>
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
                                <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Offrande</div>
                                <div className="text-white text-sm font-semibold">
                                    <span style={{ color }}>{item.tribute.quantity}×</span> {item.tribute.item.name}
                                </div>
                            </div>
                        </div>
                        {item.reward_kamas && (
                            <div className="ml-auto text-right">
                                <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Récompense</div>
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
                                className="object-contain hover:scale-110 transition-transform duration-500" unoptimized />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Day strip (7 days) ───────────────────────────────────────────────────────

function DayStrip({ items, selectedIdx, onSelect }: {
    items: AlmanaxItem[];
    selectedIdx: number;
    onSelect: (i: number) => void;
}) {
    return (
        <div className="grid grid-cols-7 gap-2">
            {items.slice(0, 7).map((item, i) => {
                const d = parseUTCDate(item.date);
                const icon = item.tribute.item.image_urls?.icon;
                const { color } = getBonusStyle(item.bonus.type?.name ?? "");
                const selected = i === selectedIdx;
                return (
                    <button key={item.date} onClick={() => onSelect(i)}
                        className={cn(
                            "group relative overflow-hidden rounded-xl p-3 flex flex-col items-center gap-1.5 text-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5",
                            selected ? "scale-[1.03]" : "opacity-60 hover:opacity-100"
                        )}
                        title={`${item.tribute.quantity}× ${item.tribute.item.name} — ${item.bonus.type?.name ?? ""}`}
                        style={{
                            background: selected ? `linear-gradient(135deg, ${color}15, rgba(13,16,13,0.9))` : "rgba(255,255,255,0.02)",
                            border: `1px solid ${selected ? color + "40" : "rgba(255,255,255,0.05)"}`,
                            boxShadow: selected ? `0 0 20px -6px ${color}40` : "none",
                        }}>
                        {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />}
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{DAYS_FR[d.getUTCDay()]}</div>
                        <div className="text-xl font-black text-white leading-none">{d.getUTCDate()}</div>
                        <div className="text-[8px] text-zinc-600">{MONTHS_SHORT[d.getUTCMonth()]}</div>
                        <div className="w-9 h-9 flex items-center justify-center">
                            {icon
                                ? <Image src={icon} alt={item.tribute.item.name} width={32} height={32} className="object-contain group-hover:scale-110 transition-transform" unoptimized />
                                : <span className="text-base">🎁</span>}
                        </div>
                        <div className="text-[8px] text-zinc-500 leading-tight line-clamp-2 w-full">{item.tribute.item.name}</div>
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"
                            style={{ background: `radial-gradient(circle at center, ${color}10, transparent)` }} />
                    </button>
                );
            })}
        </div>
    );
}

// ─── 3-Month Full Calendar ────────────────────────────────────────────────────

function FullCalendarGrid({ items, activeFilter, onSelectDay }: {
    items: AlmanaxItem[];
    activeFilter: string;
    onSelectDay: (globalIdx: number) => void;
}) {
    // Group all 90 days by month
    const months = useMemo(() => {
        const map = new Map<string, { label: string; entries: { item: AlmanaxItem; idx: number }[] }>();
        items.forEach((item, idx) => {
            const d = parseUTCDate(item.date);
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
            if (!map.has(key)) {
                map.set(key, {
                    label: `${MONTHS_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
                    entries: [],
                });
            }
            map.get(key)!.entries.push({ item, idx });
        });
        return Array.from(map.values());
    }, [items]);

    const [visibleMonth, setVisibleMonth] = useState(0);
    const totalMonths = months.length;
    const current = months[visibleMonth];

    if (!current) return null;

    return (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <CalendarIcon className="h-4 w-4 text-violet-400" />
                    <div>
                        <span className="text-sm font-black text-white">{current.label}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setVisibleMonth(v => Math.max(0, v - 1))}
                        disabled={visibleMonth === 0}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-zinc-600">{visibleMonth + 1}/{totalMonths}</span>
                    <button onClick={() => setVisibleMonth(v => Math.min(totalMonths - 1, v + 1))}
                        disabled={visibleMonth === totalMonths - 1}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
                {current.entries.map(({ item, idx }) => {
                    const d = parseUTCDate(item.date);
                    const icon = item.tribute.item.image_urls?.icon;
                    const typeName = item.bonus.type?.name ?? "";
                    const { color } = getBonusStyle(typeName);

                    // Différences visuelles selon le filtre
                    const isMuted = activeFilter !== "Tous" && typeName !== activeFilter;

                    return (
                        <button key={item.date}
                            onClick={() => onSelectDay(idx)}
                            className={cn(
                                "group relative overflow-hidden rounded-xl p-2.5 flex flex-col items-center gap-1.5 text-center transition-all duration-200 cursor-pointer",
                                isMuted ? "opacity-30 hover:opacity-100 grayscale hover:grayscale-0" : "hover:-translate-y-0.5 hover:scale-[1.03]"
                            )}
                            style={{
                                background: isMuted ? "rgba(255,255,255,0.02)" : `${color}10`,
                                border: isMuted ? "1px solid transparent" : `1px solid ${color}25`
                            }}
                            title={`${item.tribute.quantity}× ${item.tribute.item.name} (${typeName})`}>
                            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{DAYS_FR[d.getUTCDay()]}</div>
                            <div className={cn("text-lg font-black", isMuted ? "text-zinc-500" : "text-white")}>{d.getUTCDate()}</div>
                            {icon && (
                                <Image src={icon} alt={item.tribute.item.name} width={28} height={28}
                                    className="object-contain group-hover:scale-110 transition-transform duration-300" unoptimized />
                            )}
                            <div className="text-[8px] text-zinc-500 leading-tight line-clamp-2 w-full">
                                {item.tribute.item.name}
                            </div>
                        </button>
                    );
                })}
            </div>
            {activeFilter !== "Tous" && (
                <div className="text-[10px] text-zinc-500 text-center font-medium pt-2">
                    Les jours qui ne sont pas de type <span className="text-white font-bold">{activeFilter}</span> sont grisés.
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AlmanaxWidgetProps { items: AlmanaxItem[] }

export function AlmanaxWidget({ items }: AlmanaxWidgetProps) {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [activeFilter, setActiveFilter] = useState<string>("Tous");
    const [viewMode, setViewMode] = useState<"strip" | "calendar">("strip");

    // Top filter categories
    const filterTypes = useMemo(() => {
        const map = new Map<string, number>();
        items.forEach((item) => {
            const name = item.bonus.type?.name ?? "";
            if (name) map.set(name, (map.get(name) ?? 0) + 1);
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6); // Keep top 6 to avoid clutter
    }, [items]);

    const selected = items[selectedIdx] ?? items[0];
    if (!selected) return null;

    const handleFilterClick = (type: string) => {
        setActiveFilter(type);
        if (type !== "Tous") {
            const firstIdx = items.findIndex(i => (i.bonus.type?.name ?? "") === type);
            // If in strip mode, jump to it inside the strip? But the strip only shows 7 days.
            // Actually, if they filter, it's generally best to jump to calendar to see everything!
            if (firstIdx >= 0) {
                setSelectedIdx(firstIdx);
            }
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Action bar (Filters + View Toggle) ─────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                    <Filter className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />

                    <button
                        onClick={() => handleFilterClick("Tous")}
                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all duration-200"
                        style={activeFilter === "Tous"
                            ? { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }
                            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#71717a" }}>
                        Tous
                    </button>

                    {filterTypes.map(([type, count]) => {
                        const { color, emoji } = getBonusStyle(type);
                        const isActive = activeFilter === type;
                        return (
                            <button key={type}
                                onClick={() => handleFilterClick(type)}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all duration-200"
                                style={isActive
                                    ? { background: `${color}20`, border: `1px solid ${color}40`, color }
                                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#71717a" }}>
                                {emoji} {type} <span className="text-[8px] opacity-50">({count})</span>
                            </button>
                        );
                    })}
                </div>

                {/* Switch view mode */}
                <button
                    onClick={() => setViewMode(v => v === "strip" ? "calendar" : "strip")}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all bg-[#13171A] hover:bg-[#1C2126] border border-white/5"
                >
                    {viewMode === "strip" ? (
                        <><LayoutGrid className="w-3.5 h-3.5" /> Voir 90 Jours</>
                    ) : (
                        <><View className="w-3.5 h-3.5" /> Voir Résumé 7 Jours</>
                    )}
                </button>
            </div>

            {/* ── Content Area ────────────────────────────────────────── */}
            {viewMode === "calendar" ? (
                <>
                    <HeroCard item={selected} dayOffset={selectedIdx} />
                    <FullCalendarGrid
                        items={items}
                        activeFilter={activeFilter}
                        onSelectDay={(i) => {
                            setSelectedIdx(i);
                            window.scrollTo({ top: 300, behavior: "smooth" }); // gently snap up
                        }}
                    />
                </>
            ) : (
                <>
                    <HeroCard item={selected} dayOffset={selectedIdx} />
                    <DayStrip items={items} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />
                </>
            )}
        </div>
    );
}
