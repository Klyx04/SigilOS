"use client";
import { useState, useEffect } from "react";
import { ClipboardList, Trophy } from "lucide-react";
import Link from "next/link";
import { getPendingValidationsCount } from "@/server/actions/admin-actions";

interface ValidatorInboxClientProps {
    guildId: string;
    initialData: {
        pendingMissions: number;
        pendingAchievements: number;
        total: number;
    }
}

export function ValidatorInboxClient({ guildId, initialData }: ValidatorInboxClientProps) {
    const [data, setData] = useState(initialData);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await getPendingValidationsCount(guildId);
                if (res.success && res.data) {
                    setData(res.data);
                }
            } catch (err) {
                console.error("Failed to poll pending validations", err);
            }
        }, 15000); // Poll every 15 seconds

        return () => clearInterval(interval);
    }, [guildId]);

    if (data.total === 0) return null;

    return (
        <Link
            href={`/dashboard/${guildId}/admin/validation`}
            className="group flex flex-col gap-2.5 px-5 py-4 rounded-[2rem] border border-orange-500/20 bg-black/60 backdrop-blur-xl hover:bg-orange-500/10 hover:border-orange-500/50 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.2)] animate-in fade-in slide-in-from-right-4 duration-500"
        >
            {/* Title */}
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    Action Requise
                </p>
                <div className="p-1.5 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                    <ClipboardList className="w-3.5 h-3.5 text-orange-400" />
                </div>
            </div>

            {/* Counts */}
            <div className="flex items-center gap-4">
                {data.pendingMissions > 0 && (
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-white tabular-nums tracking-tighter">{data.pendingMissions}</span>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Missions</span>
                        </div>
                    </div>
                )}

                {data.pendingMissions > 0 && data.pendingAchievements > 0 && (
                    <div className="w-px h-6 bg-white/10" />
                )}

                {data.pendingAchievements > 0 && (
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-white tabular-nums tracking-tighter">{data.pendingAchievements}</span>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none text-amber-500/50">Succès</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-1 flex items-center gap-2">
                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 w-full animate-pulse" />
                </div>
                <span className="text-[9px] font-bold text-orange-400/60 uppercase whitespace-nowrap">Détails →</span>
            </div>
        </Link>
    );
}
