"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Clock, Trophy, Loader2, ShieldCheck, CheckSquare, HandHeart, Zap } from "lucide-react";
import { LeaderboardCard } from "./leaderboard-card";
import {
    getActivityLadder,
    getSeniorityLadder,
    getSuccessLadder,
    getContributionLadder,
    getGuildatonsLadder,
    getGeneralLadder,
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
    const [activeTab, setActiveTab] = useState<"activity" | "contribution" | "seniority" | "success" | "general" | "guildatons">("activity");
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
                case "contribution":
                    result = await getContributionLadder(guildId);
                    break;
                case "seniority":
                    result = await getSeniorityLadder(guildId);
                    break;
                case "success":
                    result = await getSuccessLadder(guildId);
                    break;
                case "general":
                    result = await getGeneralLadder(guildId);
                    break;
                case "guildatons":
                    result = await getGuildatonsLadder(guildId);
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
            case "contribution":
                return `${entry.value.toLocaleString()} pts`;
            case "seniority":
                return formatSeniority(entry.value);
            case "success":
                return `${entry.value.toLocaleString()} pts`;
            case "general":
                return `${Number(entry.totalXpBigInt || 0).toLocaleString()} XP`;
            case "guildatons":
                return `${entry.value.toLocaleString()} 💰`;
            default:
                return entry.value.toString();
        }
    };

    const categories = [
        { id: "activity", label: "Activité", icon: TrendingUp, color: "#10b981" },
        { id: "contribution", label: "Contribution", icon: HandHeart, color: "#a855f7" },
        { id: "seniority", label: "Ancienneté", icon: Clock, color: "#06b6d4" },
        { id: "success", label: "Succès", icon: Trophy, color: "#f59e0b" },
        { id: "general", label: "Général", icon: TrendingUp, color: "#3b82f6" },
        { id: "guildatons", label: "Guildatons", icon: Zap, color: "#eab308" },
    ] as const;

    return (
        <div className="space-y-12">
            {/* Modern Tab Navigation (Glassmorphism 2026) */}
            <div className="relative sticky top-0 z-50 py-4 -mt-4 bg-black/20 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-[1px]">
                            {categories.map((cat) => {
                                const Icon = cat.icon;
                                const isActive = activeTab === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveTab(cat.id)}
                                        className={cn(
                                            "relative z-10 flex items-center gap-2.5 px-6 py-4 border-b-2 transition-all duration-500 group whitespace-nowrap",
                                            isActive 
                                              ? "text-white" 
                                              : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-800"
                                        )}
                                        style={isActive ? { borderColor: cat.color } : {}}
                                    >
                                        <Icon 
                                            className={cn(
                                                "w-4 h-4 transition-all duration-500 group-hover:scale-110", 
                                                isActive ? "scale-110" : "text-zinc-600"
                                            )} 
                                            style={isActive ? { 
                                                color: cat.color,
                                                filter: `drop-shadow(0 0 8px ${cat.color}80)` 
                                            } : {}}
                                        />
                                        <span className={cn(
                                            "text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500",
                                            isActive ? "opacity-100" : "group-hover:text-white"
                                        )}
                                        style={isActive ? { 
                                            color: cat.color,
                                            textShadow: `0 0 15px ${cat.color}40`
                                        } : {}}
                                        >
                                            {cat.label}
                                        </span>

                                        {/* Active Background Glow */}
                                        {isActive && (
                                            <div 
                                                className="absolute inset-0 -z-10 opacity-20 blur-xl animate-pulse"
                                                style={{ background: `radial-gradient(circle, ${cat.color} 0%, transparent 70%)` }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {activeTab === "activity" && (
                            <Select value={activityView} onValueChange={(v) => setActivityView(v as ActivityView)}>
                                <SelectTrigger className="w-[200px] h-11 bg-white/[0.02] border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 rounded-xl hover:bg-white/[0.05] transition-all">
                                    <SelectValue placeholder="Période" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950/95 backdrop-blur-2xl border-white/10">
                                    <SelectItem value="weekly" className="text-[10px] uppercase font-black tracking-widest">📅 Cette semaine</SelectItem>
                                    <SelectItem value="monthly" className="text-[10px] uppercase font-black tracking-widest">📅 Ce mois-ci</SelectItem>
                                    <SelectItem value="alltime" className="text-[10px] uppercase font-black tracking-widest text-amber-400">🏆 Global (All-Time)</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 space-y-8">
                {/* Explicative Card (2026 Style) */}
                <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/40 p-8 backdrop-blur-xl">
                    <div 
                        className="absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-20 pointer-events-none"
                        style={{ background: categories.find(c => c.id === activeTab)?.color || "#10b981" }}
                    />
                    
                    <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div 
                            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border border-white/10"
                            style={{ backgroundColor: `${categories.find(c => c.id === activeTab)?.color}15` }}
                        >
                            {(() => {
                                const Icon = categories.find(c => c.id === activeTab)?.icon || Trophy;
                                return <Icon className="w-8 h-8" style={{ color: categories.find(c => c.id === activeTab)?.color }} />;
                            })()}
                        </div>
                        
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-white tracking-tighter uppercase">
                                {categories.find(c => c.id === activeTab)?.label}
                            </h2>
                            <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
                                {activeTab === 'activity' && "Ce classement mesure votre engagement direct dans la guilde via la validation de missions et les dons de kamas. Seul l'XP gagné sur la période sélectionnée est comptabilisé."}
                                {activeTab === 'contribution' && "Récompense les membres qui s'impliquent dans la vie de la guilde (aide aux succès, présence aux événements, parrainage). Ces points sont attribués manuellement par les officiers."}
                                {activeTab === 'seniority' && "L'ordre de prestige basé sur votre date d'intégration au serveur de guilde. Plus vous êtes fidèle, plus vous montez dans ce panthéon d'honneur."}
                                {activeTab === 'success' && "Le score de prestige Dofus par excellence. Ce ladder synchronise vos points de succès réels directement depuis les serveurs officiels d'Ankama."}
                                {activeTab === 'general' && "L'expérience totale (XP) accumulée par votre personnage sur Dofus. Une mesure brute de puissance et de temps passé à parcourir le Monde des Douze."}
                                {activeTab === 'guildatons' && "La richesse monétaire interne de la guilde. Le Guildaton est la monnaie virtuelle utilisée pour les échanges, les récompenses et la boutique exclusive."}
                            </p>
                        </div>
                    </div>
                </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-2 h-2 rounded-full animate-pulse",
                            activeTab === 'activity' ? 'bg-emerald-400' : activeTab === 'contribution' ? 'bg-purple-400' : activeTab === 'seniority' ? 'bg-cyan-400' : activeTab === 'guildatons' ? 'bg-yellow-400' : 'bg-amber-400'
                        )} />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">
                             CLASSEMENT {activeTab === 'activity' ? 'D\'ACTIVITÉ' : activeTab === 'contribution' ? 'DE CONTRIBUTION' : activeTab === 'seniority' ? 'D\'ANCIENNETÉ' : activeTab === 'guildatons' ? 'DE RICHESSE' : (activeTab === 'general' ? 'D\'XP GÉNÉRALE' : 'DE PRESTIGE')}
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
                                accentColor={activeTab === 'activity' ? 'emerald' : activeTab === 'contribution' ? 'purple' : activeTab === 'seniority' ? 'cyan' : activeTab === 'guildatons' ? 'yellow' : (activeTab === 'general' ? 'blue' : 'amber')}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
    );
}
