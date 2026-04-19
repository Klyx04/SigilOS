"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Activity, 
    ArrowRight,
    Gamepad2,
    Shield,
    Package,
    RotateCcw
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
                        logs.slice(0, 6).map((log) => {
                            const actorName = log.actor?.pseudoDofus || log.actor?.discordNickname || "Membre";
                            const isService = log.module === "SERVICE";
                            const isLoan = log.module === "LOAN";
                            const isVault = log.module === "VAULT";

                            return (
                                <div key={log.id} className="flex items-start gap-3 group/log animate-in fade-in slide-in-from-left-2 duration-500">
                                    <Avatar className="h-8 w-8 shrink-0 border border-white/10">
                                        <AvatarImage src={log.actor?.user?.image ?? undefined} />
                                        <AvatarFallback className="text-[10px] font-black bg-zinc-900">{actorName[0]}</AvatarFallback>
                                    </Avatar>
                                    
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-white">{actorName}</span>
                                            <span className="px-1.5 py-0.5 rounded-sm bg-white/5 text-[7px] font-black uppercase text-zinc-500 tracking-tighter">
                                                {log.module}
                                            </span>
                                            <span className="text-[9px] text-zinc-600 font-bold ml-auto tabular-nums">
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-zinc-400 font-medium leading-tight">
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
                
                {logs.length > 0 && (
                    <div className="pt-6 border-t border-white/5 mt-6 text-center">
                        <button className="text-[9px] font-black text-zinc-600 hover:text-emerald-400 transition-colors uppercase tracking-[0.2em] flex items-center gap-2 mx-auto">
                            Voir tout l'historique <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
