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
        color: "text-info", bgColor: "bg-info/10",
        borderColor: "border-info/30", glowColor: "rgba(6,182,212,0.4)",
    },
    AMELIORATION: {
        label: "Amélioration", emoji: "🔧",
        color: "text-success", bgColor: "bg-success/10",
        borderColor: "border-success/30", glowColor: "rgba(16,185,129,0.4)",
    },
    EVENT: {
        label: "Événement", emoji: "🎉",
        color: "text-warning", bgColor: "bg-warning/10",
        borderColor: "border-warning/30", glowColor: "rgba(245,158,11,0.4)",
    },
    MISSION: {
        label: "Mission", emoji: "🎯",
        color: "text-danger", bgColor: "bg-danger/10",
        borderColor: "border-danger/30", glowColor: "rgba(244,63,94,0.4)",
    },
    AUTRE: { label: "Autre", emoji: "📁", color: "text-muted-foreground", bgColor: "bg-muted/10", borderColor: "border-border/20", glowColor: "rgba(161, 161, 170, 0.4)" },
};

const STATUS_CONFIG: Record<PollStatus, { label: string; color: string; icon: React.ElementType }> = {
    DRAFT: { label: "Brouillon", color: "text-muted-foreground", icon: Clock },
    ACTIVE: { label: "En cours", color: "text-success", icon: BarChart3 },
    CLOSED: { label: "Terminé", color: "text-warning", icon: CheckCircle2 },
    CANCELLED: { label: "Annulé", color: "text-danger", icon: XCircle },
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
                    "group relative overflow-hidden rounded-2xl border transition-colors",
                    "bg-[#0a0a0f]/60 hover:bg-[#101018]/80 cursor-pointer",
                    isActive ? cat.borderColor : "border-border",
                )}>

                    {/* Header bar */}
                    <div className={cn(
                        "flex items-center justify-between px-6 py-3.5 border-b relative z-10",
                        isActive ? "border-border" : "border-border",
                    )}>
                        <div className="flex items-center gap-2.5">
                            <span className="text-lg">{cat.emoji}</span>
                            <span className={cn("text-caption font-black uppercase tracking-[0.2em]", cat.color)}>{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            {poll.isAnonymous && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Lock className="w-4 h-4 text-muted-foreground hover:text-muted-foreground transition-colors" />
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="bg-surface border-border text-caption uppercase font-bold tracking-widest">
                                            Votes anonymes
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            <div className={cn("flex items-center gap-2 text-caption font-black uppercase tracking-widest", status.color)}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {status.label}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-7 space-y-7 relative z-10">

                        {poll.outcome && (
                            <div className="flex items-center gap-2 px-3.5 py-1.5 w-fit rounded-full bg-success/10 border border-success/20">
                                <Crown className="w-3.5 h-3.5 text-success" />
                                <span className="text-caption font-black uppercase tracking-widest text-success">Décision validée</span>
                            </div>
                        )}

                        <div>
                            <h3 className="text-foreground font-black text-2xl sm:text-3xl tracking-tight line-clamp-2 leading-[1.05]">
                                {poll.title}
                            </h3>
                            {poll.description && (
                                <p className="text-muted-foreground text-sm mt-4 line-clamp-2 leading-relaxed font-medium max-w-[90%]">
                                    {poll.description}
                                </p>
                            )}
                        </div>

                        {/* Mini result bars */}
                        <div className="space-y-4">
                            {poll.options.slice(0, 3).map((option) => {
                                const percent = totalVotes > 0 ? (option._count.votes / totalVotes) * 100 : 0;
                                const isWinning = option._count.votes === maxVotes && totalVotes > 0;
                                return (
                                    <div key={option.id} className="relative group/option">
                                        <div className="flex items-center justify-between text-caption uppercase tracking-[0.2em] font-black mb-2.5 px-0.5 gap-3">
                                            <span className={cn(
                                                "break-words whitespace-normal min-w-0 flex-1 transition-all",
                                                isWinning ? "text-foreground scale-105 origin-left" : "text-muted-foreground group-hover/option:text-muted-foreground"
                                            )}>
                                                {option.emoji && <span className="mr-2 text-sm opacity-80">{option.emoji}</span>}
                                                {option.label}
                                            </span>
                                            <span className={cn("tabular-nums font-black shrink-0", isWinning ? cat.color : "text-muted-foreground")}>
                                                {Math.round(percent)}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-surface border border-border overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${percent}%`,
                                                    background: isWinning
                                                        ? cat.glowColor.replace("0.4", "1")
                                                        : cat.glowColor.replace("0.4", "0.3"),
                                                    transition: "width 0.3s ease",
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {poll.options.length > 3 && (
                                <p className="text-muted-foreground text-caption font-black uppercase tracking-widest text-center pt-2 opacity-60">
                                    + {poll.options.length - 3} options supplémentaires
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={cn(
                        "flex items-center justify-between px-6 py-4 border-t relative z-10",
                        "border-border bg-surface",
                    )}>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-caption font-black uppercase tracking-widest text-muted-foreground">
                            <span className="flex items-center gap-2">
                                <span className="opacity-40">Par</span>
                                <span className="text-muted-foreground">{poll.creatorName}</span>
                            </span>
                            <div className="flex items-center gap-5">
                                <span className="flex items-center gap-2 text-muted-foreground border-l border-border pl-5 first:border-0 first:pl-0">
                                    <Users className="w-3.5 h-3.5 opacity-50" />
                                    {totalVotes} <span className="opacity-40 font-bold">votes</span>
                                </span>
                                {timeLeft && isActive && (
                                    <span className="flex items-center gap-2 text-warning/60 border-l border-border pl-5">
                                        <Clock className="w-3.5 h-3.5 opacity-50" />
                                        {timeLeft}
                                    </span>
                                )}
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-foreground group-hover:text-muted-foreground transition-colors" />
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
