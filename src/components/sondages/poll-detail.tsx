"use client";

import { useState, useTransition, useCallback, useMemo, useRef, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { formatPollEnd } from "@/lib/poll-format";
import { type PollMember } from "@/lib/polls/participation";
import {
    POLL_MEMBER_ROW, POLL_SEGMENT_GROUP, POLL_SEGMENT_ITEM,
    POLL_SEGMENT_ITEM_ACTIVE, POLL_SEGMENT_ITEM_IDLE, POLL_SCHEDULED_TAG,
} from "@/lib/polls/ui";
import { SCHEDULED_POLL_TAG } from "@/lib/polls/scheduling";
import {
    BarChart3, Clock, Users, Lock, CheckCircle2, XCircle, ArrowLeft,
    Crown, Trash2, AlertTriangle, Edit2, Megaphone, Send, Info, ExternalLink,
    Lightbulb, Wrench, PartyPopper, Target, Folder, UserX, CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { castVote, closePoll, deletePoll } from "@/server/actions/poll-actions";
import { PollCreator } from "./poll-creator";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type PollCategory = "SUGGESTION" | "AMELIORATION" | "EVENT" | "MISSION" | "AUTRE";
type PollStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED";

/**
 * Catégories : **libellé + icône + ton du thème**, jamais d'emoji picto (le module portait cinq
 * placeholders `💡🔧🎉🎯📋`) et plus de champs morts (`gradient` / `glowColor` n'étaient lus nulle part).
 */
const CATEGORY_CONFIG: Record<string, {
    label: string; icon: React.ElementType; color: string; barColor: string;
}> = {
    SUGGESTION: { label: "Suggestion", icon: Lightbulb, color: "text-info", barColor: "bg-info" },
    AMELIORATION: { label: "Amélioration", icon: Wrench, color: "text-success", barColor: "bg-success" },
    EVENT: { label: "Événement", icon: PartyPopper, color: "text-warning", barColor: "bg-warning" },
    MISSION: { label: "Mission", icon: Target, color: "text-danger", barColor: "bg-danger" },
    AUTRE: { label: "Autres", icon: Folder, color: "text-muted-foreground", barColor: "bg-muted-foreground" },
};

/** Avatar de secours : un seul jeton neutre (sept familles de palette en dur auparavant, pour rien). */
const AVATAR_FALLBACK = "border border-border bg-surface text-muted-foreground";

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
        /** Membres actifs n'ayant PAS voté (complément des votants). Vide / absent si anonyme. */
        nonVoters?: PollMember[];
        /** Nombre de votants distincts et de membres actifs (participation honnête). */
        voterCount?: number;
        memberCount?: number;
        /** Publié automatiquement par le module staff « Sondages programmés ». */
        isScheduled?: boolean;
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

/**
 * Ligne de membre — **rendu unique** des deux listes (votants d'un choix, non-votants) :
 * rayon court, tokens du thème, une seule source pour l'avatar de secours.
 */
function PollMemberRow({ name, image, meta }: { name: string; image?: string | null; meta?: string }) {
    return (
        <div className={POLL_MEMBER_ROW}>
            <div className="flex items-center gap-3 min-w-0">
                {image ? (
                    <img
                        src={image}
                        alt=""
                        width={32}
                        height={32}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                        onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                        }}
                    />
                ) : (
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold uppercase shrink-0",
                        AVATAR_FALLBACK
                    )}>
                        {name.charAt(0)}
                    </div>
                )}
                <span className="text-sm text-foreground truncate">{name}</span>
            </div>
            {meta && <span className="text-xs text-muted-foreground shrink-0">{meta}</span>}
        </div>
    );
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
                "w-full rounded-lg border transition-colors duration-200 overflow-hidden",
                "bg-surface p-4 md:p-5 space-y-3",
                "[content-visibility:auto] [contain-intrinsic-size:auto_240px]",
                isVoted
                    ? "border-info/40 bg-info/[0.03]"
                    : "border-border hover:border-border-strong"
            )}
        >
            {/* En-tête de l'option : emoji + titre + badge en tête + % + bouton voter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    {/* Emoji ou numéro */}
                    <div className={cn(
                        "w-10 h-10 rounded-md flex items-center justify-center shrink-0 border",
                        isVoted
                            ? "bg-info text-info-foreground border-info"
                            : "bg-surface border-border text-foreground"
                    )}>
                        {option.emoji ? (
                            <span className="text-xl">{option.emoji}</span>
                        ) : (
                            <span className="text-sm font-semibold">{index + 1}</span>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-foreground break-words leading-snug">
                                {option.label}
                            </h3>
                            {isWinning && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/15 text-warning border border-warning/30">
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
                                "text-xl font-semibold tabular-nums leading-none",
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
                                    "h-9 px-4 rounded-md font-semibold text-xs transition-colors duration-200",
                                    isVoted
                                        ? "bg-success/15 hover:bg-danger/15 text-success hover:text-danger border border-success/30 hover:border-danger/30 group/votedbtn"
                                        : "bg-info hover:bg-info/85 text-info-foreground"
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
                            <span className="text-[11px] font-medium text-muted-foreground px-3 py-1.5 rounded-md bg-surface border border-border">
                                {isVoted ? "✓ Votre vote" : "Fermé"}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Barre de progression : scaleX GPU, anneau sur le conteneur */}
            <div className="w-full space-y-1">
                <div className={cn(
                    "w-full h-2 rounded-full bg-surface border overflow-hidden",
                    isWinning ? "border-warning/50" : "border-border/60"
                )}>
                    <div
                        className={cn("h-full w-full origin-left rounded-full transition-transform duration-500 ease-out", barColor)}
                        style={{ transform: `scaleX(${percent / 100})` }}
                    />
                </div>
            </div>

            {/* Liste des votants : propre, avec bulle profil Discord + pseudo */}
            <div className="pt-2 border-t border-border/40">
                {isAnonymous ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Votes anonymes — les identités des votants sont masquées</span>
                    </div>
                ) : option.votes.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Aucun vote pour cette proposition pour l&apos;instant</span>
                ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mr-1">
                            Votants ({option.votes.length})
                        </span>
                        {option.votes.slice(0, 8).map((v) => (
                            <div
                                key={v.id}
                                className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-surface border border-border hover:border-info/30 transition-colors group/voter"
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
                                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold uppercase shrink-0",
                                        AVATAR_FALLBACK
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
                                        className="text-xs font-medium text-info hover:underline px-2.5 py-1 rounded-full bg-info/10 border border-info/25 cursor-pointer transition-colors hover:bg-info/20"
                                    >
                                        +{option.votes.length - 8} autres
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-sm font-semibold">
                                            Votants — {option.label}
                                        </DialogTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {option.votes.length} membre{option.votes.length > 1 ? "s" : ""}
                                        </p>
                                    </DialogHeader>
                                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1 premium-scrollbar">
                                        {option.votes.map((v) => (
                                            <PollMemberRow
                                                key={v.id}
                                                name={v.voterName}
                                                image={v.voterImage}
                                                meta={formatVoterDate(v.createdAt)}
                                            />
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
                    className="h-9 gap-2 rounded-md bg-success hover:bg-success/85 text-success-foreground text-xs font-semibold"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    Clôturer avec décision
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader className="mb-4">
                    <DialogTitle className="flex items-center gap-3 text-success text-base font-semibold">
                        <Megaphone className="w-4 h-4" />
                        Acter la décision
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Conclusion de la guilde</Label>
                        <Textarea
                            placeholder="Ex: Suite aux votes, nous lançons l'extension du coffre dès demain !"
                            value={outcomeText}
                            onChange={(e) => setOutcomeText(e.target.value)}
                            className="bg-surface border-border min-h-[140px] rounded-md p-3 text-sm resize-none"
                        />
                    </div>

                    <div className="p-4 rounded-md bg-[#5865F2]/5 border border-[#5865F2]/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#5865F2]/20 p-2 rounded-md">
                                <Megaphone className="w-4 h-4 text-[#5865F2]" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">Annonce Discord</p>
                                <p className="text-xs text-muted-foreground">Notifier tous les membres instantanément</p>
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
                        <div className="flex items-start gap-3 p-3 rounded-md bg-warning/5 border border-warning/10">
                            <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                            <p className="text-xs text-warning leading-relaxed">
                                Le salon Discord pour les sondages n&apos;est pas configuré. L&apos;annonce ne sera pas envoyée.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            onClick={() => onConfirm(undefined, notifyDiscord)}
                            disabled={isPending}
                            className="h-9 rounded-md border-border text-muted-foreground hover:text-foreground text-xs font-medium"
                        >
                            Fermer sans texte
                        </Button>
                        <Button
                            onClick={() => onConfirm(outcomeText, notifyDiscord)}
                            disabled={isPending || !outcomeText.trim()}
                            className="h-9 gap-2 rounded-md bg-success hover:bg-success/85 text-success-foreground text-xs font-semibold"
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
    // Onglet de la section « Propositions et résultats » : les résultats par défaut, la
    // participation (qui n'a pas voté) sur demande.
    const [activeTab, setActiveTab] = useState<"results" | "absent">("results");
    const router = useRouter();

    const cat = CATEGORY_CONFIG[poll.category];
    const CatIcon = cat.icon;
    const isActive = poll.status === "ACTIVE";
    // Fin de vote : une seule règle de formatage (date + heure + écart), valable aussi clôturé.
    const pollEnd = formatPollEnd(poll.expiresAt);
    const isCreator = currentProfileId === poll.creatorId;
    const canManage = isAdmin || isCreator;
    // La liste des non-votants n'est publiée que pour un sondage **non anonyme** (`getPoll`) :
    // sans elle, pas d'onglet — sinon il révélerait les votants par complément.
    const hasParticipationTab = !poll.isAnonymous && Array.isArray(poll.nonVoters);
    // Mon propre vote sort de la liste **instantanément**, sans attendre le refresh serveur.
    const nonVoters = useMemo(
        () => (poll.nonVoters ?? []).filter(
            (member) => !(votedOptionIds.length > 0 && member.id === currentProfileId)
        ),
        [poll.nonVoters, votedOptionIds, currentProfileId]
    );
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
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Retour + actions de gestion */}
            <div className="flex items-center justify-between gap-4 flex-wrap px-2">
                <Link
                    href={`/dashboard/${guildId}/sondages`}
                    className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
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
                                    className="h-8 gap-2 text-xs font-medium text-muted-foreground hover:text-info hover:bg-info/5"
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
                            className="h-8 gap-2 text-xs font-medium text-muted-foreground hover:text-danger hover:bg-danger/5"
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
                <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
                    <div className="p-6 md:p-8 space-y-8">
                        {/* Status + Category Row */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-caption font-medium uppercase tracking-wide",
                                cat.color,
                                "bg-surface border-border"
                            )}>
                                <CatIcon className="w-3.5 h-3.5" />
                                {cat.label}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                {/* « Sondage programmé » : publié automatiquement par le module
                                    staff, jamais à la main — le lecteur doit le savoir. */}
                                {poll.isScheduled && (
                                    <span className={POLL_SCHEDULED_TAG}>
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        {SCHEDULED_POLL_TAG}
                                    </span>
                                )}
                                {/* Réglages du vote : DITS, jamais cachés derrière une infobulle
                                    (retour user du 13/10/2026 : « indique choix multiple »). */}
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-caption font-bold uppercase tracking-wider",
                                    poll.allowMultipleVotes
                                        ? "bg-info/10 border-info/30 text-info"
                                        : "bg-surface border-border text-muted-foreground"
                                )}>
                                    <Users className="w-3.5 h-3.5" />
                                    {poll.allowMultipleVotes ? "Choix multiple" : "Choix unique"}
                                </span>
                                {poll.isAnonymous && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                        <Lock className="w-3.5 h-3.5" />
                                        Votes anonymes
                                    </span>
                                )}
                                <div className={cn(
                                    "px-3 py-1.5 rounded-md text-caption font-medium uppercase tracking-wide",
                                    isActive ? "bg-success/10 border border-success/20 text-success" :
                                        poll.status === "CLOSED" ? "bg-warning/10 border border-warning/20 text-warning" :
                                            "bg-danger/10 border border-danger/20 text-danger"
                                )}>
                                    {isActive ? "En direct" : poll.status === "CLOSED" ? "Archivé / Terminé" : "Consultation Annulée"}
                                </div>
                            </div>
                        </div>

                        {/* Title & Description */}
                        <div className="space-y-4">
                            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight max-w-2xl">
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
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-surface text-foreground border border-border hover:border-border-strong transition-colors w-fit"
                                >
                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                    Source externe
                                    <span className="text-muted-foreground font-normal truncate max-w-[200px]">
                                        {(() => { try { return new URL(poll.externalUrl).hostname; } catch { return poll.externalUrl; } })()}
                                    </span>
                                </a>
                            )}
                        </div>

                        {/* Chiffres clés */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-border">
                            <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Initiateur</p>
                                <p className="text-sm text-foreground font-medium flex items-center gap-2">
                                    <Crown className="w-3.5 h-3.5 text-warning" />
                                    {poll.creatorName}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Date</p>
                                <p className="text-sm text-foreground font-medium flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                    {new Date(poll.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Participation</p>
                                <p className="text-sm text-foreground font-medium flex items-center gap-2">
                                    <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                                    {hasParticipationTab
                                        ? `${poll.voterCount ?? 0} / ${poll.memberCount ?? 0} membres`
                                        : `${localTotalVotes} vote${localTotalVotes !== 1 ? "s" : ""}`}
                                </p>
                            </div>
                            {/* Fin de vote : TOUJOURS affichée (date + heure), y compris clôturée —
                                avant, le bloc disparaissait dès la clôture et n'affichait que l'heure. */}
                            {pollEnd && (
                                <div className="space-y-1">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                                        Fin de vote
                                    </p>
                                    <p className="text-sm text-foreground font-medium flex items-center gap-2 flex-wrap">
                                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                        {pollEnd.absolute}
                                        <span className="text-xs text-muted-foreground">
                                            ({pollEnd.relative})
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Décision actée */}
            {poll.outcome && (
                <div className="bg-success/5 border border-success/10 rounded-lg p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-3">
                        <Crown className="w-4 h-4 text-success shrink-0" />
                        <div>
                            <h4 className="text-success text-[11px] uppercase tracking-wide">Décision officielle</h4>
                            <p className="text-muted-foreground text-xs">Sondage clôturé avec décision</p>
                        </div>
                    </div>
                    <p className="text-foreground text-base md:text-lg leading-relaxed max-w-3xl">
                        {poll.outcome}
                    </p>
                </div>
            )}

            {/* Propositions et résultats, ou participation */}
            <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between gap-4 flex-wrap px-2">
                    <h2 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Propositions et résultats</h2>
                    {isActive && (
                        <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-info" />
                            <span className="text-caption font-medium text-info">Votes ouverts</span>
                        </span>
                    )}
                </div>

                {/* Bascule résultats / non-votants : la seconde liste est le COMPLÉMENT de la première
                    et n'existe que si le serveur la publie (jamais sur un sondage anonyme). */}
                {hasParticipationTab && (
                    <div className={POLL_SEGMENT_GROUP} role="group" aria-label="Participation au sondage">
                        <button
                            type="button"
                            aria-pressed={activeTab === "results"}
                            onClick={() => setActiveTab("results")}
                            className={cn(POLL_SEGMENT_ITEM, activeTab === "results" ? POLL_SEGMENT_ITEM_ACTIVE : POLL_SEGMENT_ITEM_IDLE)}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Résultats ({localOptions.length})
                        </button>
                        <button
                            type="button"
                            aria-pressed={activeTab === "absent"}
                            onClick={() => setActiveTab("absent")}
                            className={cn(POLL_SEGMENT_ITEM, activeTab === "absent" ? POLL_SEGMENT_ITEM_ACTIVE : POLL_SEGMENT_ITEM_IDLE)}
                        >
                            <UserX className="w-3.5 h-3.5" />
                            {"N'ont pas voté"} ({nonVoters.length})
                        </button>
                    </div>
                )}

                {activeTab === "absent" && hasParticipationTab ? (
                    <div className="space-y-2">
                        <p className="px-2 text-xs text-muted-foreground">
                            {nonVoters.length === 0
                                ? "Tout le monde a voté."
                                : `${nonVoters.length} membre${nonVoters.length > 1 ? "s" : ""} sur ${poll.memberCount ?? nonVoters.length} n'ont pas encore voté.`}
                        </p>
                        {nonVoters.length > 0 && (
                            <div className="max-h-[28rem] overflow-y-auto space-y-2 pr-1 premium-scrollbar">
                                {nonVoters.map((member) => (
                                    <PollMemberRow key={member.id} name={member.name} image={member.image} />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
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
                )}
            </div>

            {/* Fin de consultation (gestion) */}
            {canManage && isActive && (
                <div className="pt-8 border-t border-border">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-surface/40 p-6 rounded-lg border border-border">
                        <div className="space-y-1 text-center sm:text-left">
                            <h3 className="text-foreground font-semibold text-base">Fin de consultation ?</h3>
                            <p className="text-muted-foreground text-xs max-w-xs">
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
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-danger text-base font-semibold">
                            <AlertTriangle className="w-4 h-4" />
                            Suppression définitive
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Vous êtes sur le point de supprimer <span className="text-foreground font-bold">&quot;{poll.title}&quot;</span>.
                            Cette action effacera également les votes et l&apos;embed Discord associé.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="h-9 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground">
                                Annuler
                            </Button>
                            <Button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="h-9 rounded-md border border-danger/20 bg-danger/10 text-xs font-medium text-danger hover:bg-danger/20"
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
