"use client";

import { Users, Ghost, ShieldAlert } from "lucide-react";

interface MemberStatsOverviewProps {
    stats: {
        active: number;
        archived: number;
        banned: number;
        total: number;
        maxMembers: number;
    };
}

export function MemberStatsOverview({ stats }: MemberStatsOverviewProps) {
    const capacityPercent = stats.maxMembers > 0 ? Math.min(100, (stats.active / stats.maxMembers) * 100) : 0;

    const getCapacityColor = () => {
        if (capacityPercent >= 80) return "text-red-400 bg-red-400/20 animate-pulse";
        if (capacityPercent >= 50) return "text-amber-400 bg-amber-400/20";
        return "text-emerald-400 bg-emerald-400/20";
    };

    const getProgressColor = () => {
        if (capacityPercent >= 80) return "bg-red-500 ";
        if (capacityPercent >= 50) return "bg-amber-500 ";
        return "bg-emerald-500 ";
    };

    return (
        <div className="space-y-4">
            {/* Alert Banner when capacity exceeds 50% or 80% */}
            {capacityPercent >= 80 ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center justify-between animate-in fade-in duration-300">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                        <div className="text-xs font-bold">
                            ⚠️ Alerte Seuil Critique : La guilde utilise <span className="font-black text-white">{Math.round(capacityPercent)}%</span> de son quota de membres ({stats.active} / {stats.maxMembers}).
                        </div>
                    </div>
                    <span className="text-caption uppercase font-black tracking-widest text-red-400 bg-red-500/20 px-2 py-1 rounded-md">
                        Limite &gt; 80%
                    </span>
                </div>
            ) : capacityPercent >= 50 ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-between animate-in fade-in duration-300">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-400 shrink-0" />
                        <div className="text-xs font-bold">
                            ⚡ Attention Capacité : La guilde a dépassé la moitié de sa capacité ({stats.active} / {stats.maxMembers} — <span className="font-black text-white">{Math.round(capacityPercent)}%</span>).
                        </div>
                    </div>
                    <span className="text-caption uppercase font-black tracking-widest text-amber-400 bg-amber-500/20 px-2 py-1 rounded-md">
                        Seuil &gt; 50%
                    </span>
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Active Members */}
                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-[40px] -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className={`text-caption font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${getCapacityColor()}`}>
                            {stats.active} / {stats.maxMembers}
                        </span>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-white tracking-tighter">{stats.active}</div>
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Comptes Actifs</div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ease-out rounded-full ${getProgressColor()}`}
                            style={{ width: `${capacityPercent}%` }}
                        />
                    </div>
                </div>

                {/* Archived Members */}
                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-400/5 blur-[40px] -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-zinc-400/10 text-zinc-400">
                            <Ghost className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-zinc-200 tracking-tighter">{stats.archived}</div>
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Archivés / Inactifs</div>
                    </div>
                </div>

                {/* Banned Members */}
                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-400/5 blur-[40px] -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-red-400/10 text-red-400">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-red-400 tracking-tighter">{stats.banned}</div>
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Bannis Plateforme</div>
                    </div>
                </div>

                {/* Total Managed */}
                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-400/5 blur-[40px] -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-violet-400/10 text-violet-400">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-zinc-400 tracking-tighter">{stats.total}</div>
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Total Impacté</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
