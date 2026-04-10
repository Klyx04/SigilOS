"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Trophy, HelpCircle, Users, Zap, TrendingUp } from "lucide-react";

interface QuestStatsProps {
    quests: {
        ownership: { slug: string; name: string; count: number; total: number }[];
        topProgressors: { name: string; value: number }[];
        bottlenecks: { questName: string; count: number }[];
        guildCompletionRate: number;
        recentDofus: { name: string; username: string; obtainedAt: Date }[];
    };
}

export default function QuestsStats({ quests }: QuestStatsProps) {
    return (
        <div className="space-y-8">
            {/* Global Completion */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Progression Globale</span>
                    </div>
                    <span className="text-xl font-black text-white">{quests.guildCompletionRate}%</span>
                </div>
                <Progress value={quests.guildCompletionRate} className="h-2 bg-white/5" indicatorClassName="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dofus Ownership */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                        <Trophy className="w-3 h-3 text-amber-500" />
                        Vitrine des Dofus
                    </h4>
                    <div className="space-y-3">
                        {quests.ownership.slice(0, 6).map((dofus) => (
                            <div key={dofus.slug} className="group">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-bold text-zinc-300 group-hover:text-white transition-colors">{dofus.name}</span>
                                    <span className="text-[10px] font-black text-zinc-500">
                                        {dofus.count} / {dofus.total}
                                    </span>
                                </div>
                                <Progress 
                                    value={(dofus.count / dofus.total) * 100} 
                                    className="h-1 bg-white/5" 
                                    indicatorClassName="bg-amber-500 group-hover:bg-amber-400 transition-all"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Progressors */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                        <Zap className="w-3 h-3 text-blue-500" />
                        Top Explorateurs
                    </h4>
                    <div className="space-y-2">
                        {quests.topProgressors.slice(0, 5).map((player, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-zinc-600">#{idx + 1}</span>
                                    <span className="text-[11px] font-bold text-zinc-200">{player.name}</span>
                                </div>
                                <Badge variant="outline" className="text-[9px] font-black border-blue-500/20 text-blue-400">
                                    {player.value}%
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bottlenecks */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                        <Users className="w-3 h-3 text-pink-500" />
                        Goulots d'étranglement
                    </h4>
                    <div className="space-y-2">
                        {quests.bottlenecks.length > 0 ? (
                            quests.bottlenecks.map((b, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                    <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[200px]">{b.questName}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-red-400">{b.count} membres</span>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <HelpCircle className="w-3 h-3 text-zinc-600" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="text-[10px]">Utilisez ce goulot pour organiser une sortie guilde !</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-[10px] text-zinc-600 italic">Aucun blocage majeur détecté.</p>
                        )}
                    </div>
                </div>

                {/* Recent Dofus */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                        <Trophy className="w-3 h-3 text-yellow-500" />
                        Mur de la Gloire
                    </h4>
                    <div className="space-y-2">
                        {quests.recentDofus.length > 0 ? (
                            quests.recentDofus.map((rd, idx) => (
                                <div key={idx} className="flex flex-col p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] font-black text-yellow-500 uppercase tracking-wider">{rd.name}</span>
                                        <span className="text-[9px] text-zinc-500 font-bold">
                                            {formatDistanceToNow(new Date(rd.obtainedAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-zinc-300 font-medium">Obtenu par <span className="font-black text-white">{rd.username}</span></span>
                                </div>
                            ))
                        ) : (
                            <p className="text-[10px] text-zinc-600 italic">Aucun Dofus récent.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
