"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Activity, 
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

interface GuildActivityFeedProps {
    logs?: any[];
    guildId?: string;
}

export function GuildActivityFeed({ 
    logs = [],
    guildId,
}: GuildActivityFeedProps) {
    // Count unique actors for activity counter
    const uniqueActorsToday = new Set<string>();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    logs.forEach((log: any) => {
        const logDate = new Date(log.createdAt);
        if (logDate >= todayStart) {
            uniqueActorsToday.add(log.actor?.pseudoDofus || log.actor?.discordNickname || log.actor?.user?.name);
        }
    });

    return (
        <Card className="glass-premium border-white/5 h-full overflow-hidden flex flex-col group">
            <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Flux de Vie de la Guilde
                    </CardTitle>
                    {logs.length > 0 && (
                        <span className="text-[8px] font-black text-zinc-600 bg-zinc-900/80 px-2.5 py-1 rounded-full border border-zinc-800/40">
                            {uniqueActorsToday.size} actif{uniqueActorsToday.size > 1 ? "s" : ""} aujourd'hui
                        </span>
                    )}
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 px-6 pb-6 overflow-hidden">
                <div className="space-y-4">
                    {logs.length > 0 ? (
                        logs.slice(0, 8).map((log: any, idx: number) => {
                            const actorName = log.actor?.pseudoDofus || log.actor?.discordNickname || log.actor?.user?.name || "Membre";
                            
                            // Visual config based on type
                            const typeConfig: Record<string, { icon: any, color: string, label: string, bg: string, border: string }> = {
                                "SERVICE": { icon: Package, color: "text-blue-400", label: "Service", bg: "bg-blue-500/10", border: "border-blue-500/25" },
                                "LOAN": { icon: RotateCcw, color: "text-amber-400", label: "Prêt", bg: "bg-amber-500/10", border: "border-amber-500/25" },
                                "VAULT": { icon: Shield, color: "text-purple-400", label: "Coffre", bg: "bg-purple-500/10", border: "border-purple-500/25" },
                                "MISSION_VALIDATED": { icon: Gamepad2, color: "text-emerald-400", label: "Mission", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
                                "ACHIEVEMENT_VALIDATED": { icon: Sparkles, color: "text-yellow-400", label: "Succès", bg: "bg-yellow-500/10", border: "border-yellow-500/25" },
                                "OCRE_TRADE": { icon: Activity, color: "text-orange-400", label: "Metamob", bg: "bg-orange-500/10", border: "border-orange-500/25" },
                                "DONATION_VALIDATED": { icon: Flame, color: "text-red-400", label: "Don", bg: "bg-red-500/10", border: "border-red-500/25" },
                                "DJ_POST": { icon: Activity, color: "text-cyan-400", label: "Donjon", bg: "bg-cyan-500/10", border: "border-cyan-500/25" },
                                "STUFF_UPLOAD": { icon: Sparkles, color: "text-pink-400", label: "Stuff", bg: "bg-pink-500/10", border: "border-pink-500/25" },
                                "CONNECTION": { icon: Activity, color: "text-emerald-400", label: "Connexion", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
                            };

                            const config = typeConfig[log.type] || { icon: Activity, color: "text-zinc-400", label: log.type, bg: "bg-zinc-500/10", border: "border-zinc-500/25" };
                            const Icon = config.icon;

                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                                    className="flex items-start gap-3 group/log"
                                >
                                    <div className="relative">
                                        <Avatar className="h-9 w-9 shrink-0 border border-white/10 ring-2 ring-transparent group-hover/log:ring-emerald-500/20 transition-all">
                                            <AvatarImage src={log.actor?.image ?? undefined} />
                                            <AvatarFallback className="text-[10px] font-black bg-zinc-900">{actorName[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full bg-zinc-950 border border-white/10 ${config.color}`}>
                                            <Icon className="w-2.5 h-2.5" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[11px] font-black text-white group-hover/log:text-emerald-400 transition-colors">{actorName}</span>
                                            <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${config.bg} ${config.color} ${config.border} border`}>
                                                {config.label}
                                            </span>
                                            <span className="text-[9px] text-zinc-600 font-bold ml-auto tabular-nums">
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 font-medium leading-tight line-clamp-2">
                                            {log.summary}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-600 italic">
                            <Activity className="w-10 h-10 opacity-10 mb-2" />
                            <p className="text-[10px] uppercase font-black tracking-widest text-center">Aucune activité récente</p>
                        </div>
                    )}
                </div>

                {logs.length > 0 && guildId && (
                    <div className="mt-4 pt-3 border-t border-white/5 text-center">
                        <Link
                            href={`/dashboard/${guildId}/admin/logs`}
                            className="text-[9px] font-black text-zinc-600 hover:text-emerald-400 uppercase tracking-widest transition-colors"
                        >
                            Voir tout l'historique →
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}