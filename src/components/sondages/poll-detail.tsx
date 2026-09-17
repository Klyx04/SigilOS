"use client";

import { useState, useTransition, useCallback, useMemo, useRef, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import {
    BarChart3, Clock, Users, Lock, CheckCircle2, XCircle, ArrowLeft,
    Crown, Trash2, AlertTriangle, Edit2, Megaphone, Send, Info, ExternalLink
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
    SUGGESTION: { label: "Suggestion", emoji: "💡", color: "text-info", gradient: "from-info to-info", glowColor: "rgba(6,182,212,0.4)", barColor: "bg-info" },
    AMELIORATION: { label: "Amélioration", emoji: "🔧", color: "text-success", gradient: "from-success to-success", glowColor: "rgba(16,185,129,0.4)", barColor: "bg-success" },
    EVENT: { label: "Événement", emoji: "🎉", color: "text-warning", gradient: "from-warning to-warning", glowColor: "rgba(245,158,11,0.4)", barColor: "bg-warning" },
    MISSION: { label: "Mission", emoji: "🎯", color: "text-danger", gradient: "from-danger to-danger", glowColor: "rgba(244,63,94,0.4)", barColor: "bg-danger" },
    AUTRE: { label: "Autres", emoji: "📋", color: "text-info", gradient: "from-info to-info", glowColor: "rgba(99,102,241,0.4)", barColor: "bg-info" },
};

const AVATAR_PALETTES = [
    "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    "bg-rose-500/20 text-rose-400 border border-rose-500/30",
    "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",
    "bg-purple-500/20 text-purple-400 border border-purple-500/30",
    "bg-teal-500/20 text-teal-400 border border-teal-500/30",
];

function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

interface PollVote {
    id: string;
    voterId: string;
    voterName: string;
    voterImage?: string | null;
    createdAt: string;
}

interface PollOption {
    id: string;
    label: string;
    emoji: string | null;
    order: number;
    voteCount: number;
    votes: PollVote[];
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
        mentionRoleId?: string | null;
        expiresAt: string | null;
        closedAt: string | null;
        createdAt: string;
        discordMessageId: string | null;
        discordChannelId: string | null;
        outcome: string | null;
        externalUrl: string | null;
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

function formatVoterDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Ligne d'option mémoïsée ──────────────────────────────────────────────
// PERF : évite de re-rendre toutes les options (et leurs listes de votants)
// quand le parent re-render (frappe clavier dans la modale, vote, etc.).
// La barre de progression utilise `transform: scaleX` (compositor GPU) au
// lieu d'animer `width` (layout main-thread). `content-visibility: auto`
// saute le rendu des options hors écran pendant le scroll.
const PollOptionRow = memo(function PollOptionRow({
    option,
    index,
    totalVotes,
    maxVotes,
    isVoted,
    isActive,
    isPending,
    isAnonymous,
    barColor,
    onVote,
}: {
    option: PollOption;
    index: number;
    totalVotes: number;
    maxVotes: number;
    isVoted: boolean;
    isActive: boolean;
    isPending: boolean;
    isAnonymous: boolean;
    barColor: string;
    onVote: (optionId: string) => void;
}) {
    const percent = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
    const isWinning = option.voteCount === maxVotes && totalVotes > 0;

    return (
        <div
            className={cn(
                "w-full rounded-2xl border transition-colors duration-200 overflow-hidden",
                "bg-surface p-5 md:p-6 space-y-4",
                "[content-visibility:auto] [contain-intrinsic-size:auto_240px]",
                isVoted
                    ? "border-info/40 shadow-lg shadow-cyan-900/10 bg-info/[0.03]"
                    : "border-border hover:border-border-strong"
            )}
        >
            {/* En-tête de l'option : emoji + titre + badge en tête + % + bouton voter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    {/* Emoji ou numéro */}
                    <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border",
                        isVoted
                            ? "bg-info text-info-foreground border-info shadow-md shadow-cyan-500/20"
                            : "bg-surface border-border text-foreground"
                    )}>
                        {option.emoji ? (
                            <span className="text-xl">{option.emoji}</span>
                        ) : (
                            <span className="text-base font-black">{index + 1}</span>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base md:text-lg font-black text-foreground break-words leading-snug">
                                {option.label}
                            </h3>
                            {isWinning && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-warning/15 text-warning border border-warning/30 shadow-sm">
                                    <Crown className="w-3 h-3 text-warning" />
                                    En tête
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Côté droit : % + nb votes + Bouton de vote dédié */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <div className="text-left sm:text-right">
                        <div className="flex items-baseline sm:justify-end gap-1.5">
                            <span className={cn(
                                "text-2xl font-black tabular-nums leading-none tracking-tight",
                                isWinning ? "text-warning" : "text-foreground"
                            )}>
                                {Math.round(percent)}%
                            </span>
                            <span className="text-xs font-bold text-muted-foreground tabular-nums">
                                ({option.voteCount} vote{option.voteCount > 1 ? "s" : ""})
                            </span>
                        </div>
                    </div>

                    {/* Bouton de vote dédié à côté du choix */}
                    <div>
                        {isActive ? (
                            <Button
                                onClick={() => onVote(option.id)}
                                disabled={isPending}
                                className={cn(
                                    "h-10 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-colors duration-200 shadow-sm",
                                    isVoted
                                        ? "bg-success/15 hover:bg-danger/15 text-success hover:text-danger border border-success/30 hover:border-danger/30 group/votedbtn"
                                        : "bg-info hover:bg-info/85 text-info-foreground shadow-cyan-900/10 active:scale-95"
                                )}
                            >
                                {isVoted ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 mr-1.5 group-hover/votedbtn:hidden text-success" />
                                        <XCircle className="w-4 h-4 mr-1.5 hidden group-hover/votedbtn:inline text-danger" />
                                        <span className="group-hover/votedbtn:hidden">Voté</span>
                                        <span className="hidden group-hover/votedbtn:inline">Retirer</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 mr-1.5 opacity-70" />
                                        <span>Voter</span>
                                    </>
                                )}
                            </Button>
                        ) : (
                            <span className="text-[11px] font-bold text-muted-foreground uppercase px-3 py-1.5 rounded-xl bg-surface border border-border">
                                {isVoted ? "✓ Votre vote" : "Fermé"}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Barre de progression : scaleX GPU, anneau sur le conteneur */}
            <div className="w-full space-y-1">
                <div className={cn(
                    "w-full h-3 rounded-full bg-surface border overflow-hidden",
                    isWinning ? "border-warning/50" : "border-border/60"
                )}>
                    <div
                        className={cn("h-full w-full origin-left rounded-full transition-transform duration-500 ease-out", barColor)}
                        style={{ transform: `scaleX(${percent / 100})` }}
                    >
                        {/* Reflet brillant doux */}
                        <div className="h-full w-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Liste des votants : propre, avec bulle profil Discord + pseudo */}
            <div className="pt-2 border-t border-border/40">
                {isAnonymous ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium italic">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Votes anonymes — les identités des votants sont masquées</span>
                    </div>
                ) : option.votes.length === 0 ? (
                    <span className="text-xs text-muted-foreground/60 italic font-medium">
                        Aucun vote pour cette proposition pour l'instant
                    </span>
                ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-caption font-bold uppercase tracking-wider text-muted-foreground mr-1">
                            Votants ({option.votes.length}) :
                        </span>
                        {option.votes.slice(0, 8).map((v) => (
                            <div
                                key={v.id}
                                className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-surface border border-border hover:border-info/30 transition-colors shadow-sm group/voter"
                                title={`${v.voterName} (a voté le ${formatVoterDate(v.createdAt)})`}
                            >
                                {v.voterImage ? (
                                    <img
                                        src={v.voterImage}
                                        alt={v.voterName}
                                        width={20}
                                        height={20}
                                        loading="lazy"
                                        decoding="async"
                                        draggable={false}
                                        className="w-5 h-5 rounded-full object-cover border border-border/50 shrink-0"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = "none";
                                        }}
                                    />
                                ) : (
                                    <div className={cn(
                                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black uppercase shrink-0",
                                        getAvatarColor(v.voterName)
                                    )}>
                                        {v.voterName.charAt(0)}
                                    </div>
                                )}
                                <span className="text-xs font-bold text-foreground group-hover/voter:text-info transition-colors truncate max-w-[130px]">
                                    {v.voterName}
                                </span>
                            </div>
                        ))}
                        {option.votes.length > 8 && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button
                                        type="button"
                                        className="text-xs font-black text-info hover:text-info hover:underline px-2.5 py-1 rounded-full bg-info/10 border border-info/25 cursor-pointer transition-colors hover:bg-info/15"
                                    >
                                        +{option.votes.length - 8} autres...
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md bg-background border border-border rounded-2xl p-6">
                                    <DialogHeader>
                                        <DialogTitle className="text-base font-black flex items-center gap-2">
                                            <span>Votants pour &quot;{option.label}&quot;</span>
                                            <span className="text-xs font-bold text-muted-foreground px-2.5 py-0.5 rounded-full bg-surface border border-border">
                                                {option.votes.length}
                                            </span>
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="max-h-80 overflow-y-auto space-y-2 mt-4 pr-1 premium-scrollbar">
                                        {option.votes.map((v) => (
                                            <div
                                                key={v.id}
                                                className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border hover:bg-surface transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {v.voterImage ? (
                                                        <img
                                                            src={v.voterImage}
                                                            alt={v.voterName}
                                                            width={32}
                                                            height={32}
                                                            loading="lazy"
                                                            decoding="async"
                                                            draggable={false}
                                                            className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                                                        />
                                                    ) : (
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black uppercase shrink-0",
                                                            getAvatarColor(v.voterName)
                                                        )}>
                                                            {v.voterName.charAt(0)}
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-bold text-foreground">{v.voterName}</span>
                                                </div>
                                                <span className="text-[11px] text-muted-foreground font-medium">
                                                    {formatVoterDate(v.createdAt)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

// ── Modale de clôture isolée ─────────────────────────────────────────────
// PERF : le texte de décision + le switch Discord vivent ici, donc chaque
// frappe ne re-render plus toute la page (options + votants).
function ClosePollDialog({
    open,
    onOpenChange,
    isPending,
    isDiscordConfigured,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isPending: boolean;
    isDiscordConfigured: boolean;
    onConfirm: (outcome: string | undefined, notifyDiscord: boolean) => void;
}) {
    const [outcomeText, setOutcomeText] = useState("");
    const [notifyDiscord, setNotifyDiscord] = useState(!!isDiscordConfigured);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button
                    className="h-14 px-8 rounded-2xl bg-success hover:bg-success text-success-foreground font-black uppercase tracking-widest text-caption shadow-lg shadow-emerald-900/20 gap-3"
                >
                    <CheckCircle2 className="w-5 h-5" />
                    Clôturer avec décision
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-background border-border max-w-xl p-8 rounded-[2rem]">
                <DialogHeader className="mb-6">
                    <DialogTitle className="flex items-center gap-4 text-success text-2xl font-black tracking-tighter">
                        <Megaphone className="w-8 h-8" />
                        Acter la décision
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-8">
                    <div className="space-y-3">
                        <Label className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Conclusion de la guilde</Label>
                        <Textarea
                            placeholder="Ex: Suite aux votes, nous lançons l'extension du coffre dès demain !"
                            value={outcomeText}
                            onChange={(e) => setOutcomeText(e.target.value)}
                            className="bg-surface/80 border-border focus:border-success/30 min-h-[160px] rounded-2xl p-4 text-foreground font-medium text-base resize-none"
                        />
                    </div>

                    <div className="p-6 rounded-2xl bg-[#5865F2]/5 border border-[#5865F2]/10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#5865F2]/20 p-3 rounded-xl">
                                <Megaphone className="w-5 h-5 text-[#5865F2]" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-foreground uppercase tracking-tight">Annonce Discord</p>
                                <p className="text-caption text-muted-foreground">Notifier tous les membres instantanément</p>
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
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/5 border border-warning/10">
                            <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                            <p className="text-caption font-bold text-warning/80 uppercase tracking-tight leading-relaxed">
                                Le salon Discord pour les sondages n&apos;est pas configuré. L&apos;annonce ne sera pas envoyée.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            variant="outline"
                            onClick={() => onConfirm(undefined, notifyDiscord)}
                            disabled={isPending}
                            className="h-14 rounded-2xl border-border text-muted-foreground hover:text-foreground uppercase font-black text-caption tracking-widest"
                        >
                            Fermer sans texte
                        </Button>
                        <Button
                            onClick={() => onConfirm(outcomeText, notifyDiscord)}
                            disabled={isPending || !outcomeText.trim()}
                            className="h-14 rounded-2xl bg-success hover:bg-success text-success-foreground shadow-xl shadow-emerald-950/40 uppercase font-black text-caption tracking-widest gap-2"
                        >
                            {isPending ? "Publication..." : <>Valider <Send className="w-4 h-4" /></>}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function PollDetail({ poll, guildId, isAdmin, currentProfileId, hasMicro, isDiscordConfigured }: PollDetailProps) {
    const [isPending, startTransition] = useTransition();
    const [votedOptionIds, setVotedOptionIds] = useState<string[]>(poll.userVotedOptionIds);
    const [localOptions, setLocalOptions] = useState(poll.options);
    const [localTotalVotes, setLocalTotalVotes] = useState(poll.totalVotes);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showOutcomeModal, setShowOutcomeModal] = useState(false);
    const router = useRouter();

    const cat = CATEGORY_CONFIG[poll.category];
    const isActive = poll.status === "ACTIVE";
    const isCreator = currentProfileId === poll.creatorId;
    const canManage = isAdmin || isCreator;
    const maxVotes = useMemo(
        () => Math.max(...localOptions.map(o => o.voteCount), 1),
        [localOptions]
    );

    // Miroir ref pour un callback de vote stable (les lignes mémoïsées ne
    // re-render que quand leurs propres props changent).
    const votedIdsRef = useRef(votedOptionIds);
    useEffect(() => {
        votedIdsRef.current = votedOptionIds;
    }, [votedOptionIds]);

    const handleVote = useCallback((optionId: string) => {
        if (!isActive) return;

        startTransition(async () => {
            const res = await castVote(guildId, optionId);
            if (res.success) {
                const data = res.data as { action: string } | undefined;
                const action = data?.action;
                const prevVotedIds = votedIdsRef.current;
                if (action === "voted") {
                    toast.success("Vote enregistré !");
                    if (!poll.allowMultipleVotes) {
                        setLocalOptions(prev => prev.map(o => {
                            if (prevVotedIds.includes(o.id) && o.id !== optionId) {
                                return { ...o, voteCount: Math.max(0, o.voteCount - 1) };
                            }
                            if (o.id === optionId) {
                                return { ...o, voteCount: o.voteCount + 1 };
                            }
                            return o;
                        }));
                        setLocalTotalVotes(prev => prevVotedIds.length > 0 ? prev : prev + 1);
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
    }, [guildId, isActive, poll.allowMultipleVotes, router]);

    const handleClose = useCallback((outcome: string | undefined, notifyDiscord: boolean) => {
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
    }, [guildId, poll.id, router]);

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
        <TooltipProvider>
        <div className="max-w-4xl mx-auto space-y-12">
            {/* Back Hero */}
            <div className="flex items-center justify-between px-2">
                <Link
                    href={`/dashboard/${guildId}/sondages`}
                    className="flex items-center gap-3 text-caption font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors group"
                >
                    <div className="h-8 w-8 rounded-full border border-border bg-surface/50 flex items-center justify-center group-hover:bg-surface transition-colors group-hover:-translate-x-1">
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
                                    className="h-8 gap-2 text-caption font-black uppercase tracking-widest text-muted-foreground hover:text-info hover:bg-info/5"
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
                            className="h-8 gap-2 text-caption font-black uppercase tracking-widest text-muted-foreground hover:text-danger hover:bg-danger/5 underline decoration-red-500/30 decoration-dotted"
                        >
                            <Trash2 className="w-3 h-3" />
                            Supprimer
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Content Card */}
            {/* PERF : fond opaque, pas de backdrop-blur (recalculé à chaque frame
                de scroll) ni de halo blur-[120px] décoratif. */}
            <div className="relative">
                <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-surface shadow-xl">
                    <div className="p-8 md:p-12 space-y-10">
                        {/* Status + Category Row */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className={cn(
                                "flex items-center gap-3 px-4 py-2 rounded-2xl border text-caption font-black uppercase tracking-[0.15em]",
                                cat.color,
                                "bg-surface border-border"
                            )}>
                                <span className="text-sm">{cat.emoji}</span>
                                {cat.label}
                            </div>

                            <div className="flex items-center gap-2">
                                {poll.isAnonymous && (
                                    <Tooltip>
                                        <TooltipTrigger className="bg-surface border border-border p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
                                            <Lock className="w-4 h-4" />
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-background border-border text-caption uppercase font-bold tracking-widest">Votes anonymes</TooltipContent>
                                    </Tooltip>
                                )}
                                {poll.allowMultipleVotes && (
                                    <Tooltip>
                                        <TooltipTrigger className="bg-surface border border-border p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
                                            <Users className="w-4 h-4" />
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-background border-border text-caption uppercase font-bold tracking-widest">Multi-vote activé</TooltipContent>
                                    </Tooltip>
                                )}
                                <div className={cn(
                                    "px-5 py-2 rounded-2xl text-caption font-black uppercase tracking-[0.2em] shadow-lg",
                                    isActive ? "bg-success/10 border border-success/20 text-success shadow-emerald-900/10" :
                                        poll.status === "CLOSED" ? "bg-warning/10 border border-warning/20 text-warning shadow-amber-900/10" :
                                            "bg-danger/10 border border-danger/20 text-danger shadow-red-900/10"
                                )}>
                                    {isActive ? "Sondage Ouvert" : poll.status === "CLOSED" ? "Archivé / Terminé" : "Consultation Annulée"}
                                </div>
                            </div>
                        </div>

                        {/* Title & Description */}
                        <div className="space-y-4">
                            <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter leading-[0.95] max-w-2xl">
                                {poll.title}
                            </h1>
                            {poll.description && (
                                <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-3xl font-medium whitespace-pre-wrap">
                                    {poll.description}
                                </p>
                            )}
                            {poll.externalUrl && (
                                <a
                                    href={poll.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-elevated/60 text-foreground border border-border hover:bg-muted/60 hover:text-foreground hover:border-border-strong transition-colors group w-fit"
                                >
                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-info transition-colors" />
                                    Source externe
                                    <span className="text-muted-foreground group-hover:text-muted-foreground transition-colors normal-case font-medium truncate max-w-[200px]">
                                        {(() => { try { return new URL(poll.externalUrl).hostname; } catch { return poll.externalUrl; } })()}
                                    </span>
                                </a>
                            )}
                        </div>

                        {/* Meta Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-border">
                            <div className="space-y-1">
                                <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest">Initiateur</p>
                                <p className="text-sm text-foreground font-bold flex items-center gap-2 group cursor-default">
                                    <span className="w-5 h-5 rounded-full bg-warning/10 flex items-center justify-center border border-warning/20">
                                        <Crown className="w-3 h-3 text-warning" />
                                    </span>
                                    <span className="group-hover:text-info transition-colors">{poll.creatorName}</span>
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest">Date</p>
                                <p className="text-sm text-foreground font-bold flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    {new Date(poll.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest">Participation</p>
                                <p className="text-sm text-foreground font-bold flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                                    {localTotalVotes} votant{localTotalVotes !== 1 ? "s" : ""}
                                </p>
                            </div>
                            {poll.expiresAt && isActive && (
                                <div className="space-y-1">
                                    <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest">Status temps</p>
                                    <p className="text-sm text-warning/80 font-bold border-l-2 border-warning/30 pl-3">
                                        Fin {new Date(poll.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Outcome Display (Professional) */}
            {poll.outcome && (
                <div className="bg-success/5 border border-success/10 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-xl shadow-emerald-950/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none" aria-hidden="true">
                        <CheckCircle2 className="w-32 h-32 text-success" />
                    </div>

                    <div className="max-w-3xl relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-success/20 p-3 rounded-2xl border border-success/30">
                                <Crown className="w-6 h-6 text-success" />
                            </div>
                            <div>
                                <h4 className="text-success font-black tracking-widest text-caption uppercase">Décision Officielle</h4>
                                <p className="text-muted-foreground text-caption font-bold uppercase tracking-tighter">Status: Clôturé avec succès</p>
                            </div>
                        </div>
                        <p className="text-foreground text-xl md:text-2xl leading-relaxed italic font-bold max-w-[90%] decoration-emerald-500/20 underline decoration-double underline-offset-8">
                            &quot;{poll.outcome}&quot;
                        </p>
                    </div>
                </div>
            )}

            {/* Voting Section */}
            <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between mb-2 px-2">
                    <h2 className="text-caption font-black uppercase tracking-widest text-muted-foreground">Propositions et résultats</h2>
                    {isActive && (
                        <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-info motion-safe:animate-pulse" />
                            <span className="text-caption font-bold text-info uppercase tracking-widest">Votes ouverts</span>
                        </span>
                    )}
                </div>

                <div className="space-y-4">
                    {localOptions.map((option, i) => (
                        <PollOptionRow
                            key={option.id}
                            option={option}
                            index={i}
                            totalVotes={localTotalVotes}
                            maxVotes={maxVotes}
                            isVoted={votedOptionIds.includes(option.id)}
                            isActive={isActive}
                            isPending={isPending}
                            isAnonymous={poll.isAnonymous}
                            barColor={cat.barColor}
                            onVote={handleVote}
                        />
                    ))}
                </div>
            </div>

            {/* Footer Admin Actions */}
            {canManage && isActive && (
                <div className="pt-12 border-t border-border">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-surface/40 p-10 rounded-[2.5rem] border border-border">
                        <div className="space-y-2 text-center sm:text-left">
                            <h3 className="text-foreground font-black text-xl tracking-tight">Fin de consultation ?</h3>
                            <p className="text-muted-foreground text-caption font-medium max-w-xs">
                                Clôturez le sondage pour valider une décision officielle et notifier les membres sur Discord.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <ClosePollDialog
                                open={showOutcomeModal}
                                onOpenChange={setShowOutcomeModal}
                                isPending={isPending}
                                isDiscordConfigured={!!isDiscordConfigured}
                                onConfirm={handleClose}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="bg-background border-border max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-danger font-black text-xl">
                            <AlertTriangle className="w-6 h-6" />
                            Suppression Définitive
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                            Vous êtes sur le point de supprimer <span className="text-foreground font-bold">&quot;{poll.title}&quot;</span>.
                            Cette action effacera également les votes et l&apos;embed Discord associé.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="h-12 rounded-xl text-muted-foreground hover:text-foreground uppercase font-black text-caption tracking-widest">
                                Annuler
                            </Button>
                            <Button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="h-12 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 uppercase font-black text-caption tracking-widest"
                            >
                                {isPending ? "..." : "Confirmer"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
        </TooltipProvider>
    );
}
