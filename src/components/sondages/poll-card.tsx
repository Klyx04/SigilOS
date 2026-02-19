"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BarChart3, Clock, Users, Lock, CheckCircle2, XCircle, MessageSquare, ChevronRight, Crown } from "lucide-react";
import Link from "next/link";
const POLL_CATEGORIES = ["SUGGESTION", "AMELIORATION", "EVENT", "MISSION", "AUTRE"] as const;
type PollCategory = (typeof POLL_CATEGORIES)[number];

const POLL_STATUSES = ["DRAFT", "ACTIVE", "CLOSED", "CANCELLED"] as const;
type PollStatus = (typeof POLL_STATUSES)[number];
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Category styling config
const CATEGORY_CONFIG: Record<PollCategory, {
    label: string;
    emoji: string;
    color: string;
    bgColor: string;
    borderColor: string;
    glowColor: string;
}> = {
    SUGGESTION: {
        label: "Suggestion", emoji: "💡",
        color: "text-cyan-400", bgColor: "bg-cyan-500/10",
        borderColor: "border-cyan-500/30", glowColor: "rgba(6,182,212,0.4)",
    },
    AMELIORATION: {
        label: "Amélioration", emoji: "🔧",
        color: "text-emerald-400", bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/30", glowColor: "rgba(16,185,129,0.4)",
    },
    EVENT: {
        label: "Événement", emoji: "🎉",
        color: "text-amber-400", bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30", glowColor: "rgba(245,158,11,0.4)",
    },
    MISSION: {
        label: "Mission", emoji: "🎯",
        color: "text-rose-400", bgColor: "bg-rose-500/10",
        borderColor: "border-rose-500/30", glowColor: "rgba(244,63,94,0.4)",
    },
    AUTRE: { label: "Autre", emoji: "📁", color: "text-zinc-400", bgColor: "bg-zinc-500/10", borderColor: "border-zinc-500/20", glowColor: "rgba(161, 161, 170, 0.4)" },
};

const STATUS_CONFIG: Record<PollStatus, { label: string; color: string; icon: React.ElementType }> = {
    DRAFT: { label: "Brouillon", color: "text-zinc-400", icon: Clock },
    ACTIVE: { label: "En cours", color: "text-emerald-400", icon: BarChart3 },
    CLOSED: { label: "Terminé", color: "text-amber-400", icon: CheckCircle2 },
    CANCELLED: { label: "Annulé", color: "text-red-400", icon: XCircle },
};

interface PollOption {
    id: string;
    label: string;
    emoji: string | null;
    order: number;
    _count: { votes: number };
}

interface PollCardProps {
    poll: {
        id: string;
        title: string;
        description: string | null;
        category: PollCategory;
        status: PollStatus;
        creatorName: string;
        allowMultipleVotes: boolean;
        isAnonymous: boolean;
        expiresAt: string | null;
        closedAt: string | null;
        createdAt: string;
        outcome: string | null;
        options: PollOption[];
        _count: { options: number };
    };
    guildId: string;
    index?: number;
}

export function PollCard({ poll, guildId, index = 0 }: PollCardProps) {
    const cat = CATEGORY_CONFIG[poll.category];
    const status = STATUS_CONFIG[poll.status];
    const StatusIcon = status.icon;

    const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0);
    const maxVotes = Math.max(...poll.options.map(o => o._count.votes), 1);

    const isActive = poll.status === "ACTIVE";
    const timeLeft = poll.expiresAt ? getTimeLeft(poll.expiresAt) : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
        >
            <Link href={`/dashboard/${guildId}/sondages/${poll.id}`}>
                <div className={cn(
                    "group relative overflow-hidden rounded-3xl border transition-all duration-500",
                    "bg-[#030303]/60 backdrop-blur-md hover:bg-[#050505]/80",
                    "hover:scale-[1.02] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] cursor-pointer",
                    isActive ? cat.borderColor : "border-white/5",
                )}>
                    {/* Category glow */}
                    <div
                        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-1000"
                        style={{ backgroundColor: cat.glowColor }}
                    />

                    {/* Header bar */}
                    <div className={cn(
                        "flex items-center justify-between px-4 py-2.5 border-b relative z-10",
                        isActive ? "border-white/5" : "border-white/[0.03]",
                    )}>
                        <div className="flex items-center gap-2">
                            <span className="text-base">{cat.emoji}</span>
                            <span className={cn("text-xs font-black uppercase tracking-[0.1em]", cat.color)}>{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {poll.isAnonymous && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Lock className="w-3.5 h-3.5 text-zinc-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>Votes anonymes</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            <div className={cn("flex items-center gap-2 text-sm font-bold", status.color)}>
                                <StatusIcon className="w-4 h-4" />
                                {status.label}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-5 space-y-6 relative z-10">
                        {/* Background category image with mask */}
                        <div className="absolute inset-0 z-[-1] opacity-70 transition-opacity duration-500 pointer-events-none">
                            <img
                                src={`/assets/sondages/${poll.category === 'EVENT' ? 'evenement' :
                                    poll.category === 'AUTRE' ? 'autres' :
                                        poll.category.toLowerCase()
                                    }.png`}
                                alt=""
                                className="w-full h-full object-cover grayscale-[0.6] brightness-[0.4] contrast-[1.1]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-[#030303]/20" />
                            <div className="absolute inset-0 bg-[#030303]/10" />

                            {poll.outcome && (
                                <div className="absolute top-4 left-4 z-20">
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md shadow-[0_0_15px_-5px_rgba(16,185,129,0.5)]">
                                        <Crown className="w-3 h-3 text-emerald-400" />
                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Décision prise</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="text-white font-black text-2xl tracking-tighter group-hover:text-cyan-400 transition-colors line-clamp-2 leading-[1.1]">
                                {poll.title}
                            </h3>
                            {poll.description && (
                                <p className="text-zinc-400 text-sm mt-3 line-clamp-2 leading-relaxed font-medium">{poll.description}</p>
                            )}
                        </div>

                        {/* Mini result bars */}
                        <div className="space-y-3">
                            {poll.options.slice(0, 3).map((option) => {
                                const percent = totalVotes > 0 ? (option._count.votes / totalVotes) * 100 : 0;
                                const isWinning = option._count.votes === maxVotes && totalVotes > 0;
                                return (
                                    <div key={option.id} className="relative">
                                        <div className="flex items-center justify-between text-xs uppercase tracking-widest font-black mb-2 px-0.5">
                                            <span className={cn(
                                                "truncate max-w-[80%] transition-colors",
                                                isWinning ? "text-white" : "text-zinc-500"
                                            )}>
                                                {option.emoji && <span className="mr-2 opacity-80">{option.emoji}</span>}
                                                {option.label}
                                            </span>
                                            <span className={cn("tabular-nums", isWinning ? cat.color : "text-zinc-600")}>
                                                {Math.round(percent)}%
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-white/[0.03] overflow-hidden p-[1px]">
                                            <motion.div
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-700",
                                                    isWinning ? "shadow-[0_0_10px_rgba(255,255,255,0.1)]" : "opacity-30"
                                                )}
                                                style={{
                                                    background: isWinning
                                                        ? `linear-gradient(90deg, ${cat.glowColor.replace("0.4", "0.8")}, ${cat.glowColor.replace("0.4", "1")})`
                                                        : cat.glowColor.replace("0.4", "0.5")
                                                }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${percent}%` }}
                                                transition={{ delay: index * 0.06 + 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {poll.options.length > 3 && (
                                <p className="text-zinc-700 text-[10px] font-black uppercase tracking-[0.3em] text-center pt-2">
                                    + {poll.options.length - 3} options supplémentaires
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={cn(
                        "flex items-center justify-between px-4 py-2.5 border-t relative z-10",
                        "border-white/[0.03] bg-white/[0.015]",
                    )}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-zinc-500">
                            <span className="text-[10px] font-black uppercase text-zinc-600">
                                par <span className="text-zinc-400 group-hover:text-cyan-400 transition-colors underline underline-offset-2">{poll.creatorName}</span>
                            </span>
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1.5 border-l border-white/5 pl-4 first:border-0 first:pl-0">
                                    <Users className="w-3.5 h-3.5" />
                                    {totalVotes}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    {poll._count.options} options
                                </span>
                            </div>
                            {timeLeft && isActive && (
                                <span className="flex items-center gap-1.5 text-amber-500/80">
                                    <Clock className="w-3.5 h-3.5" />
                                    {timeLeft}
                                </span>
                            )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-1 transition-all" />
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

function getTimeLeft(expiresAt: string): string {
    const now = new Date();
    const end = new Date(expiresAt);
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return "Expiré";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j restant${days > 1 ? "s" : ""}`;
    if (hours > 0) return `${hours}h restante${hours > 1 ? "s" : ""}`;
    const mins = Math.floor(diff / (1000 * 60));
    return `${mins}min`;
}
