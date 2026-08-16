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
        <Card className="glass-premium border-border h-full overflow-hidden flex flex-col group">
            <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-caption font-black uppercase tracking-widest text-guild flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Flux de Vie de la Guilde
                    </CardTitle>
                    {logs.length > 0 && (
                        <span className="text-caption font-black text-muted-foreground bg-surface/80 px-2.5 py-1 rounded-full border border-border/40">
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
                                "SERVICE": { icon: Package, color: "text-info", label: "Service", bg: "bg-info/10", border: "border-info/25" },
                                "LOAN": { icon: RotateCcw, color: "text-warning", label: "Prêt", bg: "bg-warning/10", border: "border-warning/25" },
                                "VAULT": { icon: Shield, color: "text-info", label: "Coffre", bg: "bg-info/10", border: "border-info/25" },
                                "MISSION_VALIDATED": { icon: Gamepad2, color: "text-success", label: "Mission", bg: "bg-success/10", border: "border-success/25" },
                                "ACHIEVEMENT_VALIDATED": { icon: Sparkles, color: "text-warning", label: "Succès", bg: "bg-warning/10", border: "border-warning/25" },
                                "OCRE_TRADE": { icon: Activity, color: "text-warning", label: "Metamob", bg: "bg-warning/10", border: "border-warning/25" },
                                "DONATION_VALIDATED": { icon: Flame, color: "text-danger", label: "Don", bg: "bg-danger/10", border: "border-danger/25" },
                                "DJ_POST": { icon: Activity, color: "text-info", label: "Donjon", bg: "bg-info/10", border: "border-info/25" },
                                "STUFF_UPLOAD": { icon: Sparkles, color: "text-pink-400", label: "Stuff", bg: "bg-pink-500/10", border: "border-pink-500/25" },
                                "CONNECTION": { icon: Activity, color: "text-success", label: "Connexion", bg: "bg-success/10", border: "border-success/25" },
                            };

                            const config = typeConfig[log.type] || { icon: Activity, color: "text-muted-foreground", label: log.type, bg: "bg-muted/10", border: "border-border/25" };
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
                                        <Avatar className="h-9 w-9 shrink-0 border border-border ring-2 ring-transparent group-hover/log:ring-success/20 transition-all">
                                            <AvatarImage src={log.actor?.image ?? undefined} />
                                            <AvatarFallback className="text-caption font-black bg-surface">{actorName[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full bg-background border border-border ${config.color}`}>
                                            <Icon className="w-2.5 h-2.5" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-caption font-black text-foreground group-hover/log:text-success transition-colors">{actorName}</span>
                                            <span className={`text-caption font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${config.bg} ${config.color} ${config.border} border`}>
                                                {config.label}
                                            </span>
                                            <span className="text-caption text-muted-foreground font-bold ml-auto tabular-nums">
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        </div>
                                        <p className="text-caption text-muted-foreground font-medium leading-tight line-clamp-2">
                                            {log.summary}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-muted-foreground italic">
                            <Activity className="w-10 h-10 opacity-10 mb-2" />
                            <p className="text-caption uppercase font-black tracking-widest text-center">Aucune activité récente</p>
                        </div>
                    )}
                </div>

                {logs.length > 0 && guildId && (
                    <div className="mt-4 pt-3 border-t border-border text-center">
                        <Link
                            href={`/dashboard/${guildId}/admin/logs`}
                            className="text-caption font-black text-muted-foreground hover:text-success uppercase tracking-widest transition-colors"
                        >
                            Voir tout l'historique →
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}