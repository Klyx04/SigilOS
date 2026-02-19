"use client";

import { useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    BarChart3, Clock, Users, Lock, CheckCircle2, XCircle, ArrowLeft,
    Crown, Trash2, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
type PollCategory = "SUGGESTION" | "AMELIORATION" | "EVENT" | "MISSION" | "AUTRE";
type PollStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED";
import { castVote, closePoll, deletePoll, updatePoll } from "@/server/actions/poll-actions";
import { PollCreator } from "./poll-creator";
import { Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
}

export function PollDetail({ poll, guildId, isAdmin, currentProfileId, hasMicro }: PollDetailProps) {
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
                        // Single vote: remove old, add new
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
                        // Multi vote: add
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
            } else {
                toast.error(res.error || "Erreur lors du vote");
            }
        });
    }, [guildId, isActive, poll.allowMultipleVotes, votedOptionIds]);

    const [outcomeText, setOutcomeText] = useState("");
    const [notifyDiscord, setNotifyDiscord] = useState(true);
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
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Back + Header */}
            <Link
                href={`/dashboard/${guildId}/sondages`}
                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 hover:text-white transition-all group"
            >
                <div className="h-7 w-7 rounded-full border border-white/5 bg-white/5 flex items-center justify-center group-hover:border-white/20 transition-all group-hover:scale-110">
                    <ArrowLeft className="h-4 w-4" />
                </div>
                Retour aux sondages
            </Link>

            {/* Poll header card */}
            <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/60 backdrop-blur-sm">
                {/* Category glow */}
                <div
                    className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl opacity-20"
                    style={{ backgroundColor: cat.glowColor }}
                />
                <div
                    className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full blur-3xl opacity-10"
                    style={{ backgroundColor: cat.glowColor }}
                />

                <div className="relative p-6 md:p-8 space-y-4">
                    {/* Category + Status badges */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-bold", cat.color, `bg-${cat.color.split("-")[1]}-500/10`, `border-${cat.color.split("-")[1]}-500/20`)}>
                            <span>{cat.emoji}</span> {cat.label}
                        </div>

                        <div className="flex items-center gap-2">
                            {poll.isAnonymous && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] text-zinc-500">
                                    <Lock className="w-3 h-3" /> Anonyme
                                </div>
                            )}
                            {poll.allowMultipleVotes && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] text-zinc-500">
                                    <Users className="w-3 h-3" /> Multi-vote
                                </div>
                            )}
                            <div className={cn(
                                "px-3 py-1 rounded-xl text-xs font-bold",
                                isActive ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" :
                                    poll.status === "CLOSED" ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" :
                                        "bg-red-500/10 border border-red-500/20 text-red-400"
                            )}>
                                {isActive ? "En cours" : poll.status === "CLOSED" ? "Terminé" : "Annulé"}
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                        {poll.title}
                    </h1>

                    {poll.description && (
                        <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
                            {poll.description}
                        </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-6 flex-wrap text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                        <span className="flex items-center gap-2 group/meta">
                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center border border-white/5 transition-colors group-hover/meta:border-amber-500/30">
                                <Crown className="w-3 h-3 text-amber-500/50 group-hover/meta:text-amber-400" />
                            </div>
                            {poll.creatorName}
                        </span>
                        <span className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-zinc-700" />
                            {new Date(poll.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                        </span>
                        <span className="flex items-center gap-2">
                            <BarChart3 className="w-3 h-3 text-zinc-700" />
                            {localTotalVotes} signal{localTotalVotes !== 1 ? "aux" : "ement"}
                        </span>
                    </div>

                    {/* Voting instruction */}
                    {isActive && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xs text-cyan-400/60 font-medium"
                        >
                            {poll.allowMultipleVotes
                                ? "🗳️ Cliquez sur une option pour voter — vous pouvez en choisir plusieurs"
                                : "🗳️ Cliquez sur une option pour voter — un seul choix possible"
                            }
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Outcome Display */}
            {poll.outcome && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden group shadow-[0_0_30px_-10px_rgba(16,185,129,0.2)]"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle2 className="w-16 h-16 text-emerald-400" />
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-emerald-500/20 p-2 rounded-lg">
                            <Crown className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h4 className="text-emerald-400 font-bold tracking-tight text-sm">DÉCISION / OUTCOME</h4>
                    </div>
                    <p className="text-zinc-200 leading-relaxed italic relative z-10 whitespace-pre-wrap font-medium">
                        &quot;{poll.outcome}&quot;
                    </p>
                </motion.div>
            )}

            {/* Options / Results */}
            <div className="space-y-3">
                {localOptions.map((option, i) => {
                    const percent = localTotalVotes > 0 ? (option.voteCount / localTotalVotes) * 100 : 0;
                    const isVoted = votedOptionIds.includes(option.id);
                    const isWinning = option.voteCount === maxVotes && localTotalVotes > 0;

                    return (
                        <motion.div
                            key={option.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                        >
                            <button
                                onClick={() => handleVote(option.id)}
                                disabled={!isActive || isPending}
                                className={cn(
                                    "w-full relative overflow-hidden rounded-2xl border transition-all duration-300 text-left",
                                    "bg-zinc-900/60 backdrop-blur-sm",
                                    isActive ? "hover:bg-zinc-900/80 cursor-pointer hover:scale-[1.01]" : "cursor-default",
                                    isVoted
                                        ? "border-cyan-500/40 shadow-[0_0_15px_-5px_rgba(6,182,212,0.3)]"
                                        : "border-white/5 hover:border-white/10",
                                )}
                            >
                                {/* Progress bar background */}
                                <div className="absolute inset-0 z-0">
                                    <motion.div
                                        className={cn(
                                            "h-full opacity-10",
                                            isVoted ? cat.barColor : "bg-white",
                                        )}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percent}%` }}
                                        transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.05 + 0.1 }}
                                    />
                                </div>

                                <div className="relative z-10 flex items-center justify-between p-4 px-6 md:p-5">
                                    <div className="flex items-center gap-4 flex-1">
                                        {/* Check indicator */}
                                        <div className={cn(
                                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                                            isVoted ? "border-cyan-400 bg-cyan-500/20" : "border-white/20 bg-white/5"
                                        )}>
                                            <AnimatePresence>
                                                {isVoted && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        exit={{ scale: 0 }}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="flex-1">
                                            <span className="text-white font-bold text-sm md:text-base leading-tight">
                                                {option.emoji && <span className="mr-2">{option.emoji}</span>}
                                                {option.label}
                                            </span>
                                            {/* Voters preview */}
                                            {!poll.isAnonymous && option.votes.length > 0 && (
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <TooltipProvider>
                                                        <div className="flex -space-x-2">
                                                            {option.votes.slice(0, 5).map((v) => (
                                                                <Tooltip key={v.id}>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] text-zinc-400 font-black cursor-help">
                                                                            {v.voterName.charAt(0).toUpperCase()}
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="bg-zinc-900 border-white/10 text-xs font-bold">{v.voterName}</TooltipContent>
                                                                </Tooltip>
                                                            ))}
                                                        </div>
                                                    </TooltipProvider>
                                                    {option.votes.length > 5 && (
                                                        <span className="text-[10px] text-zinc-600 font-black tracking-tighter">
                                                            +{option.votes.length - 5}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 shrink-0 pl-4 border-l border-white/5">
                                        <div className="text-right">
                                            <div className={cn(
                                                "text-lg font-black tabular-nums leading-none mb-1",
                                                isWinning ? (isVoted ? "text-cyan-400" : "text-white") : "text-zinc-600"
                                            )}>
                                                {Math.round(percent)}%
                                            </div>
                                            <div className="text-[10px] text-zinc-600 tabular-nums font-black uppercase tracking-tighter">
                                                {option.voteCount} vote{option.voteCount !== 1 ? "s" : ""}
                                            </div>
                                        </div>
                                        {isWinning && localTotalVotes > 0 && (
                                            <motion.div
                                                initial={{ scale: 0, rotate: -15 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                className={cn("p-1.5 rounded-xl", isVoted ? "bg-cyan-500/20" : "bg-white/10")}
                                            >
                                                <Crown className={cn("w-4 h-4", isVoted ? "text-cyan-400" : "text-zinc-400")} />
                                            </motion.div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        </motion.div>
                    );
                })}
            </div>

            {/* Admin actions */}
            {canManage && (
                <div className="flex items-center gap-3 justify-end pt-4 border-t border-white/5">
                    {(isAdmin || (isCreator && hasMicro)) && isActive && (
                        <PollCreator
                            guildId={guildId}
                            editPoll={poll}
                            initialMicroStatus={null}
                            trigger={
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 h-9"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Modifier
                                </Button>
                            }
                        />
                    )}

                    {isActive && (
                        <Dialog open={showOutcomeModal} onOpenChange={setShowOutcomeModal}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 h-9 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Clôturer (Décision)
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-zinc-950 border-white/10 max-w-lg">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-emerald-400">
                                        <CheckCircle2 className="w-5 h-5" />
                                        Clôturer le sondage
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-black uppercase tracking-widest">Conclusion / Suite donnée (Optionnel)</Label>
                                        <Textarea
                                            placeholder="Ex: Suite à vos votes, nous avons décidé de lancer le farm du Glourséleste ce samedi à 14h. Soyez prêts !"
                                            value={outcomeText}
                                            onChange={(e) => setOutcomeText(e.target.value)}
                                            className="bg-zinc-900 border-white/5 focus:border-emerald-500/50 min-h-[120px] rounded-xl text-zinc-200"
                                        />
                                        <p className="text-[10px] text-zinc-500 italic">
                                            Cette conclusion sera affichée sur le dashboard.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/50 border border-white/5">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-bold text-zinc-200">Notifier Discord</Label>
                                            <p className="text-[10px] text-zinc-500">Envoyer le résumé du vote sur Discord</p>
                                        </div>
                                        <Switch
                                            checked={notifyDiscord}
                                            onCheckedChange={setNotifyDiscord}
                                            className="data-[state=checked]:bg-emerald-500"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleClose()}
                                        disabled={isPending}
                                        className="text-zinc-500 hover:text-white"
                                    >
                                        Clôturer sans conclusion
                                    </Button>
                                    <Button
                                        onClick={() => handleClose(outcomeText)}
                                        disabled={isPending}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 px-6 rounded-xl"
                                    >
                                        {isPending ? "Traitement..." : "Valider la décision"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10 h-9"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Supprimer
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-white/10">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-red-400">
                                    <AlertTriangle className="w-5 h-5" />
                                    Confirmer la suppression
                                </DialogTitle>
                            </DialogHeader>
                            <p className="text-zinc-400 text-sm">
                                Cette action est irréversible. Le sondage &quot;{poll.title}&quot; et tous ses votes seront supprimés définitivement.
                                {poll.discordMessageId && " L'embed Discord associé sera également supprimé."}
                            </p>
                            <div className="flex justify-end gap-3 mt-4">
                                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                                    Annuler
                                </Button>
                                <Button
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Confirmer
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            )}
        </div>
    );
}
