"use client";
 
import { useEffect, useState, useMemo } from "react";
import { Trophy, Users, TrendingUp, Crown, Search, X, Gem, CheckCircle2, Star, BookOpen, Medal, Info, BarChart3, Flag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { GuildDofusStats, MemberDofusSummary, GuildMemberSummary } from "@/server/actions/dofus-quest-actions";
import { getDofusColor } from "./dofus-colors";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
 
interface GuildDofusOverviewProps {
    stats: GuildDofusStats[];
    topMembers: MemberDofusSummary[];
    members?: GuildMemberSummary[];
    totalMembers: number;
    guildId?: string;
    onMemberClick?: (profileId: string, pseudo: string, avatarUrl?: string) => void;
}
 
export function GuildDofusOverview({ stats, topMembers, members = [], totalMembers, onMemberClick }: GuildDofusOverviewProps) {
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("Tous");
    const [selectedDofus, setSelectedDofus] = useState<GuildDofusStats | null>(null);
    const [modalSearch, setModalSearch] = useState("");
    const [progressFilter, setProgressFilter] = useState("Tous");
    const [modalStatusFilter, setModalStatusFilter] = useState<"Tous" | "Avec le Dofus" | "Sans le Dofus" | ">50%" | "<50%">("Tous");
    const [memberQuery, setMemberQuery] = useState("");
    const [modalVisibleCount, setModalVisibleCount] = useState(12);

    // Réinitialise la pagination de la liste quand on ouvre la modale
    useEffect(() => {
        setModalVisibleCount(12);
    }, [selectedDofus]);

    // Fermeture de la modale sur Échap
    useEffect(() => {
        if (!selectedDofus) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedDofus(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedDofus]);

    // Get unique filter categories from stats
    const categories = useMemo(() => {
        const cats = new Set<string>();
        cats.add("Tous");
        stats.forEach(s => {
            const cat = (s as any).filterCategory || "Autres";
            cats.add(cat);
        });
        return Array.from(cats);
    }, [stats]);
 
    const filteredStats = useMemo(() => {
        return stats.filter(s => {
            const matchesSearch = s.nameShort.toLowerCase().includes(search.toLowerCase()) || 
                                 s.name.toLowerCase().includes(search.toLowerCase());
            const matchesCat = categoryFilter === "Tous" || (s as any).filterCategory === categoryFilter;
            return matchesSearch && matchesCat;
        });
    }, [stats, search, categoryFilter]);

    const insights = useMemo(() => {
        if (stats.length === 0) return null;
        const uniqueObtained = stats.filter(s => s.obtainedCount > 0).length;
        const globalRate = Math.round(stats.reduce((sum, s) => sum + s.obtainedPercent, 0) / stats.length);
        const sorted = [...stats].sort((a, b) => b.obtainedPercent - a.obtainedPercent);
        return {
            uniqueObtained,
            globalRate,
            most: sorted[0],
            least: sorted[sorted.length - 1],
        };
    }, [stats]);

    const quickFilteredStats = useMemo(() => {
        return filteredStats
            .filter(s => {
                switch (progressFilter) {
                    case ">50%": return s.obtainedPercent > 50;
                    case "20-50%": return s.obtainedPercent >= 20 && s.obtainedPercent <= 50;
                    case "<20%": return s.obtainedPercent < 20;
                    default: return true;
                }
            })
            .sort((a, b) => b.obtainedPercent - a.obtainedPercent);
    }, [filteredStats, progressFilter]);

    const filteredMembers = useMemo(() => {
        if (!memberQuery.trim()) return [];
        const q = memberQuery.toLowerCase();
        return (members || [])
            .filter(m => (m.pseudo || "").toLowerCase().includes(q))
            .slice(0, 8);
    }, [members, memberQuery]);

    const modalFilteredProgress = useMemo(() => {
        if (!selectedDofus) return [];
        const sorted = [...selectedDofus.membersProgress]
            .filter(m => !modalSearch || m.pseudo.toLowerCase().includes(modalSearch.toLowerCase()))
            .sort((a, b) => {
                const aObtained = a.isObtained ? 1 : 0;
                const bObtained = b.isObtained ? 1 : 0;
                if (aObtained !== bObtained) return aObtained - bObtained;
                if (a.percent !== b.percent) return b.percent - a.percent;
                return a.pseudo.localeCompare(b.pseudo);
            });
        switch (modalStatusFilter) {
            case "Avec le Dofus": return sorted.filter(m => m.isObtained);
            case "Sans le Dofus": return sorted.filter(m => !m.isObtained);
            case ">50%": return sorted.filter(m => !m.isObtained && m.percent > 50);
            case "<50%": return sorted.filter(m => !m.isObtained && m.percent < 50);
            default: return sorted;
        }
    }, [selectedDofus, modalSearch, modalStatusFilter]);

    const visibleProgress = useMemo(() => modalFilteredProgress.slice(0, modalVisibleCount), [modalFilteredProgress, modalVisibleCount]);
 
    return (
        <div className="flex flex-col gap-12 pt-4">
            {/* ── 👤 MEMBRES : CLASSEMENT DOFUS ── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                
                {/* 🏆 TABLE D'HONNEUR */}
                <div className="xl:col-span-4 flex flex-col gap-4">
                    <div className="flex items-center gap-3 px-4">
                        <Trophy className="w-5 h-5 text-warning" />
                        <h3 className="text-base font-black text-foreground italic uppercase tracking-tighter">
                            Table d'Honneur
                        </h3>
                        <div className="h-px flex-1 bg-surface" />
                        <span className="text-caption text-foreground/30 font-black uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-3.5 h-3.5" />
                            {totalMembers} Actifs
                        </span>
                    </div>

                    {/* Rechercher un membre */}
                    <div className="px-4 relative">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
                            <input
                                type="text"
                                placeholder="Rechercher un membre..."
                                value={memberQuery}
                                onChange={(e) => setMemberQuery(e.target.value)}
                                className="pl-9 pr-3 py-2 w-full text-caption font-bold bg-muted/40 border border-border rounded-xl text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-info/50 transition-all"
                            />
                        </div>
                        {memberQuery.trim() && (
                            <div className="absolute left-4 right-4 top-full mt-2 z-20 bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden">
                                {filteredMembers.length === 0 ? (
                                    <p className="px-4 py-4 text-center text-caption font-black uppercase tracking-widest text-muted-foreground">Aucun membre trouvé</p>
                                ) : (
                                    filteredMembers.map((m) => (
                                        <button
                                            key={m.profileId}
                                            onClick={() => {
                                                setMemberQuery("");
                                                onMemberClick?.(m.profileId, m.pseudo, m.image || undefined);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors cursor-pointer text-left border-b border-border last:border-0"
                                        >
                                            <div className="w-7 h-7 rounded-lg overflow-hidden bg-elevated flex-shrink-0 border border-border">
                                                {m.image ? (
                                                    <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-caption flex items-center justify-center h-full font-black uppercase text-foreground/40">{m.pseudo[0]}</span>
                                                )}
                                            </div>
                                            <span className="text-caption font-black text-foreground uppercase truncate flex-1">{m.pseudo}</span>
                                            <span className="text-caption text-muted-foreground font-black tabular-nums flex-shrink-0">{m.dofusObtained}/{m.dofusTotal}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2.5">
                        {topMembers.slice(0, 10).map((member, index) => {
                            const isFirst = index === 0;
                            const isSecond = index === 1;
                            const isThird = index === 2;
                            
                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    key={member.profileId}
                                    onClick={() => onMemberClick?.(member.profileId, member.pseudo, member.image || undefined)}
                                    title={`${member.pseudo} — ${member.dofusObtained}/${member.dofusTotal} Dofus obtenus`}
                                    className={`group/member flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 cursor-pointer relative border ${
                                        isFirst 
                                            ? "bg-gradient-to-br from-warning/10 via-background to-background border-warning/40 shadow-[0_4px_24px_rgba(251,191,36,0.12)] hover:border-warning/60" 
                                            : isSecond
                                            ? "bg-gradient-to-br from-elevated/[0.06] via-background to-background border-border/25 shadow-[0_4px_20px_rgba(212,212,216,0.05)] hover:border-border/50"
                                            : isThird
                                            ? "bg-gradient-to-br from-warning/10 via-background to-background border-warning/35 shadow-[0_4px_20px_rgba(180,83,9,0.08)] hover:border-warning/55"
                                            : "bg-background/40 border-border hover:bg-surface hover:border-border"
                                    }`}
                                >
                                    {isFirst && (
                                        <div className="absolute top-0 right-10 w-24 h-24 bg-warning/5 blur-[20px] rounded-full pointer-events-none" />
                                    )}
                                    
                                    <div className="w-6 flex-shrink-0 flex items-center justify-center">
                                        {isFirst ? (
                                            <Crown className="w-5 h-5 text-warning drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse" />
                                        ) : isSecond ? (
                                            <Medal className="w-4 h-4 text-foreground drop-shadow-[0_0_6px_rgba(228,228,231,0.35)]" />
                                        ) : isThird ? (
                                            <Medal className="w-4 h-4 text-warning drop-shadow-[0_0_6px_rgba(180,83,9,0.4)]" />
                                        ) : (
                                            <span className="text-xs font-bold italic text-muted-foreground group-hover/member:text-muted-foreground transition-colors">
                                                #{index + 1}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border transition-all ${
                                        isFirst 
                                            ? "border-warning/30 bg-warning/5 " 
                                            : "border-border bg-surface"
                                    }`}>
                                        {member.image ? (
                                            <img src={member.image} alt={member.pseudo} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className={`text-xs font-black italic ${isFirst ? "text-warning" : "text-muted-foreground"}`}>
                                                {member.pseudo.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-black italic uppercase truncate tracking-tight transition-colors ${
                                            isFirst ? "text-warning group-hover/member:text-warning" : "text-foreground group-hover/member:text-foreground"
                                        }`}>
                                            {member.pseudo}
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {member.dofusList
                                                .filter((d) => d.isObtained)
                                                .slice(0, 10)
                                                .map((d) => (
                                                    <div
                                                        key={d.slug}
                                                        className="w-2 h-2 rounded-full border border-black/40 ring-1 ring-white/10"
                                                        style={{ backgroundColor: d.color || "#6366f1" }}
                                                        title={d.name}
                                                    />
                                                ))}
                                        </div>
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                        <div className="flex items-baseline gap-0.5">
                                            <span className={`text-lg font-black italic tabular-nums ${
                                                isFirst ? "text-warning" : "text-foreground"
                                            }`}>
                                                {member.dofusObtained}
                                            </span>
                                            <span className="text-caption text-muted-foreground font-black">/{member.dofusTotal}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Légende des points colorés */}
                    <div className="px-4">
                        <p className="flex items-start gap-2 text-caption text-muted-foreground font-medium leading-relaxed">
                            <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span>Les points colorés représentent les Dofus obtenus par le membre. Survole un membre pour voir son résumé.</span>
                        </p>
                    </div>
                </div>
 
                {/* ⚔️ PROGRESSION DES DOFUS */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-info" />
                            <h3 className="text-base font-black text-foreground italic uppercase tracking-tighter">
                                Progression Guilde
                            </h3>
                        </div>
 
                        <div className="flex items-center gap-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
                                <input
                                    type="text"
                                    placeholder="Chercher Dofus..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-caption font-bold uppercase tracking-widest bg-muted/40 border border-border rounded-xl text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-border-strong transition-all min-w-[150px]"
                                />
                            </div>
 
                            {/* Category Filter */}
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[140px] h-8 bg-black/40 border-border text-caption font-bold uppercase tracking-widest rounded-xl">
                                    <SelectValue placeholder="Catégorie" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-border text-foreground rounded-xl shadow-2xl">
                                    {categories.map(cat => (
                                        <SelectItem key={cat} value={cat} className="text-caption font-bold uppercase tracking-wider focus:bg-surface focus:text-foreground cursor-pointer">
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
 
                    {/* INSIGHTS GUILDE */}
                    {insights && (
                        <div className="px-4 grid grid-cols-3 gap-2.5">
                            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-surface border border-border min-w-0">
                                <Gem className="w-4 h-4 text-info flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wider truncate">Dofus obtenus (≥1)</p>
                                    <p className="text-base font-bold text-foreground tabular-nums leading-tight">{insights.uniqueObtained}<span className="text-caption text-muted-foreground font-semibold">/{stats.length}</span></p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-surface border border-border min-w-0">
                                <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wider truncate">Taux global</p>
                                    <p className="text-base font-bold text-success tabular-nums leading-tight">{insights.globalRate}%</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-surface border border-border min-w-0">
                                <BarChart3 className="w-4 h-4 text-warning flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wider truncate">Plus avancé</p>
                                    <p className="text-sm font-bold text-foreground uppercase truncate leading-tight">{insights.most.nameShort}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FILTRES RAPIDES */}
                    <div className="px-4 flex flex-wrap items-center gap-1.5">
                        {(["Tous", ">50%", "20-50%", "<20%"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setProgressFilter(f)}
                                className={`px-3 py-1.5 rounded-xl text-caption font-black uppercase tracking-widest transition-all cursor-pointer ${
                                    progressFilter === f
                                        ? "bg-info/20 text-info ring-1 ring-ring/40"
                                        : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {f === ">50%" ? "Progression >50%" : f === "20-50%" ? "20 – 50%" : f === "<20%" ? "<20%" : "Tous"}
                            </button>
                        ))}
                    </div>

                    {/* LISTE DE PROGRESSION — barres horizontales triées */}
                    <div className="px-4 flex flex-col gap-2">
                        <AnimatePresence mode="popLayout">
                            {quickFilteredStats.map((s) => {
                                const dofusGlow = getDofusColor(s.slug, s.color);
                                return (
                                    <motion.div
                                        layout
                                        key={s.dofusId}
                                        initial={{ opacity: 0, scale: 0.97 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        onClick={() => {
                                            setSelectedDofus(s);
                                            setModalSearch("");
                                            setModalStatusFilter("Tous");
                                        }}
                                        className="group flex items-center gap-3 px-3 py-2 rounded-2xl bg-background/40 border border-border hover:border-border-strong hover:bg-surface transition-all cursor-pointer"
                                        whileHover={{ x: 3 }}
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center flex-shrink-0 p-1 overflow-hidden">
                                            {s.imageUrl ? (
                                                <img src={s.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : s.imageUrl.replace(/^\/public/, "")} alt={s.nameShort} className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="w-full h-full rounded-lg" style={{ background: dofusGlow }} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-caption font-bold text-foreground uppercase tracking-wider truncate">{s.nameShort}</span>
                                                <div className="flex items-baseline gap-1 flex-shrink-0 ml-2">
                                                    <span className="text-caption font-bold text-foreground tabular-nums">{s.obtainedCount}</span>
                                                    <span className="text-caption text-muted-foreground font-black">/{s.totalMembers}</span>
                                                </div>
                                            </div>
                                            <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-border relative">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${s.obtainedPercent}%` }}
                                                    className="h-full rounded-full relative overflow-hidden"
                                                    style={{ background: `linear-gradient(90deg, ${dofusGlow}88, ${dofusGlow})` }}
                                                >
                                                    {s.obtainedPercent >= 15 && (
                                                        <span className="absolute inset-0 flex items-center justify-center text-caption font-black text-foreground/70 tabular-nums">{s.obtainedPercent}%</span>
                                                    )}
                                                </motion.div>
                                                {s.obtainedPercent < 15 && (
                                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-caption font-black text-muted-foreground tabular-nums">{s.obtainedPercent}%</span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                        
                        {filteredStats.length === 0 && (
                            <div className="col-span-full py-20 text-center">
                                <p className="text-foreground/20 font-black uppercase tracking-widest text-caption">Aucun Dofus trouvé</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* MODAL DÉTAIL DOFUS — Overlay glassmorphism premium             */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {selectedDofus && (
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={selectedDofus ? `Progression globale — ${selectedDofus.name}` : "Progression par Dofus"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.8)" }}
                        onClick={() => setSelectedDofus(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                            className="relative w-full max-w-xl bg-background/95 border border-border rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                            style={{ 
                                boxShadow: `0 0 60px ${getDofusColor(selectedDofus.slug, selectedDofus.color)}15, 0 0 120px rgba(0,0,0,0.8)` 
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Background ambient light */}
                            <div 
                                className="absolute top-0 right-0 w-64 h-64 blur-[80px] pointer-events-none opacity-20"
                                style={{ background: getDofusColor(selectedDofus.slug, selectedDofus.color) }}
                            />

                            {/* Header */}
                            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-black/60 rounded-2xl border border-border flex items-center justify-center p-1.5 shadow-lg shrink-0">
                                        {selectedDofus.imageUrl ? (
                                            <img 
                                                src={selectedDofus.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : selectedDofus.imageUrl.replace(/^\/public/, "")} 
                                                alt={selectedDofus.nameShort} 
                                                className="w-full h-full object-contain" 
                                            />
                                        ) : (
                                            <div className="w-full h-full rounded-xl" style={{ background: getDofusColor(selectedDofus.slug, selectedDofus.color) }} />
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-caption font-black uppercase tracking-widest text-muted-foreground">Progression Guilde</span>
                                        <h3 className="text-base font-black text-foreground italic uppercase tracking-tight leading-tight mt-0.5">{selectedDofus.name}</h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedDofus(null)}
                                    className="p-2 rounded-xl bg-surface hover:bg-surface text-muted-foreground hover:text-foreground transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Stats summary banner */}
                            <div className="px-4 sm:px-6 py-4 bg-surface border-b border-border grid grid-cols-3 gap-4 text-center shrink-0">
                                <div className="p-2.5 rounded-2xl bg-surface/40 border border-border">
                                    <p className="text-caption font-black text-muted-foreground uppercase tracking-wider mb-0.5">Obtenu par</p>
                                    <p className="text-xl font-black text-foreground italic">
                                        {selectedDofus.obtainedCount} <span className="text-xs text-muted-foreground font-bold">/{selectedDofus.totalMembers}</span>
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-2xl bg-surface/40 border border-border">
                                    <p className="text-caption font-black text-muted-foreground uppercase tracking-wider mb-0.5">Taux d'obtention</p>
                                    <p className="text-xl font-black italic" style={{ color: getDofusColor(selectedDofus.slug, selectedDofus.color) }}>
                                        {selectedDofus.obtainedPercent}%
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-2xl bg-surface/40 border border-border" title="Moyenne de progression des membres qui n'ont pas encore obtenu le Dofus">
                                    <p className="text-caption font-black text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                                        Moy. Progression <Info className="w-2.5 h-2.5 text-muted-foreground" />
                                    </p>
                                    <p className="text-xl font-black text-info italic">
                                        {selectedDofus.avgPercent}%
                                    </p>
                                </div>
                            </div>

                            {/* Search bar + filtres rapides */}
                            <div className="p-4 border-b border-border bg-background/20 shrink-0 space-y-3">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-info transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Filtrer les membres..."
                                        value={modalSearch}
                                        onChange={(e) => setModalSearch(e.target.value)}
                                        className="bg-muted/40 border border-border rounded-2xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/50 w-full transition-all"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {(["Tous", "Avec le Dofus", "Sans le Dofus", ">50%", "<50%"] as const).map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setModalStatusFilter(f)}
                                            className={`px-2.5 py-1 rounded-lg text-caption font-black uppercase tracking-widest transition-all cursor-pointer ${
                                                modalStatusFilter === f
                                                    ? "bg-info/20 text-info ring-1 ring-ring/40"
                                                    : "bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface"
                                            }`}
                                        >
                                            {f === ">50%" ? "En cours >50%" : f === "<50%" ? "En cours <50%" : f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Member Progress List */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
                                {modalFilteredProgress.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <p className="text-muted-foreground font-black uppercase text-caption tracking-widest">Aucun membre trouvé</p>
                                    </div>
                                ) : (
                                    visibleProgress.map((member) => (
                                        <div 
                                            key={member.profileId}
                                            onClick={() => {
                                                setSelectedDofus(null);
                                                onMemberClick?.(member.profileId, member.pseudo, member.image || undefined);
                                            }}
                                            className={`flex items-center gap-3 p-3 rounded-2xl bg-surface/20 border border-border hover:border-border hover:bg-surface transition-all cursor-pointer group/item ${member.isObtained ? "opacity-45 hover:opacity-75" : ""}`}
                                        >
                                            {/* Avatar */}
                                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-elevated flex-shrink-0 border border-border">
                                                {member.image ? (
                                                    <img src={member.image} alt={member.pseudo} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-caption flex items-center justify-center h-full font-black uppercase text-foreground/40">{member.pseudo[0]}</span>
                                                )}
                                            </div>

                                            {/* Pseudo and Progress */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-caption font-black text-foreground/90 uppercase tracking-wide truncate group-hover/item:text-foreground transition-colors">{member.pseudo}</span>
                                                    <span className={`text-caption font-black italic ml-2 flex-shrink-0 ${member.isObtained ? "text-success" : "text-foreground/40"}`}>
                                                        {member.isObtained ? "Obtenu ✓" : `${member.percent}%`}
                                                    </span>
                                                </div>
                                                {!member.isObtained && member.currentQuestNames && member.currentQuestNames.length > 0 && (
                                                    <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                                                        <span className="shrink-0 inline-flex items-center gap-1 text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                                            <Flag className="w-2.5 h-2.5" /> Je suis ici
                                                        </span>
                                                        <span className="truncate text-caption text-muted-foreground font-medium" title={member.currentQuestNames.join(", ")}>
                                                            {member.currentQuestNames.join(" · ")}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full rounded-full transition-all duration-300"
                                                        style={{ 
                                                            width: `${member.percent}%`,
                                                            background: member.isObtained ? "#10b981" : getDofusColor(selectedDofus.slug, selectedDofus.color)
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {modalFilteredProgress.length > modalVisibleCount && (
                                    <button
                                        type="button"
                                        onClick={() => setModalVisibleCount(c => c + 15)}
                                        className="w-full py-2.5 mt-1 text-caption font-black uppercase tracking-widest text-info/80 hover:text-info hover:bg-surface rounded-xl border border-border transition-colors cursor-pointer"
                                    >
                                        Afficher plus ({modalFilteredProgress.length - modalVisibleCount} restants)
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
 
function DofusGuildProgressCard({ stat, onClick }: { stat: GuildDofusStats; onClick: () => void }) {
    const dofusGlow = stat.color || "#6366f1";
    return (
        <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={onClick}
            className="group flex flex-col rounded-3xl border transition-all duration-300 overflow-hidden bg-gradient-to-br from-background to-surface/50 border-border hover:border-border hover:bg-surface/30  cursor-pointer relative"
            style={{
                borderColor: `rgba(255, 255, 255, 0.03)`,
            }}
            whileHover={{ 
                y: -4,
                borderColor: `${dofusGlow}30`,
                boxShadow: `0 10px 30px -10px ${dofusGlow}20, 0 1px 1px 0 rgba(255,255,255,0.05) inset`
            }}
        >
            {/* Soft background glow */}
            <div 
                className="absolute -right-10 -bottom-10 w-28 h-28 rounded-full blur-[40px] opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
                style={{ backgroundColor: dofusGlow }}
            />

            <div className="p-4 flex items-center gap-4 relative z-10">
                {/* Dofus Icon Wrapper with dynamic neon shadow on card hover */}
                <div 
                    className="w-12 h-12 bg-black/60 rounded-2xl border border-border flex items-center justify-center flex-shrink-0 p-1.5 shadow-inner transition-all duration-300 group- group-hover:border-border-strong"
                    style={{
                        boxShadow: `0 0 15px ${dofusGlow}00`
                    }}
                >
                    {stat.imageUrl ? (
                        <img 
                            src={stat.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : stat.imageUrl.replace(/^\/public/, "")} 
                            alt={stat.nameShort} 
                            className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] group-hover:drop-shadow-[0_0_12px_var(--dofus-glow)]"
                            style={{
                                ['--dofus-glow' as any]: dofusGlow
                            }}
                        />
                    ) : (
                        <div className="w-full h-full rounded-xl" style={{ background: dofusGlow }} />
                    )}
                </div>
 
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-foreground italic uppercase tracking-wider truncate transition-colors group-hover:text-foreground">{stat.nameShort}</span>
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-caption font-black text-foreground italic tabular-nums">{stat.obtainedCount}</span>
                            <span className="text-caption text-muted-foreground font-black">/{stat.totalMembers}</span>
                        </div>
                    </div>
                    {/* Thicker premium progress bar */}
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden p-[1px] border border-border">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stat.obtainedPercent}%` }}
                            className="h-full rounded-full relative overflow-hidden"
                            style={{
                                background: `linear-gradient(90deg, ${dofusGlow}88, ${dofusGlow})`,
                            }}
                        >
                            {/* Reflection sheen effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />
                        </motion.div>
                    </div>
                </div>
 
                <div className="text-right flex-shrink-0 pl-1">
                    <span 
                        className="text-xs font-black italic tabular-nums transition-all duration-300"
                        style={{ color: stat.obtainedPercent > 0 ? dofusGlow : "#71717a" }}
                    >
                        {stat.obtainedPercent}%
                    </span>
                </div>
            </div>
        </motion.div>
    );
}
