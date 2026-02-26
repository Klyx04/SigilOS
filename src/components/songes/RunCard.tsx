"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Users, Play, Eye, Loader2, Crown, Trash2, UserPlus, Clock, LogOut, Bell, Check, X, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    sendJoinRequest,
    startDreamRun,
    deleteDreamRun,
    getMemberProfiles,
    getMyJoinRequestStatus,
    cancelJoinRequest,
    leaveDreamRun,
    getPendingJoinRequests,
    respondToJoinRequest
} from "@/server/actions/songes/dream-run-actions";
import { DIFFICULTIES, OBJECTIVES, DOFUS_CLASSES, type DifficultyKey, type ObjectiveKey, type DofusClass, getEpreuve } from "@/lib/songes/types";
import { ClassIcon } from "@/components/shared/class-icon";
import { RunLeaderActions } from "@/components/songes/RunLeaderActions";
import type { DreamRun, DreamRunMember, DreamWaitlist } from "@prisma/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type RunWithRelations = DreamRun & {
    members: DreamRunMember[];
    waitlist: DreamWaitlist[];
    joinRequests?: { id: string; userId: string }[];
    _count: { floors: number; bonuses: number };
};

interface MemberProfile {
    userId: string;
    pseudoDofus: string | null;
    classe: string | null;
    discordNickname: string | null;
    isAdmin?: boolean;
    avatar?: string | null;
}

interface RunCardProps {
    run: RunWithRelations;
    currentUserId?: string;
    canJoinSonges?: boolean;
    isAdmin?: boolean;
}

export function RunCard({ run, currentUserId, canJoinSonges = true, isAdmin = false }: RunCardProps) {
    const params = useParams();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(false); // Keep for dialog submit buttons
    const [joinDialogOpen, setJoinDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [candidacyDialogOpen, setCandidacyDialogOpen] = useState(false);
    const [selectedClasse, setSelectedClasse] = useState<DofusClass>("Cra");
    const [message, setMessage] = useState("");
    const [profiles, setProfiles] = useState<MemberProfile[]>([]);
    const [pendingRequest, setPendingRequest] = useState(false);

    // Candidacy panel state (for leaders)
    const [candidacyExpanded, setCandidacyExpanded] = useState(false);
    const [candidacies, setCandidacies] = useState<{
        id: string;
        userId: string;
        classe: string;
        message: string | null;
        displayName: string;
        avatar: string | null;
    }[]>([]);
    const [candidacyLoading, setCandidacyLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const difficulty = DIFFICULTIES[run.difficulty as DifficultyKey];
    const objective = OBJECTIVES[run.objective as ObjectiveKey];
    const progress = (run.currentFloor / 26) * 100;
    const isLeader = currentUserId === run.leaderId;
    const isMember = run.members.some((m) => m.userId === currentUserId);
    const epreuve = getEpreuve((run as any).epreuveCode);

    // Check if user can apply (includes permission check)
    const canApplyConditions = (run.status === "RECRUITING" || run.status === "IN_PROGRESS") &&
        !isMember && !isLeader && run.members.length < 4 && !pendingRequest;
    const canApply = canApplyConditions && canJoinSonges;

    // Load member profiles (including leader)
    useEffect(() => {
        async function loadData() {
            // Include leader ID in the profile fetch
            const allUserIds = [...new Set([run.leaderId, ...run.members.map((m) => m.userId)])];
            if (allUserIds.length > 0) {
                const result = await getMemberProfiles(params.guildId as string, allUserIds);
                if (result.success && result.profiles) {
                    setProfiles(result.profiles as MemberProfile[]);
                }
            }
            // Check initial pending status
            if (isMember) {
                setPendingRequest(false);
            } else if (currentUserId && !isLeader) {
                const requestStatus = await getMyJoinRequestStatus(params.guildId as string, run.id);
                setPendingRequest(requestStatus.success && requestStatus.status === "PENDING");
            }
        }
        loadData();
    }, [run.members, run.id, currentUserId, isMember, isLeader]);

    // POLL STATUS (Auto-Refresh for expiry/accept/reject)
    useEffect(() => {
        if (!pendingRequest) return;

        const interval = setInterval(async () => {
            const result = await getMyJoinRequestStatus(params.guildId as string, run.id);
            if (result.success && result.status !== "PENDING") {
                setPendingRequest(false);
                router.refresh();

                if (result.status === "REJECTED") {
                    toast.error("Candidature expirée ou refusée.");
                } else if (result.status === "ACCEPTED") {
                    toast.success("Candidature acceptée !");
                }
            }
        }, 5000); // Check every 5s

        return () => clearInterval(interval);
    }, [pendingRequest, run.id, router]);

    const getDisplayName = (userId: string): string => {
        const profile = profiles.find((p) => p.userId === userId);
        if (profile?.pseudoDofus) return profile.pseudoDofus;
        if (profile?.discordNickname) return profile.discordNickname;
        return "Joueur";
    };

    // Get leader's display name
    const leaderDisplayName = getDisplayName(run.leaderId);

    const handleSendJoinRequest = async () => {
        setLoading(true);
        const result = await sendJoinRequest(params.guildId as string, { runId: run.id, classe: selectedClasse, message: message || undefined });
        if (result.success) {
            toast.success("Candidature envoyée avec succès !");
            setJoinDialogOpen(false);
            setPendingRequest(true);
            router.refresh();
        } else {
            toast.error(result.error || "Une erreur est survenue");
        }
        setLoading(false);
    };

    const handleCancelRequest = () => {
        startTransition(async () => {
            await cancelJoinRequest(params.guildId as string, run.id);
            setPendingRequest(false);
            router.refresh();
        });
    };

    const handleStart = () => {
        startTransition(async () => {
            await startDreamRun(params.guildId as string, run.id);
            router.refresh();
        });
    };

    const handleDelete = async () => {
        setLoading(true);
        await deleteDreamRun(params.guildId as string, run.id);
        setDeleteDialogOpen(false);
        router.refresh();
        setLoading(false);
    };

    const handleLeave = () => {
        startTransition(async () => {
            await leaveDreamRun(params.guildId as string, run.id);
            router.refresh();
        });
    };

    // Candidacy handlers (leader only)
    const loadCandidacies = async () => {
        setCandidacyLoading(true);
        const result = await getPendingJoinRequests(params.guildId as string, run.id);
        if (result.success && result.requests) {
            setCandidacies(result.requests as typeof candidacies);
        }
        setCandidacyLoading(false);
    };

    const handleToggleCandidacies = () => {
        if (!candidacyExpanded) {
            loadCandidacies();
        }
        setCandidacyExpanded(!candidacyExpanded);
    };

    const handleRespondCandidacy = async (requestId: string, accept: boolean) => {
        setActionLoading(requestId);
        await respondToJoinRequest(params.guildId as string, { requestId, accept });
        await loadCandidacies();
        setActionLoading(null);
        router.refresh();
    };

    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1a0933] to-[#0d0520] border border-purple-500/30 p-4 hover:border-purple-400/50 transition-all">
            {/* Glow effect based on difficulty */}
            <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
                style={{ backgroundColor: difficulty?.couleur }}
            />
            {/* Completed Watermark - Cleaner and more professional */}
            {run.status === "COMPLETED" && (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center z-0 pointer-events-none opacity-20 rotate-[-10deg]">
                    <div className="border-4 border-amber-500/50 text-amber-500 font-black text-4xl uppercase px-4 py-1 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)] bg-black/40 backdrop-blur-sm tracking-widest">
                        Terminée
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="relative flex justify-between items-start mb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: difficulty?.couleur }}
                        />
                        <span className="text-white font-semibold">{difficulty?.label}</span>
                    </div>
                    <div className="text-sm text-purple-300/70 flex items-center gap-1 mt-1">
                        {objective?.icon} {objective?.label}
                    </div>
                    <div className="text-xs text-purple-400/60 mt-1 flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-400/70" />
                        <span className="flex items-center gap-1">
                            Run de <span className="text-white/80 font-medium">{leaderDisplayName}</span>
                            {profiles.find(p => p.userId === run.leaderId)?.isAdmin && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <ShieldCheck className="w-3 h-3 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="bg-zinc-900 border-purple-500/30 text-purple-200 text-[10px] font-bold uppercase tracking-wider">
                                            Administration
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Leader Tools */}
                    {(isLeader || isAdmin) && (
                        <div className="flex items-center gap-1">
                            {/* Reminder Button (Leader only) */}
                            {isLeader && (run.status === "RECRUITING" || run.status === "IN_PROGRESS") && (
                                <RunLeaderActions
                                    guildId={params.guildId as string}
                                    runId={run.id}
                                    variant="minimal"
                                />
                            )}

                            {/* Delete Button (Leader or Admin) */}
                            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/30">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-[#0d0515] border border-red-500/25 text-white max-w-sm w-full rounded-2xl shadow-[0_0_60px_rgba(239,68,68,0.15)] p-0 overflow-hidden">
                                    {/* Header rouge */}
                                    <div className="bg-gradient-to-br from-red-950/80 to-[#0d0515] px-6 pt-6 pb-4 border-b border-red-500/15">
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                                                <Trash2 className="w-5 h-5 text-red-400" />
                                            </div>
                                            <DialogTitle className="text-base font-black text-white tracking-wide">
                                                Supprimer la Run ?
                                            </DialogTitle>
                                        </div>
                                    </div>
                                    {/* Body */}
                                    <div className="px-6 py-5 space-y-5">
                                        <p className="text-sm text-white/50 leading-relaxed">
                                            Cette action est <span className="text-red-400 font-semibold">irréversible</span>. Tous les membres seront retirés et la run sera définitivement supprimée.
                                        </p>
                                        <div className="flex gap-2 justify-end">
                                            <Button
                                                variant="outline"
                                                onClick={() => setDeleteDialogOpen(false)}
                                                className="border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm"
                                            >
                                                Annuler
                                            </Button>
                                            <Button
                                                onClick={handleDelete}
                                                disabled={loading}
                                                className="bg-red-600 hover:bg-red-500 text-white font-bold shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all text-sm"
                                            >
                                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5 mr-1.5" />Supprimer</>}
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}

                    {/* Status Badge */}
                    <div className={`px-2 py-1 rounded text-xs font-medium ${run.status === "RECRUITING"
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : run.status === "COMPLETED"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}>
                        {run.status === "RECRUITING" ? "Recrutement" : run.status === "COMPLETED" ? "Terminée" : "En cours"}
                    </div>

                    {/* Pending Candidacy Badge (for applicant) */}
                    {pendingRequest && (
                        <div className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" />
                            Candidature envoyée
                        </div>
                    )}

                    {/* Candidature Badge (leader only) - Now Clickable Modal */}
                    {isLeader && run.joinRequests && run.joinRequests.length > 0 && (
                        <Dialog open={candidacyDialogOpen} onOpenChange={(open) => {
                            setCandidacyDialogOpen(open);
                            if (open) loadCandidacies();
                        }}>
                            <DialogTrigger asChild>
                                <button className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse hover:bg-amber-500/30 transition-all cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                    <Bell className="w-3 h-3" />
                                    {run.joinRequests.length} candidature{run.joinRequests.length > 1 ? "s" : ""}
                                </button>
                            </DialogTrigger>
                            <DialogContent className="bg-[#1a0933] border-purple-500/30 text-white w-[90vw] max-w-[400px] rounded-xl overflow-hidden p-0">
                                <DialogHeader className="p-4 border-b border-purple-500/20 bg-purple-900/20">
                                    <DialogTitle className="flex items-center gap-2 text-amber-400">
                                        <Users className="w-5 h-5" />
                                        Candidatures en attente
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="p-4 max-h-[60vh] overflow-y-auto">
                                    {candidacyLoading ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-purple-400 gap-2">
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            <span className="text-sm">Chargement des profils...</span>
                                        </div>
                                    ) : candidacies.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Users className="w-12 h-12 text-purple-700 mx-auto mb-2 opacity-20" />
                                            <p className="text-sm text-purple-300/50">Plus aucune candidature à traiter</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {candidacies.map((c) => (
                                                <div key={c.id} className="p-3 rounded-xl bg-purple-900/20 border border-purple-500/20 hover:border-purple-500/40 transition-all group">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="min-w-0 flex-1 flex items-center gap-3">
                                                            <Avatar className="w-10 h-10 border border-purple-500/20">
                                                                <AvatarImage src={c.avatar || undefined} />
                                                                <AvatarFallback className="bg-purple-800 text-purple-200">
                                                                    {c.displayName.charAt(0).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="font-semibold text-white truncate text-sm">{c.displayName || "Joueur"}</span>
                                                                </div>
                                                                <div className="flex items-center text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                                                                    <ClassIcon classId={c.classe as DofusClass} size={14} className="mr-1" />
                                                                    {c.classe}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-2 shrink-0">
                                                            <Button
                                                                size="sm"
                                                                className="h-8 bg-green-600 hover:bg-green-500 text-white"
                                                                onClick={() => handleRespondCandidacy(c.id, true)}
                                                                disabled={actionLoading === c.id}
                                                            >
                                                                {actionLoading === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 bg-black/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20"
                                                                onClick={() => handleRespondCandidacy(c.id, false)}
                                                                disabled={actionLoading === c.id}
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {c.message && (
                                                        <p className="text-xs text-purple-200/70 bg-black/40 p-2 rounded-lg mt-3 italic border-l-2 border-purple-500/40">
                                                            "{c.message}"
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 bg-black/20 text-center border-t border-purple-500/10">
                                    <p className="text-[10px] text-purple-400 uppercase tracking-widest font-bold">SigilOS • Recrutement</p>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Épreuve Banner */}
            {epreuve && (
                <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border mb-3 -mt-1"
                    style={{ borderColor: `${epreuve.color}40`, backgroundColor: `${epreuve.color}10` }}
                >
                    <span className="text-base shrink-0">{epreuve.icon}</span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: epreuve.color }}>
                                {epreuve.label}
                            </span>
                            <span
                                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                                style={{ color: epreuve.color, borderColor: `${epreuve.color}50`, backgroundColor: `${epreuve.color}15` }}
                            >
                                Succès
                            </span>
                        </div>
                        <p className="text-[11px] text-white/35 leading-relaxed mt-0.5 truncate">
                            {epreuve.description}
                        </p>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-purple-200">Progression</span>
                    <span className="text-amber-400 font-medium">Étage {run.currentFloor}/26</span>
                </div>
                <div className="h-2 bg-purple-900/50 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-amber-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Team Slots with Discord Pseudos */}
            <div className="mb-4">
                <div className="flex items-center gap-1 text-sm text-purple-200 mb-2">
                    <Users className="w-4 h-4" />
                    Équipe ({run.members.length}/4)
                </div>

                <div className="flex gap-3">
                    {[1, 2, 3, 4].map((slot) => {
                        const member = run.members.find((m) => m.slot === slot);
                        const memberIsLeader = member?.userId === run.leaderId;
                        const displayName = member ? getDisplayName(member.userId) : "";
                        const shortName = displayName.length > 8 ? displayName.slice(0, 7) + "…" : displayName;
                        const firstLetter = displayName.charAt(0).toUpperCase();

                        return (
                            <div key={slot} className="flex flex-col items-center gap-1 min-w-[50px]">
                                <div
                                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center overflow-hidden transition-all ${member
                                        ? "bg-purple-600/50 border-purple-400 text-white"
                                        : "bg-purple-900/30 border-purple-700/50 border-dashed"
                                        }`}
                                    title={member ? displayName : "Libre"}
                                >
                                    {member ? (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            {/* Discord Avatar or Initials */}
                                            <Avatar className="w-full h-full">
                                                <AvatarImage src={profiles.find(p => p.userId === member.userId)?.avatar || undefined} />
                                                <AvatarFallback className="bg-purple-600/50 text-white text-xs font-bold">
                                                    {memberIsLeader ? (
                                                        <Crown className="w-5 h-5 text-amber-400" />
                                                    ) : (
                                                        firstLetter
                                                    )}
                                                </AvatarFallback>
                                            </Avatar>

                                            {/* Admin Badge */}
                                            {profiles.find(p => p.userId === member.userId)?.isAdmin && (
                                                <div className="absolute -top-0.5 -right-0.5 bg-zinc-900 rounded-full p-0.5 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.3)] z-10">
                                                    <ShieldCheck className="w-2.5 h-2.5 text-purple-400 fill-purple-500/10" />
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                                {member && (
                                    <span className="text-[10px] text-purple-300/80 truncate max-w-[50px] flex items-center gap-0.5 justify-center" title={displayName}>
                                        {shortName}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Candidacy Panel - For Leaders Only */}
            {isLeader && (run.status === "RECRUITING" || run.status === "IN_PROGRESS") && (
                <div className="mt-3 border-t border-purple-500/20 pt-3">
                    <button
                        onClick={handleToggleCandidacies}
                        className="w-full flex items-center justify-between text-sm text-amber-400 hover:text-amber-300 transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Candidatures
                            {run.joinRequests && run.joinRequests.length > 0 && (
                                <span className="bg-amber-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                                    {run.joinRequests.length}
                                </span>
                            )}
                        </span>
                        {candidacyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {candidacyExpanded && (
                        <div className="mt-2 space-y-2">
                            {candidacyLoading ? (
                                <div className="flex items-center justify-center py-3 text-purple-400">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    <span className="text-xs">Chargement...</span>
                                </div>
                            ) : candidacies.length === 0 ? (
                                <p className="text-xs text-purple-300/50 text-center py-2">Aucune candidature</p>
                            ) : (
                                candidacies.map((c) => (
                                    <div key={c.id} className="p-3 rounded-xl bg-black/40 border border-purple-500/30 hover:border-purple-400/50 transition-all shadow-inner">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1 flex items-center gap-3">
                                                <Avatar className="w-10 h-10 border border-purple-500/20">
                                                    <AvatarImage src={c.avatar || undefined} />
                                                    <AvatarFallback className="bg-purple-800 text-purple-200">
                                                        {c.displayName.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="text-sm text-white font-bold truncate leading-tight">{c.displayName || "Joueur"}</p>
                                                    <div className="flex items-center text-[10px] text-purple-400 font-bold uppercase tracking-wider mt-0.5">
                                                        <ClassIcon classId={c.classe as DofusClass} size={14} className="mr-1" />
                                                        {c.classe}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 shrink-0">
                                                <Button
                                                    size="icon"
                                                    className="h-8 w-8 bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
                                                    onClick={() => handleRespondCandidacy(c.id, true)}
                                                    disabled={actionLoading === c.id}
                                                >
                                                    {actionLoading === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 bg-black/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 hover:border-red-600 transition-all"
                                                    onClick={() => handleRespondCandidacy(c.id, false)}
                                                    disabled={actionLoading === c.id}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        {c.message && (
                                            <div className="bg-purple-900/20 border-l-2 border-purple-500/40 p-2 rounded-r-md mt-3">
                                                <p className="text-[11px] text-purple-100/90 italic leading-relaxed">
                                                    "{c.message}"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-1">
                {/* Pending Request - Click to cancel */}
                {pendingRequest ? (
                    <Button
                        size="sm"
                        onClick={handleCancelRequest}
                        disabled={isPending}
                        className="flex-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4 mr-1" />}
                        Annuler candidature
                    </Button>
                ) : canApply ? (
                    <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-500">
                                <UserPlus className="w-4 h-4 mr-1" />
                                Postuler
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#1a0933] border-purple-500/30 text-white w-[90vw] max-w-[425px] rounded-xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
                            <DialogHeader>
                                <DialogTitle>Candidature Run Songes</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-purple-200">Classe</Label>
                                    <Select value={selectedClasse} onValueChange={(v) => setSelectedClasse(v as DofusClass)}>
                                        <SelectTrigger className="bg-purple-900/30 border-purple-500/30 w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1a0933] border-purple-500/30">
                                            {DOFUS_CLASSES.map((classe) => (
                                                <SelectItem key={classe} value={classe} className="text-white focus:bg-purple-700/50 text-left">
                                                    <div className="flex items-center">
                                                        <ClassIcon classId={classe} size={20} className="mr-2" />
                                                        {classe}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-purple-200">Message (optionnel)</Label>
                                    <Textarea
                                        placeholder="Ex: Cra opti dispo 21h"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        maxLength={200}
                                        className="bg-purple-900/30 border-purple-500/30 text-white min-h-[100px] resize-none w-full break-all whitespace-pre-wrap"
                                    />
                                    <div className="text-right text-xs text-purple-300/50">
                                        {message.length}/200
                                    </div>
                                </div>
                                <Button onClick={handleSendJoinRequest} disabled={loading} className="w-full bg-green-600 hover:bg-green-500">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer ma candidature"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                ) : canApplyConditions && !canJoinSonges ? (
                    /* Show message when user lacks permission to join */
                    <div className="flex-1 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center">
                        Permission requise pour postuler
                    </div>
                ) : null}

                {/* Start Button (leader only, recruiting status) */}
                {run.status === "RECRUITING" && isLeader && (
                    <Button
                        size="sm"
                        onClick={handleStart}
                        disabled={isPending}
                        className="flex-1 bg-purple-600 hover:bg-purple-500"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                        Démarrer
                    </Button>
                )}

                <Link href={`/dashboard/${params.guildId}/songes/${run.id}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-900/30">
                        <Eye className="w-4 h-4 mr-1" />
                        Voir
                    </Button>
                </Link>

                {/* Leave Button (member, non-leader) */}
                {isMember && !isLeader && (
                    <Button
                        size="sm"
                        onClick={handleLeave}
                        disabled={isPending}
                        className="bg-orange-600/80 hover:bg-orange-500 text-white"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 mr-1" />}
                        Quitter
                    </Button>
                )}
            </div>
        </div>
    );
}
