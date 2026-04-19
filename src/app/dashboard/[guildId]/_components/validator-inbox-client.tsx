"use client";
import { useState, useEffect } from "react";
import { ClipboardList, FileImage, Trophy, Coins, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getPendingValidationsCount } from "@/server/actions/admin-actions";
import { cn } from "@/lib/utils";

interface ValidatorInboxClientProps {
    guildId: string;
    initialData: {
        pendingMissions: number;
        pendingAchievements: number;
        pendingKamas?: number;
        total: number;
    }
}

type FilterType = "all" | "missions" | "achievements" | "kamas";

const FILTER_CFG = {
    all: { label: "Tout", color: "bg-orange-500", textActive: "text-white", textInactive: "text-orange-400" },
    missions: { label: "Missions", color: "bg-rose-500", textActive: "text-white", textInactive: "text-rose-400" },
    achievements: { label: "Succès", color: "bg-amber-500", textActive: "text-white", textInactive: "text-amber-400" },
    kamas: { label: "Kamas", color: "bg-yellow-500", textActive: "text-black", textInactive: "text-yellow-400" },
};

export function ValidatorInboxClient({ guildId, initialData }: ValidatorInboxClientProps) {
    const [data, setData] = useState(initialData);
    const [filter, setFilter] = useState<FilterType>("all");

    useEffect(() => {
        // Refresh every 60s — this is just a badge count, not realtime
        const interval = setInterval(async () => {
            try {
                const res = await getPendingValidationsCount(guildId);
                if (res.success && res.data) {
                    setData(res.data as any);
                }
            } catch (err) {
                console.error("Failed to poll pending validations", err);
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [guildId]);

    const pendingKamas = (data as any).pendingKamas ?? 0;
    const displayCount =
        filter === "missions" ? data.pendingMissions :
            filter === "achievements" ? data.pendingAchievements :
                filter === "kamas" ? pendingKamas :
                    data.total;

    if (data.total === 0) return null;

    // Validation page route per filter
    const href = `/dashboard/${guildId}/admin/validation` + (filter !== "all" ? `?type=${filter}` : "");

    return (
        <div className="flex flex-col gap-2 px-5 py-4 rounded-[2rem] border border-orange-500/20 bg-black/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Title */}
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                    </span>
                    Action Requise
                </p>
                <div className="p-1.5 bg-orange-500/10 rounded-lg">
                    <ClipboardList className="w-3.5 h-3.5 text-orange-400" />
                </div>
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1 flex-wrap">
                {(["all", "missions", "achievements", "kamas"] as FilterType[]).map((f) => {
                    const count = f === "all" ? data.total : f === "missions" ? data.pendingMissions : f === "achievements" ? data.pendingAchievements : pendingKamas;
                    if (f !== "all" && count === 0) return null;
                    const cfg = FILTER_CFG[f];
                    const active = filter === f;
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all",
                                active ? `${cfg.color} ${cfg.textActive} border-transparent` : `bg-transparent ${cfg.textInactive} border-current opacity-70 hover:opacity-100`
                            )}
                        >
                            {f === "missions" && <FileImage className="w-2.5 h-2.5" />}
                            {f === "achievements" && <Trophy className="w-2.5 h-2.5" />}
                            {f === "kamas" && <Coins className="w-2.5 h-2.5" />}
                            {cfg.label}
                            <span className="ml-0.5 tabular-nums">{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Big count + link */}
            <Link href={href} className="group flex items-center justify-between hover:bg-orange-500/5 -mx-2 px-2 py-1 rounded-xl transition-all">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-white tabular-nums tracking-tighter">{displayCount}</span>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">
                        {filter === "missions" ? "Mission" : filter === "achievements" ? "Succès" : filter === "kamas" ? "Kama" : "en attente"}{displayCount > 1 && filter !== "all" ? "s" : ""}
                    </span>
                </div>
                <ChevronRight className="w-4 h-4 text-orange-400/60 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
            </Link>

            {/* Progress bar */}
            <div className="flex items-center gap-2">
                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden flex">
                    {data.pendingMissions > 0 && <div className="h-full bg-rose-500 transition-all" style={{ width: `${(data.pendingMissions / data.total) * 100}%` }} />}
                    {data.pendingAchievements > 0 && <div className="h-full bg-amber-500 transition-all" style={{ width: `${(data.pendingAchievements / data.total) * 100}%` }} />}
                    {pendingKamas > 0 && <div className="h-full bg-yellow-400 transition-all" style={{ width: `${(pendingKamas / data.total) * 100}%` }} />}
                </div>
                <span className="text-[9px] font-bold text-orange-400/60 uppercase whitespace-nowrap">Détails</span>
            </div>
        </div>
    );
}
