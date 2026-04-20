"use client";

import { useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    BarChart3, Clock, Users, Lock, CheckCircle2, XCircle, ArrowLeft,
    Crown, Trash2, AlertTriangle, Edit2, Megaphone, Send, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { castVote, closePoll, deletePoll } from "@/server/actions/poll-actions";
import { PollCreator } from "./poll-creator";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type PollCategory = "SUGGESTION" | "AMELIORATION" | "EVENT" | "MISSION" | "AUTRE";
type PollStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED";

const CATEGORY_CONFIG: Record<string, {
    label: string; emoji: string; color: string;
    gradient: string; glowColor: string; barColor: string;
}> = {
    SUGGESTION: { label: "Suggestion", emoji: "💡", color: "text-cyan-400", gradient: "from-cyan-500 to-cyan-600", glowColor: "rgba(6,182,212,0.4)", barColor: "bg-cyan-500" },
    AMELIORATION: { label: "Amélioration", emoji: "🔧", color: "text-emerald-400", gradient: "from-emerald-500 to-emerald-600", glowColor: "rgba(16,185,129,0.4)", barColor: "bg-emerald-500" },
    EVENT: { label: "Événement", emoji: "🎉", color: "text-amber-400", gradient: "from-amber-500 to-amber-600", glowColor: "rgba(245,158,11,0.4)", barColor: "bg-amber-500" },
    MISSION: { label: "Mission", emoji: "🎯", color: "text-rose-400", gradient: "from-rose-500 to-rose-600", glowColor: "rgba(244,63,94,0.4)", barColor: "bg-rose-500" },
    AUTRE: { label: "Autres", emoji: "📋", color: "text-indigo-400", gradient: "from-indigo-500 to-indigo-600", glowColor: "rgba(99,102,241,0.4)", barColor: "bg-indigo-500" },
};

interface PollOption {
    id: string;
    label: string;
    emoji: string | null;
    order: number;
    voteCount: number;
    votes: { id: string; voterId: string; voterName: string; createdAt: string }[];
}

interface PollDetailProps {
    poll: {
        id: string;
        title: string;
        description: string | null;
        category: PollCategory;
        status: PollStatus;
        creatorName: string;
        creatorId: string;
        allowMultipleVotes: boolean;
        isAnonymous: boolean;
        expiresAt: string | null;
        closedAt: string | null;
        createdAt: string;
        discordMessageId: string | null;
        discordChannelId: string | null;
        outcome: string | null;
        options: PollOption[];
        userVotedOptionIds: string[];
        totalVotes: number;
    };
    guildId: string;
    isAdmin: boolean;
    currentProfileId?: string;
    hasMicro?: boolean;
    isDiscordConfigured?: boolean;
}

export function PollDetail({ poll, guildId, isAdmin, currentProfileId, hasMicro, isDiscordConfigured }: PollDetailProps) {
    const [isPending, startTransition] = useTransition();
    const [votedOptionIds, setVotedOptionIds] = useState<string[]>(poll.userVotedOptionIds);
    const [localOptions, setLocalOptions] = useState(poll.options);
    const [localTotalVotes, setLocalTotalVotes] = useState(poll.totalVotes);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const router = useRouter();

    const cat = CATEGORY_CONFIG[poll.category];
    const isActive = poll.status === "ACTIVE";
    const isCreator = currentProfileId === poll.creatorId;
    const canManage = isAdmin || isCreator;
    const maxVotes = Math.max(...localOptions.map(o => o.voteCount), 1);

    const handleVote = useCallback((optionId: string) => {
        if (!isActive) return;

        startTransition(async () => {
            const res = await castVote(guildId, optionId);
            if (res.success) {
                const data = res.data as { action: string } | undefined;
                const action = data?.action;
                if (action === "voted") {
                    toast.success("Vote enregistré !");
                    if (!poll.allowMultipleVotes) {
                        setLocalOptions(prev => prev.map(o => {
                            if (votedOptionIds.includes(o.id) && o.id !== optionId) {
                                return { ...o, voteCount: Math.max(0, o.voteCount - 1) };
                            }
                            if (o.id === optionId) {
                                return { ...o, voteCount: o.voteCount + 1 };
                            }
                            return o;
                        }));
                        setLocalTotalVotes(prev => votedOptionIds.length > 0 ? prev : prev + 1);
                        setVotedOptionIds([optionId]);
                    } else {
                        setLocalOptions(prev => prev.map(o =>
                            o.id === optionId ? { ...o, voteCount: o.voteCount + 1 } : o
                        ));
                        setLocalTotalVotes(prev => prev + 1);
                        setVotedOptionIds(prev => [...prev, optionId]);
                    }
                } else {
                    toast.info("Vote retiré");
                    setLocalOptions(prev => prev.map(o =>
                        o.id === optionId ? { ...o, voteCount: Math.max(0, o.voteCount - 1) } : o
                    ));
                    setLocalTotalVotes(prev => Math.max(0, prev - 1));
                    setVotedOptionIds(prev => prev.filter(id => id !== optionId));
                }
                router.refresh();
            } else {
                toast.error(res.error || "Erreur lors du vote");
            }
        });
    }, [guildId, isActive, poll.allowMultipleVotes, votedOptionIds, router]);

    const [outcomeText, setOutcomeText] = useState("");
    const [notifyDiscord, setNotifyDiscord] = useState(!!isDiscordConfigured);
    const [showOutcomeModal, setShowOutcomeModal] = useState(false);

    const handleClose = (outcome?: string) => {
        startTransition(async () => {
            const res = await closePoll(guildId, poll.id, outcome, notifyDiscord);
            if (res.success) {
                toast.success(outcome ? "Sondage clôturé avec décision !" : "Sondage fermé !");
                setShowOutcomeModal(false);
                router.refresh();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const handleDelete = () => {
        startTransition(async () => {
            const res = await deletePoll(guildId, poll.id);
            if (res.success) {
                toast.success("Sondage supprimé !");
                router.push(`/dashboard/${guildId}/sondages`);
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            {/* Back Hero */}
            <div className="flex items-center justify-between px-2">
                <Link
                    href={`/dashboard/${guildId}/sondages`}
                    className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-all group"
                >
                    <div className="h-8 w-8 rounded-full border border-white/5 bg-zinc-900/50 flex items-center justify-center group-hover:bg-white/5 transition-all group-hover:-translate-x-1">
                        <ArrowLeft className="h-4 w-4" />
                    </div>
                    Retour à la liste
                </Link>

                <div className="flex items-center gap-4">
                    {canManage && isActive && (isAdmin || (isCreator && hasMicro)) && (
                        <PollCreator
                            guildId={guildId}
                            editPoll={poll}
                            initialMicroStatus={null}
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/5"
                                >
                                    <Edit2 className="w-3 h-3" />
                                    Modifier
                                </Button>
                            }
                        />
                    )}
                    {canManage && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="h-8 gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-400 hover:bg-red-500/5 underline decoration-red-500/30 decoration-dotted"
                        >
                            <Trash2 className="w-3 h-3" />
                            Supprimer
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Content Card */}
            <div className="relative">
                {/* Visual Accent */}
                <div
                    className="absolute -top-[10%] -right-[5%] w-[40%] h-[60%] blur-[120px] opacity-20 pointer-events-none rounded-full"
                    style={{ backgroundColor: cat.glowColor }}
                />

                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#030303]/60 backdrop-blur-md shadow-2xl">
                    <div className="p-8 md:p-12 space-y-10">
                        {/* Status + Category Row */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className={cn(
                                "flex items-center gap-3 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-[0.15em]",
                                cat.color,
                                "bg-white/[0.03] border-white/5"
                            )}>
                                <span className="text-sm">{cat.emoji}</span>
                                {cat.label}
                            </div>

                            <div className="flex items-center gap-2">
                                {poll.isAnonymous && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors">
                                                <Lock className="w-4 h-4" />
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-zinc-950 border-white/10 text-[10px] uppercase font-bold tracking-widest">Votes anonymes</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                                {poll.allowMultipleVotes && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="bg-white/[0.03] border border-white/5 p-2 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors">
                                                <Users className="w-4 h-4" />
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-zinc-950 border-white/10 text-[10px] uppercase font-bold tracking-widest">Multi-vote activé</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                                <div className={cn(
                                    "px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg",
                                    isActive ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-emerald-900/10" :
                                        poll.status === "CLOSED" ? "bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-amber-900/10" :
                                            "bg-red-500/10 border border-red-500/20 text-red-400 shadow-red-900/10"
                                )}>
                                    {isActive ? "Sondage Ouvert" : poll.status === "CLOSED" ? "Archivé / Terminé" : "Consultation Annulée"}
                                </div>
                            </div>
                        </div>

                        {/* Title & Description */}
                        <div className="space-y-6">
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-[0.95] max-w-2xl">
                                {poll.title}
                            </h1>
                            {poll.description && (
                                <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-3xl font-medium">
                                    {poll.description}
                                </p>
                            )}
                        </div>

                        {/* Meta Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-white/[0.03]">
                            <div className="space-y-1">
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Initiateur</p>
                                <p className="text-sm text-zinc-300 font-bold flex items-center gap-2 group cursor-default">
                                    <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                        <Crown className="w-3 h-3 text-amber-500" />
                                    </span>
                                    <span className="group-hover:text-cyan-400 transition-colors">{poll.creatorName}</span>
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Date</p>
                                <p className="text-sm text-zinc-300 font-bold flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-zinc-700" />
                                    {new Date(poll.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Participation</p>
                                <p className="text-sm text-zinc-300 font-bold flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-zinc-700" />
                                    {localTotalVotes} votant{localTotalVotes !== 1 ? "s" : ""}
                                </p>
                            </div>
                            {poll.expiresAt && isActive && (
                                <div className="space-y-1">
                                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Status temps</p>
                                    <p className="text-sm text-amber-500/80 font-bold border-l-2 border-amber-500/30 pl-3">
                                        Fin {new Date(poll.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Outcome Display (Professional) */}
            <AnimatePresence>
                {poll.outcome && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl shadow-emerald-950/20"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                            <CheckCircle2 className="w-32 h-32 text-emerald-400" />
                        </div>

                        <div className="max-w-3xl relative z-10">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="bg-emerald-500/20 p-3 rounded-2xl border border-emerald-500/30">
                                    <Crown className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="text-emerald-400 font-black tracking-widest text-[10px] uppercase">Décision Officielle</h4>
                                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-tighter">Status: Clôturé avec succès</p>
                                </div>
                            </div>
                            <p className="text-zinc-100 text-xl md:text-2xl leading-relaxed italic font-bold max-w-[90%] decoration-emerald-500/20 underline decoration-double underline-offset-8">
                                &quot;{poll.outcome}&quot;
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Voting Section */}
            <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between mb-4 px-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">Propositions et resultats</h2>
                    {isActive && (
                        <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">En direct</span>
                        </span>
                    )}
                </div>

                <div className="space-y-4">
                    {localOptions.map((option, i) => {
                        const percent = localTotalVotes > 0 ? (option.voteCount / localTotalVotes) * 100 : 0;
                        const isVoted = votedOptionIds.includes(option.id);
                        const isWinning = option.voteCount === maxVotes && localTotalVotes > 0;

                        return (
                            <motion.button
                                key={option.id}
                                onClick={() => handleVote(option.id)}
                                disabled={!isActive || isPending}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={cn(
                                    "w-full group relative overflow-hidden rounded-3xl border transition-all duration-500 text-left",
                                    "bg-zinc-900/40 backdrop-blur-sm",
                                    isActive
                                        ? "hover:bg-zinc-900/80 cursor-pointer"
                                        : "cursor-default opacity-80",
                                    isVoted
                                        ? "border-cyan-500/30 shadow-lg shadow-cyan-900/10"
                                        : "border-white/5"
                                )}
                            >
                                {/* Results fill */}
                                <div className="absolute inset-0">
                                    <motion.div
                                        className={cn(
                                            "h-full transition-colors",
                                            isVoted ? "bg-cyan-500/10" : "bg-white/[0.03]"
                                        )}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percent}%` }}
                                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 + 0.2 }}
                                    />
                                    {isWinning && localTotalVotes > 0 && (
                                        <div className="absolute inset-0 border-2 border-amber-500/10 rounded-3xl pointer-events-none" />
                                    )}
                                </div>

                                <div className="relative z-10 flex items-center justify-between p-6">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        {/* Status Icon / Index */}
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shrink-0",
                                            isVoted
                                                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 scale-110"
                                                : "bg-white/[0.05] text-zinc-600 group-hover:bg-white/10"
                                        )}>
                                            {isVoted ? <CheckCircle2 className="w-6 h-6" /> : <div className="text-xl font-black">{option.emoji || (i + 1)}</div>}
                                        </div>

                                        <div className="min-w-0">
                                            <p className={cn(
                                                "text-lg font-black transition-colors truncate",
                                                isVoted ? "text-white" : "text-zinc-300 group-hover:text-white"
                                            )}>
                                                {option.label}
                                            </p>

                                            {/* Voters preview */}
                                            {!poll.isAnonymous && option.votes.length > 0 && (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <div className="flex -space-x-1.5">
                                                        {option.votes.slice(0, 4).map((v) => (
                                                            <div key={v.id} className="w-5 h-5 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[8px] font-black text-zinc-400 uppercase">
                                                                {v.voterName.charAt(0)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {option.votes.length > 4 && (
                                                        <span className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter">
                                                            +{option.votes.length - 4} autres
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats block */}
                                    <div className="flex items-center gap-6 shrink-0 md:pl-8 border-l border-white/[0.03]">
                                        <div className="text-right">
                                            <div className={cn(
                                                "text-2xl font-black tabular-nums leading-none tracking-tighter",
                                                isWinning ? (isVoted ? "text-cyan-400" : "text-amber-400") : "text-zinc-700"
                                            )}>
                                                {Math.round(percent)}%
                                            </div>
                                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">
                                                {option.voteCount} vote{option.voteCount !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                        {isWinning && localTotalVotes > 0 && (
                                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                                <Crown className="w-5 h-5 text-amber-500/60" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* Footer Admin Actions */}
            {canManage && isActive && (
                <div className="pt-12 border-t border-white/5">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5">
                        <div className="space-y-2 text-center sm:text-left">
                            <h3 className="text-white font-black text-xl tracking-tight">Fin de consultation ?</h3>
                            <p className="text-zinc-500 text-[11px] font-medium max-w-xs">
                                Clôturez le sondage pour valider une décision officielle et notifier les membres sur Discord.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <Dialog open={showOutcomeModal} onOpenChange={setShowOutcomeModal}>
                                <DialogTrigger asChild>
                                    <Button
                                        className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-900/20 gap-3"
                                    >
                                        <CheckCircle2 className="w-5 h-5" />
                                        Clôturer avec décision
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-zinc-950 border-white/10 max-w-xl p-8 rounded-[2rem]">
                                    <DialogHeader className="mb-6">
                                        <DialogTitle className="flex items-center gap-4 text-emerald-400 text-2xl font-black tracking-tighter">
                                            <Megaphone className="w-8 h-8" />
                                            Acter la décision
                                        </DialogTitle>
                                    </DialogHeader>

                                    <div className="space-y-8">
                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Conclusion de la guilde</Label>
                                            <Textarea
                                                placeholder="Ex: Suite aux votes, nous lançons l'extension du coffre dès demain !"
                                                value={outcomeText}
                                                onChange={(e) => setOutcomeText(e.target.value)}
                                                className="bg-zinc-900/80 border-white/5 focus:border-emerald-500/30 min-h-[160px] rounded-2xl p-4 text-white font-medium text-base resize-none"
                                            />
                                        </div>

                                        <div className="p-6 rounded-2xl bg-[#5865F2]/5 border border-[#5865F2]/10 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-[#5865F2]/20 p-3 rounded-xl">
                                                    <Megaphone className="w-5 h-5 text-[#5865F2]" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white uppercase tracking-tight">Annonce Discord</p>
                                                    <p className="text-[10px] text-zinc-500">Notifier tous les membres instantanément</p>
                                                </div>
                                            </div>
                                            <Switch
                                                disabled={!isDiscordConfigured}
                                                checked={notifyDiscord}
                                                onCheckedChange={setNotifyDiscord}
                                                className="data-[state=checked]:bg-[#5865F2]"
                                            />
                                        </div>

                                        {!isDiscordConfigured && (
                                            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 animate-in fade-in slide-in-from-top-2">
                                                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-tight leading-relaxed">
                                                    Le salon Discord pour les sondages n&apos;est pas configuré. L&apos;annonce ne sera pas envoyée.
                                                </p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                variant="outline"
                                                onClick={() => handleClose()}
                                                disabled={isPending}
                                                className="h-14 rounded-2xl border-white/5 text-zinc-500 hover:text-white uppercase font-black text-[10px] tracking-widest"
                                            >
                                                Fermer sans texte
                                            </Button>
                                            <Button
                                                onClick={() => handleClose(outcomeText)}
                                                disabled={isPending || !outcomeText.trim()}
                                                className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-950/40 uppercase font-black text-[10px] tracking-widest gap-2"
                                            >
                                                {isPending ? "Publication..." : <>Valider <Send className="w-4 h-4" /></>}
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="bg-zinc-950 border-white/10 max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-red-400 font-black text-xl">
                            <AlertTriangle className="w-6 h-6" />
                            Suppression Définitive
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        <p className="text-zinc-400 text-sm leading-relaxed font-medium">
                            Vous êtes sur le point de supprimer <span className="text-white font-bold">&quot;{poll.title}&quot;</span>. 
                            Cette action effacera également les votes et l&apos;embed Discord associé.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="h-12 rounded-xl text-zinc-500 hover:text-white uppercase font-black text-[10px] tracking-widest">
                                Annuler
                            </Button>
                            <Button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="h-12 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 uppercase font-black text-[10px] tracking-widest"
                            >
                                {isPending ? "..." : "Confirmer"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
