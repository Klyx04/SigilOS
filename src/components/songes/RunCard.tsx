"use client";
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { 
    Users, 
    Loader2, 
    Crown, 
    Trash2, 
    UserPlus, 
    Clock, 
    LogOut, 
    Bell, 
    Check, 
    X, 
    ShieldCheck, 
    Sparkles, 
    TrendingUp,
    MessageSquare,
    CalendarCheck,
    Pencil,
    AlertTriangle,
    Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
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
    deleteDreamRun,
    getMemberProfiles,
    getMyJoinRequestStatus,
    cancelJoinRequest,
    leaveDreamRun,
    respondToJoinRequest
} from "@/server/actions/songes/dream-run-actions";
import { 
    DIFFICULTIES, 
    OBJECTIVES, 
    DOFUS_CLASSES, 
    type DifficultyKey, 
    type ObjectiveKey, 
    type DofusClass, 
    getEpreuve 
} from "@/lib/songes/types";
import { ClassIcon } from "@/components/shared/class-icon";
import { getClass } from "@/lib/dofus-assets";
import { RunCloseModal } from "@/components/songes/RunCloseModal";
import { RunProgressModal } from "@/components/songes/RunProgressModal";
import { RunLeaderActions } from "@/components/songes/RunLeaderActions";
import { RunEditModal } from "@/components/songes/RunEditModal";
import type { DreamRun, DreamRunMember, DreamWaitlist } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DiscordAvatarImage } from "@/components/shared/discord-avatar-image";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type RunWithRelations = DreamRun & {
    members: DreamRunMember[];
    waitlist: DreamWaitlist[];
    joinRequests?: { id: string; userId: string; message: string | null; classe: string; status?: string }[];
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
    isDiscordConfigured?: boolean;
}

export function RunCard({ run, currentUserId, canJoinSonges = true, isAdmin = false, isDiscordConfigured = false }: RunCardProps) {
    const params = useParams();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(false);
    const [joinDialogOpen, setJoinDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [closeModalOpen, setCloseModalOpen] = useState(false);
    const [progressModalOpen, setProgressModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedClasse, setSelectedClasse] = useState<DofusClass>("Cra");
    const [message, setMessage] = useState("");
    const [profiles, setProfiles] = useState<MemberProfile[]>([]);
    const [pendingRequest, setPendingRequest] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    // #179 — copier les pseudos des participants (format /w Pseudo)
    const [copiedPseudos, setCopiedPseudos] = useState(false);

    const difficulty = DIFFICULTIES[run.difficulty as DifficultyKey];
    const objective = OBJECTIVES[run.objective as ObjectiveKey];
    const isLeader = currentUserId === run.leaderId;
    const isMember = run.members.some((m) => m.userId === currentUserId);
    const epreuve = getEpreuve((run as any).epreuveCode);

    const progress = (run.currentFloor / 26) * 100;
    // #25 — heure sur la carte : départ programmé si défini, sinon date de création
    const runTimeLabel = run.scheduledAt
        ? `Départ · ${format(new Date(run.scheduledAt), "d MMM · HH:mm", { locale: fr })}`
        : `Créée · ${format(new Date(run.createdAt), "d MMM · HH:mm", { locale: fr })}`;
    const canApplyConditions = !isMember && !isLeader && run.members.length < 4 && !pendingRequest;
    const canApply = canApplyConditions && canJoinSonges;

    // Helper: get a member's class from their ACCEPTED join request
    const getMemberClass = (userId: string): string | null => {
        const req = run.joinRequests?.find(r => r.userId === userId && (r as any).status === 'ACCEPTED');
        return req?.classe || null;
    };

    useEffect(() => {
        async function loadData() {
            const candidateIds = run.joinRequests?.map(r => r.userId) || [];
            const allUserIds = [...new Set([run.leaderId, ...run.members.map((m) => m.userId), ...candidateIds])];
            if (allUserIds.length > 0) {
                const result = await getMemberProfiles(params.guildId as string, allUserIds);
                if (result.success && result.profiles) {
                    setProfiles(result.profiles as MemberProfile[]);
                }
            }
            if (!isMember && currentUserId && !isLeader) {
                const requestStatus = await getMyJoinRequestStatus(params.guildId as string, run.id);
                setPendingRequest(requestStatus.success && requestStatus.status === "PENDING");
            }
        }
        loadData();
    }, [run.members, run.id, currentUserId, isMember, isLeader, run.joinRequests, params.guildId]);


    const getDisplayName = (userId: string): string => {
        const profile = profiles.find((p) => p.userId === userId);
        return profile?.pseudoDofus || profile?.discordNickname || "Joueur";
    };

    // #179 — copier les pseudos (leader + membres) au format /w Pseudo
    const handleCopyPseudos = () => {
        const names = [getDisplayName(run.leaderId), ...run.members.map((m) => getDisplayName(m.userId))];
        const text = names.map((n) => `/w ${n}`).join("\n");
        if (!text.trim()) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedPseudos(true);
            toast.success("Pseudos copiés !", { description: "Colle-les dans Discord pour chuchoter à tous." });
            setTimeout(() => setCopiedPseudos(false), 2000);
        }).catch(() => toast.error("Impossible de copier"));
    };

    const handleSendJoinRequest = async () => {
        setLoading(true);
        const result = await sendJoinRequest(params.guildId as string, { 
            runId: run.id, 
            classe: selectedClasse, 
            message: message || undefined,
            linkedStuffId: null,
            linkedStuffName: null,
            linkedStuffThumbnail: null,
            linkedStuffUrl: null
        });
        if (result.success) {
            toast.success("Candidature envoyée !");
            setJoinDialogOpen(false);
            setPendingRequest(true);
            router.refresh();
        } else {
            toast.error(result.error);
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

    const handleRespondCandidacy = async (requestId: string, accept: boolean) => {
        setActionLoading(requestId);
        const result = await respondToJoinRequest(params.guildId as string, { requestId, accept });
        if (result.success) {
            toast.success(accept ? "Candidat accepté !" : "Candidature refusée");
            router.refresh();
        } else {
            toast.error(result.error);
        }
        setActionLoading(null);
    }

    return (
        <div className="group relative overflow-hidden rounded-2xl bg-surface/90 border border-border p-6 transition-colors duration-200 hover:border-border-strong shadow-sm">
            
            {/* --- HEADER --- */}
            <div className="relative z-10 flex justify-between items-start gap-4 mb-6">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="relative w-12 h-12 shrink-0 bg-elevated rounded-xl border border-border p-2 flex items-center justify-center overflow-hidden shadow-xs">
                        <Image
                            src={`/assets/missions/${
                                run.difficulty?.toLowerCase()
                                    .replace('_iv', '4')
                                    .replace('_iii', '3')
                                    .replace('_ii', '2')
                                    .replace('_i', '1') || 'reve1'
                            }.png`}
                            alt="Portal"
                            width={32}
                            height={32}
                            className="object-contain"
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="text-xl font-black uppercase tracking-tight text-foreground leading-none truncate">{difficulty?.label || run.difficulty}</h3>
                            <div className="px-2 py-0.5 rounded-md bg-elevated border border-border">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{objective?.label}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <Users className="w-3.5 h-3.5" /> {run.members.length}/4
                            <span className="opacity-40">•</span>
                            <span className="flex items-center gap-1.5">
                                Leader <span className="text-foreground font-bold">{getDisplayName(run.leaderId)}</span><span className="opacity-40">•</span><span className="flex items-center gap-1" title={run.scheduledAt ? "Départ programmé" : "Création de la run"}><Clock className="w-3.5 h-3.5" />{runTimeLabel}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {(isLeader || isAdmin) && (
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-lg" title="Supprimer la run">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-background border-border text-foreground max-w-sm rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-red-500 text-lg font-black uppercase">
                                        <Trash2 className="w-5 h-5" /> Supprimer la run
                                    </DialogTitle>
                                    <DialogDescription className="sr-only">
                                        Confirmation de suppression définitive de la run
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-1 space-y-4">
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-caption text-red-600 dark:text-red-200/80 font-medium leading-relaxed">
                                            Cette action est <span className="font-black text-red-700 dark:text-red-300">irréversible</span>.
                                            La run <span className="font-bold text-foreground">{DIFFICULTIES[run.difficulty as DifficultyKey]?.label || run.difficulty}</span>
                                            {run.members.length > 0 ? ` (${run.members.length} membre${run.members.length > 1 ? "s" : ""})` : ""}
                                            , ses candidatures et son annonce Discord seront définitivement supprimés.
                                        </p>
                                    </div>
                                    <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest">
                                        {run.members.length > 0
                                            ? "Les participants perdront leur place."
                                            : "Aucun participant n'est inscrit."}
                                    </p>
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <Button variant="outline" className="flex-1 rounded-xl h-10 border-border bg-surface hover:bg-surface text-foreground" onClick={() => setDeleteDialogOpen(false)}>
                                        Annuler
                                    </Button>
                                    <Button variant="destructive" className="flex-1 font-black uppercase text-caption rounded-xl h-10 bg-red-600 hover:bg-red-500 text-foreground" onClick={handleDelete} disabled={loading}>
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                                        Supprimer
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* --- ÉPREUVE BOX --- */}
            {epreuve && (
                <div className="relative z-10 p-4 rounded-2xl border border-border bg-elevated/70 mb-5">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xl">{epreuve.icon}</span>
                        <span className="text-caption font-black uppercase tracking-widest" style={{ color: epreuve.color }}>{epreuve.label}</span>
                    </div>
                    <p className="text-caption text-muted-foreground leading-relaxed">{epreuve.description}</p>
                </div>
            )}

            {/* --- PROGRESSION --- */}
            <div className="relative z-10 mb-6">
                <div className="flex justify-between items-end mb-3">
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Étage Actuel</span>
                        <div className="flex items-baseline gap-2">
                           <span className="text-4xl font-black text-foreground">{run.currentFloor}</span>
                           <span className="text-sm font-bold text-muted-foreground/60 uppercase">/ 26</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end flex-1 ml-8">
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden p-0.5 border border-border">
                            <div 
                                className="h-full rounded-full bg-emerald-500/80 transition-all duration-200"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MEMBERS --- */}
            <div className="relative z-10 space-y-3 mb-6">
                <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Membres</span>
                    {/* #179 — copier les pseudos des participants */}
                    {run.members.length > 0 && (
                        <button
                            type="button"
                            onClick={handleCopyPseudos}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-elevated text-caption font-bold text-muted-foreground hover:text-foreground hover:bg-elevated/70 transition-colors"
                            title="Copier les pseudos des participants (format /w Pseudo)"
                        >
                            {copiedPseudos ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedPseudos ? "Copié" : "Pseudos"}
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((slot) => {
                        const member = run.members.find((m) => m.slot === slot);
                        const pseudo = member ? getDisplayName(member.userId) : "Libre";
                        const profile = profiles.find(p => p.userId === member?.userId);
                        const memberClassId = member ? getMemberClass(member.userId) : null;
                        const memberClassData = memberClassId ? getClass(memberClassId) : null;
                        
                        return (
                            <div key={slot} className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-[1rem] border transition-all truncate",
                                member ? "bg-elevated border-border shadow-xs" : "bg-muted/30 border-border border-dashed"
                            )}>
                                <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-surface border border-border overflow-hidden">
                                    {member ? (
                                        <Avatar className="w-full h-full">
                                            <DiscordAvatarImage src={profile?.avatar || undefined} />
                                            <AvatarFallback className="text-caption font-black">
                                                {profile?.pseudoDofus?.charAt(0) || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : <UserPlus className="w-3.5 h-3.5 text-muted-foreground/60" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                        <span className={cn(
                                            "text-xs font-black truncate",
                                            member ? "text-foreground" : "text-muted-foreground/60"
                                        )}>
                                            {pseudo}
                                        </span>
                                        {member && pseudo !== "Libre" && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`/w ${pseudo}`);
                                                    toast.success(`/w ${pseudo} copié !`);
                                                }}
                                                className="p-0.5 text-muted-foreground/50 hover:text-foreground rounded hover:bg-white/5 transition-colors shrink-0"
                                                title={`Copier /w ${pseudo}`}
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    {member?.joinedAt && (
                                        <span className="text-[10px] text-foreground/30 font-medium block truncate" title={new Date(member.joinedAt).toLocaleString("fr-FR")}>
                                            {format(new Date(member.joinedAt), "d MMM à HH:mm", { locale: fr })}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                    {memberClassData && (
                                        <div
                                            className="w-5 h-5 rounded flex items-center justify-center"
                                            title={memberClassData.name}
                                            style={{ backgroundColor: `${memberClassData.color}20` }}
                                        >
                                            <Image
                                                src={memberClassData.icon}
                                                alt={memberClassData.name}
                                                width={14}
                                                height={14}
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                    )}
                                    {member?.userId === run.leaderId && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- CANDIDACIES SECTION --- */}
            {isLeader && run.joinRequests && run.joinRequests.filter(r => r.status !== 'ACCEPTED').length > 0 && (
                <div className="relative z-10 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 mb-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell className="w-3.5 h-3.5 text-amber-500" />
                        <p className="text-caption font-black uppercase tracking-widest text-amber-500/70">Candidatures</p>
                    </div>

                    <div className="space-y-3">
                        {run.joinRequests.filter(r => r.status !== 'ACCEPTED').map((c) => {
                            const profile = profiles.find(p => p.userId === c.userId);
                            const name = profile?.pseudoDofus || profile?.discordNickname || "Candidat";
                            return (
                                <div key={c.id} className="p-3 rounded-xl bg-black/40 border border-border flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="w-9 h-9 border border-border rounded-xl">
                                                <DiscordAvatarImage src={profile?.avatar || undefined} />
                                                <AvatarFallback className="bg-elevated text-caption font-bold">{name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-foreground truncate">{name}</p>
                                                <div className="flex items-center gap-1.5 text-caption font-black uppercase tracking-widest text-foreground/30">
                                                    <ClassIcon classId={c.classe as DofusClass} size={12} />
                                                    {c.classe}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <Button 
                                                size="icon" 
                                                className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-400 text-foreground" 
                                                onClick={() => handleRespondCandidacy(c.id, true)} 
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                                            </Button>
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="w-8 h-8 rounded-lg text-foreground/20 hover:text-rose-500 hover:bg-rose-500/10" 
                                                onClick={() => handleRespondCandidacy(c.id, false)} 
                                                disabled={!!actionLoading}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    {c.message && (
                                        <div className="relative p-2.5 rounded-xl bg-surface border-l-2 border-amber-500/50">
                                            <p className="text-caption italic text-foreground/50 leading-relaxed font-medium">“{c.message}”</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- ACTIONS --- */}
            <div className="relative z-10 flex flex-wrap gap-3">
                {isLeader ? (
                    <>
                        <div className="w-full sm:w-auto flex-1">
                             <RunLeaderActions 
                                guildId={params.guildId as string} 
                                runId={run.id} 
                                variant="full" 
                                isDiscordConfigured={isDiscordConfigured}
                             />
                        </div>
                        
                        <Button 
                            variant="secondary" 
                            className="flex-1 h-11 bg-surface hover:bg-surface border-border text-foreground font-black uppercase tracking-widest text-caption rounded-xl"
                            onClick={() => setProgressModalOpen(true)}
                        >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Avancement
                        </Button>
                        <Button 
                            variant="secondary" 
                            className="flex-1 h-11 bg-surface hover:bg-surface border-border text-foreground font-black uppercase tracking-widest text-caption rounded-xl"
                            onClick={() => setEditModalOpen(true)}
                        >
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier
                        </Button>
                        <Button 
                            className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-warning-foreground font-black uppercase tracking-widest text-caption rounded-xl transition-colors"
                            onClick={() => setCloseModalOpen(true)}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Clôturer
                        </Button>
                    </>
                ) : isMember ? (
                    <Button 
                        variant="ghost" 
                        className="flex-1 h-11 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 font-black uppercase tracking-widest text-caption rounded-xl"
                        onClick={handleLeave}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Quitter
                    </Button>
                ) : pendingRequest ? (
                    <div className="flex-1 flex gap-2">
                        <div className="flex-1 h-11 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black uppercase tracking-widest text-caption">
                            <Clock className="w-4 h-4 mr-2" />
                            En attente
                        </div>
                        <Button 
                            variant="ghost" 
                            className="h-11 w-11 rounded-xl border border-border text-foreground/20 hover:text-rose-500"
                            onClick={handleCancelRequest}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                ) : canApply ? (
                    <Button 
                        className="flex-1 h-11 bg-surface hover:bg-elevated text-foreground font-black uppercase tracking-widest text-caption rounded-xl border border-border transition-colors"
                        onClick={() => setJoinDialogOpen(true)}
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Postuler
                    </Button>
                ) : (
                    <div className="flex-1 h-11 flex items-center justify-center rounded-xl bg-surface text-foreground/20 text-caption font-black uppercase tracking-widest border border-border">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Équipe complète
                    </div>
                )}
            </div>

            {/* --- MODALS --- */}
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogContent className="bg-background border-border text-foreground max-w-sm rounded-[2rem] p-0 overflow-hidden shadow-2xl">
                    <div className="p-8">
                        <DialogHeader className="mb-8">
                            <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter">
                                <UserPlus className="w-6 h-6 text-muted-foreground" /> Postuler
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Classe Dofus</Label>
                                <Select value={selectedClasse} onValueChange={(v) => setSelectedClasse(v as DofusClass)}>
                                    <SelectTrigger className="bg-surface border-border h-12 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-border">
                                        {DOFUS_CLASSES.map((classe) => (
                                            <SelectItem key={classe} value={classe} className="focus:bg-surface">
                                                <div className="flex items-center gap-3">
                                                    <ClassIcon classId={classe} size={20} />
                                                    <span className="text-sm font-black">{classe}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-caption font-black uppercase tracking-widest text-foreground/30">Note de motivation</Label>
                                <Textarea
                                    placeholder="Dis-nous pourquoi on doit te prendre..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    maxLength={100}
                                    className="bg-surface border-border min-h-[100px] text-sm resize-none rounded-xl p-4"
                                />
                            </div>
                            
                            <Button onClick={handleSendJoinRequest} disabled={loading} className="w-full bg-surface hover:bg-elevated text-foreground border border-border font-black uppercase tracking-[0.2em] h-14 rounded-xl shadow-xl">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Envoyer ma candidature"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <RunEditModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                guildId={params.guildId as string}
                run={run}
            />

            <RunProgressModal
                isOpen={progressModalOpen}
                onClose={() => setProgressModalOpen(false)}
                guildId={params.guildId as string}
                runId={run.id}
                currentFloor={run.currentFloor}
                onUpdate={() => router.refresh()}
            />

            <RunCloseModal
                isOpen={closeModalOpen}
                runId={run.id}
                guildId={params.guildId as string}
                difficulty={run.difficulty}
                memberUserIds={run.members.filter(m => m.userId !== run.leaderId).map(m => m.userId)}
                onClose={() => setCloseModalOpen(false)}
                onClosed={() => { setCloseModalOpen(false); router.refresh(); }}
            />
        </div>
    );
}
