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
        if (capacityPercent >= 80) return "text-danger bg-danger/20 animate-pulse";
        if (capacityPercent >= 50) return "text-warning bg-warning/20";
        return "text-success bg-success/20";
    };

    const getProgressColor = () => {
        if (capacityPercent >= 80) return "bg-danger ";
        if (capacityPercent >= 50) return "bg-warning ";
        return "bg-success ";
    };

    return (
        <div className="space-y-4">
            {/* Alert Banner when capacity exceeds 50% or 80% */}
            {capacityPercent >= 80 ? (
                <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger flex items-center justify-between animate-in fade-in duration-300">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-danger shrink-0" />
                        <div className="text-xs font-bold">
                            ⚠️ Alerte Seuil Critique : La guilde utilise <span className="font-black text-foreground">{Math.round(capacityPercent)}%</span> de son quota de membres ({stats.active} / {stats.maxMembers}).
                        </div>
                    </div>
                    <span className="text-caption uppercase font-black tracking-widest text-danger bg-danger/20 px-2 py-1 rounded-md">
                        Limite &gt; 80%
                    </span>
                </div>
            ) : capacityPercent >= 50 ? (
                <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 text-warning flex items-center justify-between animate-in fade-in duration-300">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-warning shrink-0" />
                        <div className="text-xs font-bold">
                            ⚡ Attention Capacité : La guilde a dépassé la moitié de sa capacité ({stats.active} / {stats.maxMembers} — <span className="font-black text-foreground">{Math.round(capacityPercent)}%</span>).
                        </div>
                    </div>
                    <span className="text-caption uppercase font-black tracking-widest text-warning bg-warning/20 px-2 py-1 rounded-md">
                        Seuil &gt; 50%
                    </span>
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Active Members */}
                <div className="p-6 rounded-2xl bg-surface/40 border border-border backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 blur-[40px] -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-success/10 text-success">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className={`text-caption font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${getCapacityColor()}`}>
                            {stats.active} / {stats.maxMembers}
                        </span>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-foreground tracking-tighter">{stats.active}</div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Comptes Actifs</div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-4 h-1.5 w-full bg-surface rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ease-out rounded-full ${getProgressColor()}`}
                            style={{ width: `${capacityPercent}%` }}
                        />
                    </div>
                </div>

                {/* Archived Members */}
                <div className="p-6 rounded-2xl bg-surface/40 border border-border backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-muted/5 blur-[40px] -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-muted/10 text-muted-foreground">
                            <Ghost className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-foreground tracking-tighter">{stats.archived}</div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Archivés / Inactifs</div>
                    </div>
                </div>

                {/* Banned Members */}
                <div className="p-6 rounded-2xl bg-surface/40 border border-border backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-danger/5 blur-[40px] -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-danger/10 text-danger">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-danger tracking-tighter">{stats.banned}</div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Bannis Plateforme</div>
                    </div>
                </div>

                {/* Total Managed */}
                <div className="p-6 rounded-2xl bg-surface/40 border border-border backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-400/5 blur-[40px] -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-violet-400/10 text-violet-400">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-muted-foreground tracking-tighter">{stats.total}</div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Total Impacté</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
