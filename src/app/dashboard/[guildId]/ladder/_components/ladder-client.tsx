"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Clock, Trophy, Loader2, ShieldCheck, CheckSquare } from "lucide-react";
import { LeaderboardCard } from "./leaderboard-card";
import {
    getActivityLadder,
    getSeniorityLadder,
    getSuccessLadder,
    type LadderEntry,
    type ActivityView
} from "@/server/actions/ladder-actions";
import { formatSeniority } from "@/lib/ladder-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
    guildId: string;
    canValidate?: boolean;
};

export function LadderClient({ guildId, canValidate }: Props) {
    const [activeTab, setActiveTab] = useState<"activity" | "seniority" | "success">("activity");
    const [activityView, setActivityView] = useState<ActivityView>("weekly");
    const [ladder, setLadder] = useState<LadderEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadLadder() {
            setLoading(true);
            let result;

            switch (activeTab) {
                case "activity":
                    result = await getActivityLadder(guildId, activityView);
                    break;
                case "seniority":
                    result = await getSeniorityLadder(guildId);
                    break;
                case "success":
                    result = await getSuccessLadder(guildId);
                    break;
            }

            if (result.success && result.data) {
                setLadder(result.data);
            } else {
                setLadder([]);
            }
            setLoading(false);
        }

        loadLadder();
    }, [guildId, activeTab, activityView]);

    const getValueLabel = (entry: LadderEntry): string => {
        switch (activeTab) {
            case "activity":
                return `${entry.value.toLocaleString()} XP`;
            case "seniority":
                return formatSeniority(entry.value);
            case "success":
                return `${entry.value.toLocaleString()} pts`;
            default:
                return entry.value.toString();
        }
    };

    const categories = [
        {
            id: "activity",
            label: "Activité",
            icon: TrendingUp,
            description: "XP gagnée via les missions",
            color: "purple",
            activeClass: "bg-purple-500/20 border-purple-500/40 text-purple-200 shadow-lg shadow-purple-500/10",
            idleClass: "bg-purple-500/5 border-purple-500/10 text-purple-400/60 hover:bg-purple-500/10 hover:border-purple-500/20 hover:text-purple-300"
        },
        {
            id: "seniority",
            label: "Ancienneté",
            icon: Clock,
            description: "Les piliers de la guilde",
            color: "cyan",
            activeClass: "bg-cyan-500/20 border-cyan-500/40 text-cyan-200 shadow-lg shadow-cyan-500/10",
            idleClass: "bg-cyan-500/5 border-cyan-500/10 text-cyan-400/60 hover:bg-cyan-500/10 hover:border-cyan-500/20 hover:text-cyan-300"
        },
        {
            id: "success",
            label: "Succès",
            icon: Trophy,
            description: "Le prestige en jeu",
            color: "amber",
            activeClass: "bg-amber-500/20 border-amber-500/40 text-amber-200 shadow-lg shadow-amber-500/10",
            idleClass: "bg-amber-500/5 border-amber-500/10 text-amber-400/60 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-300"
        }
    ] as const;

    return (
        <div className="space-y-8">
            {/* Interactive Tab Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = activeTab === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={cn(
                                "relative overflow-hidden p-5 rounded-2xl border backdrop-blur-sm transition-all duration-300 text-left group",
                                isActive ? cat.activeClass : cat.idleClass
                            )}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={cn(
                                    "p-2.5 rounded-xl border transition-colors",
                                    isActive ? "bg-white/10 border-white/20" : "bg-black/20 border-white/5 group-hover:border-white/10"
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                {isActive && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/70">
                                        Activé
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <span className="text-sm font-black uppercase tracking-widest">{cat.label}</span>
                                <p className="text-[10px] opacity-70 font-medium leading-relaxed">{cat.description}</p>
                            </div>

                            {/* Decorative Background Element */}
                            <div className={cn(
                                "absolute -bottom-6 -right-6 w-24 h-24 rounded-full blur-[40px] opacity-20 pointer-events-none transition-transform duration-500",
                                isActive ? "scale-150 rotate-12" : "scale-0"
                            )}
                                style={{ backgroundColor: cat.color === 'purple' ? '#a855f7' : cat.color === 'cyan' ? '#06b6d4' : '#f59e0b' }}
                            />
                        </button>
                    );
                })}
            </div>

            {/* Content Control Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-2 h-2 rounded-full animate-pulse",
                            activeTab === 'activity' ? 'bg-purple-400' : activeTab === 'seniority' ? 'bg-cyan-400' : 'bg-amber-400'
                        )} />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">
                            RANGS {activeTab === 'activity' ? 'D\'ACTIVITÉ' : activeTab === 'seniority' ? 'D\'ANCIENNETÉ' : 'DE PRESTIGE'}
                        </h2>
                    </div>

                    {canValidate && (
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-wider gap-2 px-3"
                        >
                            <Link href={`/dashboard/${guildId}/admin/validation?tab=achievements`}>
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                                Validation Preuves
                            </Link>
                        </Button>
                    )}
                </div>

                {activeTab === "activity" && (
                    <Select value={activityView} onValueChange={(v) => setActivityView(v as ActivityView)}>
                        <SelectTrigger className="w-[180px] h-9 bg-zinc-900/50 border-white/10 text-xs font-bold uppercase tracking-wider text-zinc-300">
                            <SelectValue placeholder="Période" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/10">
                            <SelectItem value="weekly" className="text-xs uppercase font-bold tracking-wider">📅 Cette semaine</SelectItem>
                            <SelectItem value="monthly" className="text-xs uppercase font-bold tracking-wider">📅 Ce mois-ci</SelectItem>
                            <SelectItem value="alltime" className="text-xs uppercase font-bold tracking-wider text-amber-400">🏆 Global (All-Time)</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Ladder Results */}
            <div className="relative min-h-[400px]">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-600">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Calcul du classement...</span>
                    </div>
                ) : ladder.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                        <p className="text-xs font-medium italic">Aucune donnée disponible pour ce classement.</p>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {ladder.map((entry) => (
                            <LeaderboardCard
                                key={entry.profileId}
                                entry={entry}
                                valueLabel={getValueLabel(entry)}
                                accentColor={activeTab === 'activity' ? 'purple' : activeTab === 'seniority' ? 'cyan' : 'amber'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
