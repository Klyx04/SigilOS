"use client";

import Image from "next/image";
import { Trophy, Users, TrendingUp, Crown, Flame, Zap, Shield, Swords, Map } from "lucide-react";
import { motion } from "framer-motion";
import type { GuildDofusStats, MemberDofusSummary, WarRoomData } from "@/server/actions/dofus-quest-actions";

interface GuildDofusOverviewProps {
    stats: GuildDofusStats[];
    topMembers: MemberDofusSummary[];
    totalMembers: number;
    warRoom: WarRoomData | null;
}

export function GuildDofusOverview({ stats, topMembers, totalMembers, warRoom }: GuildDofusOverviewProps) {
    return (
        <div className="flex flex-col gap-10">
            {/* ── ⚔️ WAR ROOM : DASHBOARD STRATÉGIQUE ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 📍 HEATMAP : ZONES CHAUDES */}
                <div className="lg:col-span-7 bg-[#0a0b0d] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-transparent pointer-events-none" />
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                                <Map className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white italic uppercase tracking-tighter">Heatmap Mondaine</h3>
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-none mt-0.5">Zones actives de la guilde</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Temps Réel</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {warRoom?.hotZones.length === 0 ? (
                            <div className="text-center py-12 text-white/10 uppercase font-black italic text-sm tracking-widest">
                                Électroencéphalogramme plat
                            </div>
                        ) : (
                            warRoom?.hotZones.map((hz, idx) => (
                                <motion.div 
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: idx * 0.1 }}
                                    key={hz.zone} 
                                    className="flex items-center gap-4 group/hz"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center flex-shrink-0 group-hover/hz:border-orange-500/40 transition-colors">
                                        <span className="text-sm font-black text-orange-400 tabular-nums leading-none">{hz.count}</span>
                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">Membres</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-black text-white/70 italic uppercase truncate">{hz.zone}</span>
                                            <span className="text-[9px] font-black text-orange-500/50 uppercase tracking-widest">Hot Zone</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(hz.count / totalMembers) * 100}%` }}
                                                className="h-full bg-gradient-to-r from-orange-900 to-orange-500 rounded-full" 
                                            />
                                        </div>
                                    </div>
                                    <div className="flex -space-x-2">
                                        {hz.members.slice(0, 3).map((m, i) => (
                                            <div key={i} title={m.pseudo} className="w-6 h-6 rounded-full border-2 border-[#0a0b0d] bg-zinc-800 flex items-center justify-center overflow-hidden">
                                                {m.image ? <img src={m.image} alt={m.pseudo} /> : <span className="text-[8px] font-black">{m.pseudo.charAt(0)}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* ⛓️ SYNERGIES : QUÊTES & DONJONS */}
                <div className="lg:col-span-5 space-y-6">
                    
                    {/* Donjons Prioritaires */}
                    <div className="bg-[#0a0b0d] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white italic uppercase tracking-tighter">Raids Potentiels</h3>
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-none mt-0.5">Donjons requis par le groupe</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {warRoom?.dungeonSynergies.length === 0 ? (
                                <p className="text-center py-6 text-white/10 text-[10px] uppercase font-black">Aucun donjon commun détecté</p>
                            ) : (
                                warRoom?.dungeonSynergies.map((ds, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all group/raid">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs">🏰</div>
                                            <div>
                                                <p className="text-xs font-black text-white/80 italic uppercase truncate max-w-[120px]">{ds.dungeonName}</p>
                                                <p className="text-[9px] text-white/30 font-bold uppercase tracking-tighter">{ds.count} membres bloqués</p>
                                            </div>
                                        </div>
                                        <button className="h-7 px-3 rounded-lg bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-widest border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all">Organiser</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Synergies de Quêtes */}
                    <div className="bg-[#0a0b0d] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white italic uppercase tracking-tighter">Synergies Actives</h3>
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-none mt-0.5">Membres sur la même étape</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {warRoom?.questSynergies.map((qs, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 rounded-xl border border-white/5 bg-black/40">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-[11px] font-black text-white/60 truncate italic flex-1">{qs.questName}</span>
                                    <div className="flex -space-x-1.5">
                                        {qs.players.slice(0, 3).map((p, j) => (
                                            <div key={j} title={p.pseudo} className="w-5 h-5 rounded-full border border-black bg-zinc-800 overflow-hidden">
                                                {p.image ? <img src={p.image} alt={p.pseudo} /> : <span className="text-[7px] flex items-center justify-center h-full font-black uppercase">{p.pseudo[0]}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* ── 👤 MEMBRES : CLASSEMENT DOFUS ── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                
                {/* Ranking List */}
                <div className="xl:col-span-5 flex flex-col gap-4">
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
                        {topMembers.slice(0, 8).map((member, index) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                key={member.profileId}
                                className="group/member flex items-center gap-4 px-5 py-4 rounded-2xl bg-zinc-950/40 border border-white/5 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300"
                            >
                                <div className="w-8 flex-shrink-0 flex items-center justify-center">
                                    {index === 0 ? (
                                        <Crown className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_#fbbf2466]" />
                                    ) : (
                                        <span className={`text-lg font-black italic tabular-nums ${index < 3 ? "text-white/60" : "text-white/20"}`}>
                                            #{index + 1}
                                        </span>
                                    )}
                                </div>

                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover/member:scale-110 transition-transform">
                                    {member.image ? (
                                        <img src={member.image} alt={member.pseudo} />
                                    ) : (
                                        <span className="text-sm font-black text-orange-400 italic">{member.pseudo.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-white italic uppercase truncate tracking-tight">{member.pseudo}</p>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {member.dofusList
                                            .filter((d) => d.isObtained)
                                            .slice(0, 7)
                                            .map((d) => (
                                                <span
                                                    key={d.slug}
                                                    className="w-1.5 h-1.5 rounded-full ring-1 ring-white/10 shadow-[0_0_4px_var(--color)]"
                                                    style={{ backgroundColor: d.color || "#6366f1", '--color': d.color || "#6366f1" } as any}
                                                    title={d.name}
                                                />
                                            ))}
                                    </div>
                                </div>

                                <div className="text-right flex-shrink-0">
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-2xl font-black italic tabular-nums ${index === 0 ? "text-amber-400" : "text-white/80"}`}>
                                            {member.dofusObtained}
                                        </span>
                                        <span className="text-[10px] text-white/30 font-black">/ {member.dofusTotal}</span>
                                    </div>
                                    <p className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] mt-0.5">Dofus Obtenus</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Dofus Bars */}
                <div className="xl:col-span-7 flex flex-col gap-6">
                    <div className="flex items-center gap-3 px-4">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-base font-black text-white italic uppercase tracking-tighter">
                            Expansion de l'Arsenal
                        </h3>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 bg-zinc-950/20 border border-white/5 rounded-[2rem] p-8">
                        {stats.slice(0, 12).map((s) => (
                            <div key={s.dofusId} className="flex items-center gap-4 group/stat py-1">
                                <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center flex-shrink-0 group-hover/stat:border-indigo-500/40 transition-colors bg-black/40 p-1">
                                    {s.imageUrl ? (
                                        <img src={s.imageUrl} alt={s.nameShort} className="object-contain" />
                                    ) : (
                                        <div className="w-full h-full rounded-full" style={{ background: s.color || "#6366f1" }} />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest truncate">{s.nameShort}</span>
                                        <span className="text-[10px] font-black text-white/30 tabular-nums">
                                            {s.obtainedCount} / {s.totalMembers}
                                        </span>
                                    </div>
                                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${s.obtainedPercent}%` }}
                                            className="h-full rounded-full"
                                            style={{
                                                background: s.color || "#6366f1",
                                                boxShadow: s.obtainedCount > 0 ? `0 0 8px ${s.color}44` : "none",
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="w-10 text-right">
                                    <span className="text-[11px] font-black text-white/20 tabular-nums">{s.obtainedPercent}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
