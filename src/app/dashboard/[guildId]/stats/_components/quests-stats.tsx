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
            <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-success" />
                        <span className="text-caption font-black uppercase tracking-widest text-muted-foreground">Progression Globale</span>
                    </div>
                    <span className="text-xl font-black text-foreground">{quests.guildCompletionRate}%</span>
                </div>
                <Progress value={quests.guildCompletionRate} className="h-2 bg-surface" indicatorClassName="bg-success " />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dofus Ownership */}
                <div className="space-y-4">
                    <h4 className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Trophy className="w-3 h-3 text-warning" />
                        Vitrine des Dofus
                    </h4>
                    <div className="space-y-3">
                        {quests.ownership.slice(0, 6).map((dofus) => (
                            <div key={dofus.slug} className="group">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-caption font-bold text-foreground group-hover:text-foreground transition-colors">{dofus.name}</span>
                                    <span className="text-caption font-black text-muted-foreground">
                                        {dofus.count} / {dofus.total}
                                    </span>
                                </div>
                                <Progress 
                                    value={(dofus.count / dofus.total) * 100} 
                                    className="h-1 bg-surface" 
                                    indicatorClassName="bg-warning group-hover:bg-warning transition-all"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Progressors */}
                <div className="space-y-4">
                    <h4 className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Zap className="w-3 h-3 text-info" />
                        Top Explorateurs
                    </h4>
                    <div className="space-y-2">
                        {quests.topProgressors.slice(0, 5).map((player, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border hover:bg-surface transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-caption font-black text-muted-foreground">#{idx + 1}</span>
                                    <span className="text-caption font-bold text-foreground">{player.name}</span>
                                </div>
                                <Badge variant="outline" className="text-caption font-black border-info/20 text-info">
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
                    <h4 className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Users className="w-3 h-3 text-pink-500" />
                        Goulots d'étranglement
                    </h4>
                    <div className="space-y-2">
                        {quests.bottlenecks.length > 0 ? (
                            quests.bottlenecks.map((b, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-danger/5 border border-danger/10">
                                    <span className="text-caption font-bold text-foreground truncate max-w-[200px]">{b.questName}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-caption font-black text-danger">{b.count} membres</span>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="text-caption">Utilisez ce goulot pour organiser une sortie guilde !</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-caption text-muted-foreground italic">Aucun blocage majeur détecté.</p>
                        )}
                    </div>
                </div>

                {/* Recent Dofus */}
                <div className="space-y-4">
                    <h4 className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Trophy className="w-3 h-3 text-warning" />
                        Mur de la Gloire
                    </h4>
                    <div className="space-y-2">
                        {quests.recentDofus.length > 0 ? (
                            quests.recentDofus.map((rd, idx) => (
                                <div key={idx} className="flex flex-col p-2.5 rounded-lg bg-warning/5 border border-warning/10">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-caption font-black text-warning uppercase tracking-wider">{rd.name}</span>
                                        <span className="text-caption text-muted-foreground font-bold">
                                            {formatDistanceToNow(new Date(rd.obtainedAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    </div>
                                    <span className="text-caption text-foreground font-medium">Obtenu par <span className="font-black text-foreground">{rd.username}</span></span>
                                </div>
                            ))
                        ) : (
                            <p className="text-caption text-muted-foreground italic">Aucun Dofus récent.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
