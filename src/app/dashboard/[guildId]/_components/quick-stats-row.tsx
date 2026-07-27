"use client";

import { motion } from "framer-motion";
import { Users, Sparkles, Moon, CalendarDays, Star } from "lucide-react";
import { PresenceFacepile } from "./presence-facepile";

interface QuickStatsRowProps {
    onlineCount: number;
    totalMembers: number;
    songesCompleted: number;
    eventsCount: number;
    dofusCompletionRate: number;
    topActivityName: string;
    topActivityValue: string;
    onlineUsers: { id: string; name: string; image: string | null }[];
}

function StatCard({
    icon: Icon,
    label,
    value,
    sublabel,
    accentColor,
    delay,
}: {
    icon: typeof Users;
    label: string;
    value: string | number;
    sublabel?: string;
    accentColor: string;
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            className="relative group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500"
        >
            <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${accentColor} opacity-60 group-hover:opacity-100 transition-opacity`} />

            <div className="p-5 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${accentColor.replace("from-", "bg-").replace("/60", "/10")} border-current/10`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
                    <p className="text-2xl font-black text-white mt-0.5 tabular-nums">{value}</p>
                    {sublabel && (
                        <p className="text-[10px] text-zinc-500 font-medium mt-0.5 truncate">{sublabel}</p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export function QuickStatsRow({
    onlineCount,
    totalMembers,
    songesCompleted,
    eventsCount,
    dofusCompletionRate,
    topActivityName,
    topActivityValue,
    onlineUsers,
}: QuickStatsRowProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Online Members — with facepile */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0 }}
                className="relative group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500"
            >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500/60 to-emerald-400/60 opacity-60 group-hover:opacity-100 transition-opacity" />

                <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">En ligne</p>
                                <p className="text-2xl font-black text-white mt-0.5 tabular-nums">
                                    {onlineCount}
                                    <span className="text-sm font-bold text-zinc-600 ml-1">/ {totalMembers}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {onlineUsers.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                            <PresenceFacepile users={onlineUsers} />
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Songes Completed */}
            <StatCard
                icon={Moon}
                label="Songes complétés"
                value={songesCompleted}
                sublabel="Run terminés"
                accentColor="from-blue-500/60 to-blue-400/60"
                delay={0.1}
            />

            {/* Events Count */}
            <StatCard
                icon={CalendarDays}
                label="Événements"
                value={eventsCount}
                sublabel="Organisés"
                accentColor="from-cyan-500/60 to-cyan-400/60"
                delay={0.2}
            />

            {/* Dofus Progression + Top Activity */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="relative group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500"
            >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500/60 to-amber-400/60 opacity-60 group-hover:opacity-100 transition-opacity" />

                <div className="p-5 flex flex-col gap-2">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Progression Dofus</p>
                            <p className="text-2xl font-black text-white mt-0.5 tabular-nums">{dofusCompletionRate}%</p>
                            <p className="text-[10px] text-zinc-500 font-medium mt-0.5 truncate">Moyenne guilde</p>
                        </div>
                    </div>

                    {topActivityName && (
                        <div className="pt-2 mt-1 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <Star className="w-3 h-3 text-amber-400/60 shrink-0" />
                                <span className="text-[10px] text-zinc-500 font-medium truncate">
                                    <span className="text-zinc-400 font-bold">{topActivityName}</span> — {topActivityValue}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}