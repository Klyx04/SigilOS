"use client";
 
import { useState, useMemo } from "react";
import { Trophy, Users, TrendingUp, Crown, Search, Filter } from "lucide-react";
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
}
 
export function GuildDofusOverview({ stats, topMembers, totalMembers }: GuildDofusOverviewProps) {
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("Tous");
 
    // Get unique filter categories from stats
    const categories = useMemo(() => {
        const cats = new Set<string>();
        cats.add("Tous");
        stats.forEach(s => {
            // We use rarity or filterCategory if available. 
            // Since DofusItem has filterCategory, let's assume it's passed or use rarity as fallback.
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
                        {topMembers.slice(0, 10).map((member, index) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                key={member.profileId}
                                className="group/member flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-950/40 border border-white/5 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300"
                            >
                                <div className="w-6 flex-shrink-0 flex items-center justify-center">
                                    {index === 0 ? (
                                        <Crown className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
                                    ) : (
                                        <span className={`text-sm font-black italic tabular-nums ${index < 3 ? "text-white/60" : "text-white/20"}`}>
                                            #{index + 1}
                                        </span>
                                    )}
                                </div>
 
                                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {member.image ? (
                                        <img src={member.image} alt={member.pseudo} />
                                    ) : (
                                        <span className="text-xs font-black text-orange-400 italic">{member.pseudo.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
 
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-white italic uppercase truncate tracking-tight">{member.pseudo}</p>
                                    <div className="flex flex-wrap gap-0.5 mt-1">
                                        {member.dofusList
                                            .filter((d) => d.isObtained)
                                            .slice(0, 12)
                                            .map((d) => (
                                                <div
                                                    key={d.slug}
                                                    className="w-1.5 h-1.5 rounded-full ring-1 ring-white/10"
                                                    style={{ backgroundColor: d.color || "#6366f1" }}
                                                    title={d.name}
                                                />
                                            ))}
                                    </div>
                                </div>
 
                                <div className="text-right flex-shrink-0">
                                    <div className="flex items-baseline gap-0.5">
                                        <span className={`text-base font-black italic tabular-nums ${index === 0 ? "text-amber-400" : "text-white/80"}`}>
                                            {member.dofusObtained}
                                        </span>
                                        <span className="text-[8px] text-white/30 font-black">/{member.dofusTotal}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
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
                                <DofusGuildProgressCard key={s.dofusId} stat={s} />
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
        </div>
    );
}
 
function DofusGuildProgressCard({ stat }: { stat: GuildDofusStats }) {
    const [isExpanded, setIsExpanded] = useState(false);
 
    return (
        <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden ${
                isExpanded ? "bg-zinc-900/80 border-white/30 shadow-2xl z-10" : "bg-zinc-950/40 border-white/5 hover:border-white/10"
            }`}
        >
            <div 
                className="p-3 flex items-center gap-3 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="w-10 h-10 bg-black/60 rounded-xl border border-white/10 flex items-center justify-center flex-shrink-0 p-1 shadow-lg">
                    {stat.imageUrl ? (
                        <img src={stat.imageUrl} alt={stat.nameShort} className="w-full h-full object-contain" />
                    ) : (
                        <div className="w-full h-full rounded-lg" style={{ background: stat.color || "#6366f1" }} />
                    )}
                </div>
 
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-black text-white italic uppercase tracking-wider truncate">{stat.nameShort}</span>
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-[10px] font-black text-white italic tabular-nums">{stat.obtainedCount}</span>
                            <span className="text-[8px] text-white/30 font-black">/{stat.totalMembers}</span>
                        </div>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stat.obtainedPercent}%` }}
                            className="h-full rounded-full"
                            style={{
                                background: stat.color || "#6366f1",
                            }}
                        />
                    </div>
                </div>
 
                <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-black text-white italic tabular-nums">{stat.obtainedPercent}%</span>
                </div>
            </div>
 
            {isExpanded && (
                <div className="px-3 pb-3 border-t border-white/5 bg-black/20">
                    <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">Membres et avancée</p>
                            <span className="text-[8px] font-black text-indigo-400/60 uppercase tracking-widest">Moy. {stat.avgPercent}%</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
                            {stat.membersProgress.map((member) => (
                                <div key={member.profileId} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                                    <div className="w-6 h-6 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/5">
                                        {member.image ? <img src={member.image} alt={member.pseudo} /> : <span className="text-[8px] flex items-center justify-center h-full font-black uppercase text-white/40">{member.pseudo[0]}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-bold text-white/70 truncate">{member.pseudo}</span>
                                            <span className={`text-[9px] font-black ${member.isObtained ? "text-emerald-400" : "text-white/40"}`}>{member.percent}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

