"use client";
import { useState, useEffect } from "react";
import { ClipboardList, FileImage, Trophy, Coins, ChevronRight, Activity } from "lucide-react";
import Link from "next/link";
import { getPendingValidationsCount } from "@/server/actions/admin-actions";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ValidatorInboxClientProps {
    guildId: string;
    initialData: {
        pendingMissions: number;
        pendingAchievements: number;
        pendingKamas?: number;
        pendingReactivations?: number;
        total: number;
    }
}

type FilterType = "all" | "missions" | "achievements" | "kamas" | "reactivations";

const FILTER_CFG: Record<FilterType, { label: string; color: string; textActive: string; textInactive: string; icon: any; img?: string; shadow: string }> = {
    all: { 
        label: "Tout", 
        color: "bg-warning", 
        textActive: "text-foreground", 
        textInactive: "text-warning", 
        icon: Activity,
        shadow: "shadow-orange-500/20"
    },
    missions: { 
        label: "Missions", 
        color: "bg-danger", 
        textActive: "text-foreground", 
        textInactive: "text-danger", 
        icon: FileImage,
        shadow: "shadow-rose-500/20"
    },
    achievements: { 
        label: "Succès", 
        color: "bg-warning", 
        textActive: "text-foreground", 
        textInactive: "text-warning", 
        icon: Trophy,
        img: "/assets/dofus/game-icons/trophy-1.png",
        shadow: "shadow-amber-500/20"
    },
    kamas: { 
        label: "Kamas", 
        color: "bg-warning", 
        textActive: "text-foreground", 
        textInactive: "text-warning", 
        icon: Coins,
        img: "/assets/dofus/game-icons/kamas.png",
        shadow: "shadow-yellow-500/20"
    },
    reactivations: { 
        label: "Retours", 
        color: "bg-success", 
        textActive: "text-foreground", 
        textInactive: "text-success", 
        icon: ClipboardList,
        shadow: "shadow-emerald-500/20"
    },
};

export function ValidatorInboxClient({ guildId, initialData }: ValidatorInboxClientProps) {
    const [data, setData] = useState(initialData);
    const [filter, setFilter] = useState<FilterType>("all");

    useEffect(() => {
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
    const pendingReactivations = (data as any).pendingReactivations ?? 0;
    
    const displayCount =
        filter === "missions" ? data.pendingMissions :
            filter === "achievements" ? data.pendingAchievements :
                filter === "kamas" ? pendingKamas :
                    filter === "reactivations" ? pendingReactivations :
                        data.total;

    if (data.total === 0) return null;

    const href = `/dashboard/${guildId}/admin/validation` + (filter !== "all" ? `?type=${filter === "reactivations" ? "retours" : filter}` : "");
    const currentCfg = FILTER_CFG[filter];

    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="group relative flex flex-col gap-4 px-5 py-5 rounded-[2.5rem] border border-border bg-background/40 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
        >
            {/* Ambient Background Glow */}
            <div className={cn("absolute -top-12 -right-12 w-32 h-32 blur-[60px] opacity-20 transition-all duration-300", currentCfg.color)} />
            
            {/* Header: Title & Heartbeat */}
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="relative flex h-2 w-2">
                        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", currentCfg.color)} />
                        <span className={cn("relative inline-flex rounded-full h-2 w-2", currentCfg.color)} />
                    </div>
                    <p className="text-caption font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                        Action Requise
                    </p>
                </div>
                <div className="p-2 bg-surface rounded-xl border border-border group-hover:border-border transition-all">
                    {currentCfg.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={currentCfg.img} alt="" className="w-3.5 h-3.5 object-contain" />
                    ) : (
                        <currentCfg.icon className={cn("w-3.5 h-3.5 transition-all", currentCfg.textInactive)} />
                    )}
                </div>
            </div>

            {/* Filter Chips Layer */}
            <div className="flex items-center gap-1.5 flex-wrap relative z-10">
                {(["all", "missions", "achievements", "kamas", "reactivations"] as FilterType[]).map((f) => {
                    const count = f === "all" ? data.total : f === "missions" ? data.pendingMissions : f === "achievements" ? data.pendingAchievements : f === "kamas" ? pendingKamas : pendingReactivations;
                    if (f !== "all" && count === 0) return null;
                    const cfg = FILTER_CFG[f];
                    const active = filter === f;
                    
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "relative flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-black uppercase tracking-widest border transition-all duration-300",
                                active 
                                    ? `${cfg.color} ${cfg.textActive} border-transparent shadow-lg ${cfg.shadow}` 
                                    : "bg-surface text-muted-foreground border-border hover:bg-surface hover:text-foreground"
                            )}
                        >
                            {cfg.img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={cfg.img} alt="" className="w-2.5 h-2.5 object-contain" />
                            ) : (
                                <cfg.icon className="w-2.5 h-2.5" />
                            )}
                            {cfg.label}
                            <span className={cn("ml-1 tabular-nums font-black opacity-60", active && "opacity-100")}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main Action Area */}
            <Link 
                href={href} 
                className="group/action relative flex items-center justify-between bg-surface hover:bg-surface border border-border hover:border-border px-4 py-3 rounded-2xl transition-all duration-300 overflow-hidden"
            >
                <div className="flex items-center gap-4">
                    <AnimatePresence mode="wait">
                        <motion.span 
                            key={displayCount}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-4xl font-black text-foreground tabular-nums tracking-tighter"
                        >
                            {displayCount}
                        </motion.span>
                    </AnimatePresence>
                    <div className="flex flex-col">
                        <span className="text-caption text-muted-foreground font-black uppercase tracking-[0.2em] leading-none mb-1">
                            En Attente
                        </span>
                        <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                            {filter === "all" ? "Demandes globales" : currentCfg.label}
                        </span>
                    </div>
                </div>
                <div className="p-2 rounded-full bg-surface group-hover/action:bg-surface transition-colors">
                    <ChevronRight className={cn("w-4 h-4 transition-all duration-300 group-hover/action:translate-x-0.5", currentCfg.textInactive)} />
                </div>
            </Link>

            {/* Modern Segmented Progress HUD */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-caption font-black uppercase tracking-[0.2em] text-muted-foreground">
                    <span>Répartition</span>
                    <span className="text-muted-foreground">Détails Système</span>
                </div>
                <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden flex gap-0.5 p-[1px]">
                    {data.pendingMissions > 0 && (
                        <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${(data.pendingMissions / data.total) * 100}%` }} 
                            className="h-full bg-danger rounded-sm " 
                        />
                    )}
                    {data.pendingAchievements > 0 && (
                        <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${(data.pendingAchievements / data.total) * 100}%` }} 
                            className="h-full bg-warning rounded-sm " 
                        />
                    )}
                    {pendingKamas > 0 && (
                        <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${(pendingKamas / data.total) * 100}%` }} 
                            className="h-full bg-warning rounded-sm " 
                        />
                    )}
                    {pendingReactivations > 0 && (
                        <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${(pendingReactivations / data.total) * 100}%` }} 
                            className="h-full bg-success rounded-sm " 
                        />
                    )}
                </div>
            </div>
        </motion.div>
    );
}
