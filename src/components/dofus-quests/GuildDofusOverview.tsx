"use client";
 
import { useState, useMemo } from "react";
import { Trophy, Users, TrendingUp, Crown, Search, X, Gem, CheckCircle2, Star, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { GuildDofusStats, MemberDofusSummary } from "@/server/actions/dofus-quest-actions";
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
    totalMembers: number;
    guildId?: string;
    onMemberClick?: (profileId: string, pseudo: string, avatarUrl?: string) => void;
}
 
export function GuildDofusOverview({ stats, topMembers, totalMembers, onMemberClick }: GuildDofusOverviewProps) {
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("Tous");
    const [selectedDofus, setSelectedDofus] = useState<GuildDofusStats | null>(null);
    const [modalSearch, setModalSearch] = useState("");

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

    const modalFilteredProgress = useMemo(() => {
        if (!selectedDofus) return [];
        return selectedDofus.membersProgress.filter(m => 
            !modalSearch || m.pseudo.toLowerCase().includes(modalSearch.toLowerCase())
        );
    }, [selectedDofus, modalSearch]);
 
    return (
        <div className="flex flex-col gap-12 pt-4">
            {/* ── 👤 MEMBRES : CLASSEMENT DOFUS ── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                
                {/* 🏆 TABLE D'HONNEUR */}
                <div className="xl:col-span-4 flex flex-col gap-4">
                    <div className="flex items-center gap-3 px-4">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h3 className="text-base font-black text-white italic uppercase tracking-tighter">
                            Table d'Honneur
                        </h3>
                        <div className="h-px flex-1 bg-white/5" />
                        <span className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-3.5 h-3.5" />
                            {totalMembers} Actifs
                        </span>
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
                                    className={`group/member flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 cursor-pointer relative border ${
                                        isFirst 
                                            ? "bg-gradient-to-br from-amber-500/10 via-zinc-950 to-zinc-950 border-amber-500/25 shadow-[0_4px_20px_rgba(251,191,36,0.06)] hover:border-amber-500/40" 
                                            : "bg-zinc-950/40 border-white/5 hover:bg-white/[0.03] hover:border-white/10"
                                    }`}
                                >
                                    {isFirst && (
                                        <div className="absolute top-0 right-10 w-24 h-24 bg-amber-500/5 blur-[20px] rounded-full pointer-events-none" />
                                    )}
                                    
                                    <div className="w-6 flex-shrink-0 flex items-center justify-center">
                                        {isFirst ? (
                                            <Crown className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse" />
                                        ) : isSecond ? (
                                            <span className="text-sm font-black italic text-zinc-300 drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">#2</span>
                                        ) : isThird ? (
                                            <span className="text-sm font-black italic text-amber-700/80">#3</span>
                                        ) : (
                                            <span className="text-xs font-bold italic text-zinc-600 group-hover/member:text-zinc-500 transition-colors">
                                                #{index + 1}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border transition-all ${
                                        isFirst 
                                            ? "border-amber-500/30 bg-amber-500/5 shadow-[0_0_10px_rgba(251,191,36,0.1)]" 
                                            : "border-white/5 bg-zinc-900"
                                    }`}>
                                        {member.image ? (
                                            <img src={member.image} alt={member.pseudo} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className={`text-xs font-black italic ${isFirst ? "text-amber-400" : "text-zinc-400"}`}>
                                                {member.pseudo.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-black italic uppercase truncate tracking-tight transition-colors ${
                                            isFirst ? "text-amber-400 group-hover/member:text-amber-300" : "text-zinc-300 group-hover/member:text-white"
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
                                                isFirst ? "text-amber-400" : "text-zinc-200"
                                            }`}>
                                                {member.dofusObtained}
                                            </span>
                                            <span className="text-[10px] text-zinc-600 font-black">/{member.dofusTotal}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
 
                {/* ⚔️ PROGRESSION DES DOFUS */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-indigo-400" />
                            <h3 className="text-base font-black text-white italic uppercase tracking-tighter">
                                Progression Guilde
                            </h3>
                        </div>
 
                        <div className="flex items-center gap-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                                <input
                                    type="text"
                                    placeholder="Chercher Dofus..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all min-w-[150px]"
                                />
                            </div>
 
                            {/* Category Filter */}
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[140px] h-8 bg-black/40 border-white/10 text-[10px] font-bold uppercase tracking-widest rounded-xl">
                                    <SelectValue placeholder="Catégorie" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-white/10 text-white rounded-xl shadow-2xl">
                                    {categories.map(cat => (
                                        <SelectItem key={cat} value={cat} className="text-[10px] font-bold uppercase tracking-wider focus:bg-white/10 focus:text-white cursor-pointer">
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
 
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                        <AnimatePresence mode="popLayout">
                            {filteredStats.map((s) => (
                                <DofusGuildProgressCard 
                                    key={s.dofusId} 
                                    stat={s} 
                                    onClick={() => {
                                        setSelectedDofus(s);
                                        setModalSearch("");
                                    }} 
                                />
                            ))}
                        </AnimatePresence>
                        
                        {filteredStats.length === 0 && (
                            <div className="col-span-full py-20 text-center">
                                <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px]">Aucun Dofus trouvé</p>
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
                            className="relative w-full max-w-xl bg-zinc-950/95 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                            style={{ 
                                boxShadow: `0 0 60px ${selectedDofus.color || "#6366f1"}15, 0 0 120px rgba(0,0,0,0.8)` 
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Background ambient light */}
                            <div 
                                className="absolute top-0 right-0 w-64 h-64 blur-[80px] pointer-events-none opacity-20"
                                style={{ background: selectedDofus.color || "#6366f1" }}
                            />

                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/5 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-black/60 rounded-2xl border border-white/10 flex items-center justify-center p-1.5 shadow-lg shrink-0">
                                        {selectedDofus.imageUrl ? (
                                            <img 
                                                src={selectedDofus.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : selectedDofus.imageUrl.replace(/^\/public/, "")} 
                                                alt={selectedDofus.nameShort} 
                                                className="w-full h-full object-contain" 
                                            />
                                        ) : (
                                            <div className="w-full h-full rounded-xl" style={{ background: selectedDofus.color || "#6366f1" }} />
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Progression Guilde</span>
                                        <h3 className="text-base font-black text-white italic uppercase tracking-tight leading-tight mt-0.5">{selectedDofus.name}</h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedDofus(null)}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Stats summary banner */}
                            <div className="px-6 py-4 bg-white/[0.01] border-b border-white/5 grid grid-cols-3 gap-4 text-center shrink-0">
                                <div className="p-2.5 rounded-2xl bg-zinc-900/40 border border-white/5">
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider mb-0.5">Obtenu par</p>
                                    <p className="text-xl font-black text-white italic">
                                        {selectedDofus.obtainedCount} <span className="text-xs text-zinc-500 font-bold">/{selectedDofus.totalMembers}</span>
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-2xl bg-zinc-900/40 border border-white/5">
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider mb-0.5">Taux d'obtention</p>
                                    <p className="text-xl font-black italic" style={{ color: selectedDofus.color || "#6366f1" }}>
                                        {selectedDofus.obtainedPercent}%
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-2xl bg-zinc-900/40 border border-white/5">
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider mb-0.5">Moy. Progression</p>
                                    <p className="text-xl font-black text-indigo-400 italic">
                                        {selectedDofus.avgPercent}%
                                    </p>
                                </div>
                            </div>

                            {/* Search bar inside Modal */}
                            <div className="p-4 border-b border-white/5 bg-zinc-950/20 shrink-0">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Filtrer les membres..."
                                        value={modalSearch}
                                        onChange={(e) => setModalSearch(e.target.value)}
                                        className="bg-black/40 border border-white/5 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 w-full transition-all"
                                    />
                                </div>
                            </div>

                            {/* Member Progress List */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
                                {modalFilteredProgress.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <p className="text-zinc-600 font-black uppercase text-[10px] tracking-widest">Aucun membre trouvé</p>
                                    </div>
                                ) : (
                                    modalFilteredProgress.map((member) => (
                                        <div 
                                            key={member.profileId}
                                            onClick={() => {
                                                setSelectedDofus(null);
                                                onMemberClick?.(member.profileId, member.pseudo, member.image || undefined);
                                            }}
                                            className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/20 border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all cursor-pointer group/item"
                                        >
                                            {/* Avatar */}
                                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/5">
                                                {member.image ? (
                                                    <img src={member.image} alt={member.pseudo} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[10px] flex items-center justify-center h-full font-black uppercase text-white/40">{member.pseudo[0]}</span>
                                                )}
                                            </div>

                                            {/* Pseudo and Progress */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[11px] font-black text-white/90 uppercase tracking-wide truncate group-hover/item:text-white transition-colors">{member.pseudo}</span>
                                                    <span className={`text-[10px] font-black italic ${member.isObtained ? "text-emerald-400" : "text-white/40"}`}>
                                                        {member.isObtained ? "Obtenu ✓" : `${member.percent}%`}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full rounded-full transition-all duration-300"
                                                        style={{ 
                                                            width: `${member.percent}%`,
                                                            background: member.isObtained ? "#10b981" : (selectedDofus.color || "#6366f1")
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
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
            className="group flex flex-col rounded-3xl border transition-all duration-500 overflow-hidden bg-gradient-to-br from-zinc-950 to-zinc-900/50 border-white/5 hover:border-white/10 hover:bg-zinc-900/30 hover:shadow-[0_0_30px_rgba(0,0,0,0.6)] cursor-pointer relative"
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
                className="absolute -right-10 -bottom-10 w-28 h-28 rounded-full blur-[40px] opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"
                style={{ backgroundColor: dofusGlow }}
            />

            <div className="p-4 flex items-center gap-4 relative z-10">
                {/* Dofus Icon Wrapper with dynamic neon shadow on card hover */}
                <div 
                    className="w-12 h-12 bg-black/60 rounded-2xl border border-white/10 flex items-center justify-center flex-shrink-0 p-1.5 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:border-white/20"
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
                        <span className="text-xs font-black text-white italic uppercase tracking-wider truncate transition-colors group-hover:text-zinc-200">{stat.nameShort}</span>
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-[11px] font-black text-white italic tabular-nums">{stat.obtainedCount}</span>
                            <span className="text-[9px] text-zinc-500 font-black">/{stat.totalMembers}</span>
                        </div>
                    </div>
                    {/* Thicker premium progress bar */}
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden p-[1px] border border-white/5">
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
