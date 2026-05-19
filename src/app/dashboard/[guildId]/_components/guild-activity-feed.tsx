"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Activity, 
    ArrowRight,
    Gamepad2,
    Shield,
    Package,
    RotateCcw,
    Sparkles,
    Flame
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function GuildActivityFeed({ 
    logs = []
}: { 
    logs?: any[]; // Simplified for the component
}) {
    return (
        <Card className="glass-premium border-white/5 h-full overflow-hidden flex flex-col group">
            <CardHeader className="pb-4 pt-6 px-6">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Flux de Vie de la Guilde
                </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 px-6 pb-6 overflow-hidden">
                <div className="space-y-4">
                    {logs.length > 0 ? (
                        logs.slice(0, 8).map((log) => {
                            const actorName = log.actor?.pseudoDofus || log.actor?.discordNickname || "Membre";
                            
                            // Visual config based on type
                            const typeConfig: Record<string, { icon: any, color: string, label: string }> = {
                                "SERVICE": { icon: Package, color: "text-blue-400", label: "Service" },
                                "LOAN": { icon: RotateCcw, color: "text-amber-400", label: "Prêt" },
                                "VAULT": { icon: Shield, color: "text-purple-400", label: "Coffre" },
                                "MISSION_VALIDATED": { icon: Gamepad2, color: "text-emerald-400", label: "Mission" },
                                "ACHIEVEMENT_VALIDATED": { icon: Sparkles, color: "text-yellow-400", label: "Succès" },
                                "OCRE_TRADE": { icon: Activity, color: "text-orange-400", label: "Metamob" },
                                "DONATION_VALIDATED": { icon: Flame, color: "text-red-400", label: "Don" }
                            };

                            const config = typeConfig[log.type] || { icon: Activity, color: "text-zinc-400", label: log.type };
                            const Icon = config.icon;

                            return (
                                <div key={log.id} className="flex items-start gap-3 group/log animate-in fade-in slide-in-from-left-2 duration-500">
                                    <div className="relative">
                                        <Avatar className="h-8 w-8 shrink-0 border border-white/10 ring-2 ring-transparent group-hover/log:ring-emerald-500/20 transition-all">
                                            <AvatarImage src={log.actor?.image ?? undefined} />
                                            <AvatarFallback className="text-[10px] font-black bg-zinc-900">{actorName[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full bg-zinc-950 border border-white/10 ${config.color}`}>
                                            <Icon className="w-2.5 h-2.5" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-white group-hover/log:text-emerald-400 transition-colors">{actorName}</span>
                                            <span className="text-[9px] text-zinc-600 font-bold ml-auto tabular-nums">
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 font-medium leading-tight line-clamp-2">
                                            {log.summary}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-600 italic">
                            <Activity className="w-10 h-10 opacity-10 mb-2" />
                            <p className="text-[10px] uppercase font-black tracking-widest text-center">Aucune activité récente</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
