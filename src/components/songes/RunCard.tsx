"use client";
// Songes — surfaces et actions sur les TOKENS du thème (accent unique : info) ; contrat : src/lib/songes/ui.ts

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
    Users,
    Loader2,
    UserPlus,
    Clock,
    LogOut,
    Bell,
    Check,
    X,
    ShieldCheck,
    TrendingUp,
    Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DofusUiIcon } from "@/components/shared/dofus-ui-icon";
import { PseudoChip } from "@/components/shared/pseudo-chip";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
import { SongesPicto } from "./SongesPicto";
import { SONGES_BUTTON } from "@/lib/songes/ui";
import { ClassIcon } from "@/components/shared/class-icon";
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
    guildId?: string;
    onRefresh?: () => void;
}

export function RunCard({ run, currentUserId, canJoinSonges = true, isAdmin = false, isDiscordConfigured = false, guildId: propsGuildId, onRefresh }: RunCardProps) {
    const params = useParams();
    const router = useRouter();
    const guildId = propsGuildId || (params?.guildId as string);
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(false);
    const [joinDialogOpen, setJoinDialogOpen] = useState(false);
    const [closeModalOpen, setCloseModalOpen] = useState(false);
    const [progressModalOpen, setProgressModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedClasse, setSelectedClasse] = useState<DofusClass>("Cra");
    const [message, setMessage] = useState("");
    const [profiles, setProfiles] = useState<MemberProfile[]>([]);
    const [pendingRequest, setPendingRequest] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    // Ma position en file d'attente (promotion automatique au départ d'un membre)
    const myWaitlistEntry = currentUserId ? run.waitlist.find((w) => w.userId === currentUserId) : undefined;

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
                const result = await getMemberProfiles(guildId, allUserIds);
                if (result.success && result.profiles) {
                    setProfiles(result.profiles as MemberProfile[]);
                }
            }
            if (!isMember && currentUserId && !isLeader) {
                const requestStatus = await getMyJoinRequestStatus(guildId, run.id);
                setPendingRequest(requestStatus.success && requestStatus.status === "PENDING");
            }
        }
        loadData();
    }, [run.members, run.id, currentUserId, isMember, isLeader, run.joinRequests, params.guildId]);


    const getDisplayName = (userId: string): string => {
        const profile = profiles.find((p) => p.userId === userId);
        return profile?.pseudoDofus || profile?.discordNickname || "Joueur";
    };

    // #179 — la copie des pseudos est UNITAIRE (`PseudoChip`) : plus de bouton global.

    const handleSendJoinRequest = async () => {
        setLoading(true);
        const result = await sendJoinRequest(guildId, {
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
            onRefresh?.();
        } else {
            toast.error(result.error);
        }
        setLoading(false);
    };

    const handleCancelRequest = () => {
        startTransition(async () => {
            await cancelJoinRequest(guildId, run.id);
            setPendingRequest(false);
            router.refresh();
            onRefresh?.();
        });
    };

    const handleLeave = () => {
        startTransition(async () => {
            await leaveDreamRun(guildId, run.id);
            router.refresh();
            onRefresh?.();
        });
    };

    const handleRespondCandidacy = async (requestId: string, accept: boolean) => {
        setActionLoading(requestId);
        const result = await respondToJoinRequest(guildId, { requestId, accept });
        if (result.success) {
            toast.success(accept ? "Candidat accepté !" : "Candidature refusée");
            router.refresh();
            onRefresh?.();
        } else {
            toast.error(result.error);
        }
        setActionLoading(null);
    }

    return (
        <div className="group relative overflow-hidden rounded-lg bg-surface border border-border p-6 transition-colors duration-200 hover:border-border-strong">

            {/* --- HEADER --- */}
            <div className="relative z-10 flex justify-between items-start gap-4 mb-6">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="relative w-12 h-12 shrink-0 bg-elevated rounded-lg border border-border p-2 flex items-center justify-center overflow-hidden">
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
                            <h3 className="text-xl font-semibold uppercase tracking-tight text-foreground leading-none truncate">{difficulty?.label || run.difficulty}</h3>
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

                {/* Plus d'icône « Supprimer la run » : la suppression détruisait la run (et
                    son annonce Discord) sans bilan. Le geste utile est « Clôturer »
                    (bilan des étages/bonus + fermeture Discord), juste en dessous. */}
            </div>

            {/* --- ÉPREUVE BOX --- */}
            {epreuve && (
                <div className="relative z-10 p-4 rounded-lg border border-border bg-elevated/70 mb-5">
                    <div className="flex items-center gap-2 mb-1.5">
                        <SongesPicto asset={epreuve.asset} size={20} title={epreuve.label} />
                        <span className="text-caption font-semibold uppercase tracking-wider" style={{ color: epreuve.color }}>{epreuve.label}</span>
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
                           <span className="text-4xl font-semibold text-foreground">{run.currentFloor}</span>
                           <span className="text-sm font-bold text-muted-foreground/60 uppercase">/ 26</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end flex-1 ml-8">
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden p-0.5 border border-border">
                            <div
                                className="h-full rounded-full bg-success/80 transition-all duration-200"
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
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((slot) => {
                        const member = run.members.find((m) => m.slot === slot);
                        const pseudo = member ? getDisplayName(member.userId) : "Libre";
                        const profile = profiles.find(p => p.userId === member?.userId);
                        const memberClassId = member ? getMemberClass(member.userId) : null;

                        return (
                            <div key={slot} className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-[1rem] border transition-all truncate",
                                member ? "bg-elevated border-border " : "bg-muted/30 border-border border-dashed"
                            )}>
                                <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-surface border border-border overflow-hidden">
                                    {member ? (
                                        <Avatar className="w-full h-full">
                                            <DiscordAvatarImage src={profile?.avatar || undefined} />
                                            <AvatarFallback className="text-caption font-semibold">
                                                {profile?.pseudoDofus?.charAt(0) || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : <UserPlus className="w-3.5 h-3.5 text-muted-foreground/60" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {member && pseudo !== "Libre" ? (
                                        <PseudoChip
                                            pseudo={pseudo}
                                            classe={memberClassId}
                                            className="text-xs font-semibold text-foreground"
                                        />
                                    ) : (
                                        <span className="text-xs font-semibold text-foreground/30">{pseudo}</span>
                                    )}
                                    {member?.joinedAt && (
                                        <span className="text-[10px] text-foreground/30 font-medium block truncate" title={new Date(member.joinedAt).toLocaleString("fr-FR")}>
                                            {format(new Date(member.joinedAt), "d MMM à HH:mm", { locale: fr })}
                                        </span>
                                    )}
                                </div>
                                {member?.userId === run.leaderId && (
                                    <DofusUiIcon name="leader" size={13} className="shrink-0 opacity-80" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- CANDIDACIES SECTION --- */}
            {isLeader && run.joinRequests && run.joinRequests.filter(r => r.status !== 'ACCEPTED').length > 0 && (
                <div className="relative z-10 p-5 rounded-lg bg-surface border border-border mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell className="w-3.5 h-3.5 text-warning" />
                        <p className="text-caption font-semibold uppercase tracking-wider text-warning/70">Candidatures</p>
                    </div>

                    <div className="space-y-3">
                        {run.joinRequests.filter(r => r.status !== 'ACCEPTED').map((c) => {
                            const profile = profiles.find(p => p.userId === c.userId);
                            const name = profile?.pseudoDofus || profile?.discordNickname || "Candidat";
                            return (
                                <div key={c.id} className="p-3 rounded-lg bg-elevated/60 border border-border flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="w-9 h-9 border border-border rounded-lg">
                                                <DiscordAvatarImage src={profile?.avatar || undefined} />
                                                <AvatarFallback className="bg-elevated text-caption font-bold">{name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <PseudoChip
                                                    pseudo={name}
                                                    classe={c.classe as DofusClass}
                                                    className="text-sm font-semibold text-foreground"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <Button
                                                size="icon"
                                                className="w-8 h-8 rounded-lg bg-success hover:bg-success/80 text-success-foreground"
                                                onClick={() => handleRespondCandidacy(c.id, true)}
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10"
                                                onClick={() => handleRespondCandidacy(c.id, false)}
                                                disabled={!!actionLoading}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    {c.message && (
                                        <div className="relative p-2.5 rounded-lg bg-surface border-l-2 border-warning/40">
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
                                guildId={guildId}
                                runId={run.id}
                                variant="full"
                                isDiscordConfigured={isDiscordConfigured}
                             />
                        </div>

                        <Button
                            variant="secondary"
                            className={cn(SONGES_BUTTON.secondary, "flex-1 h-11 uppercase tracking-wider text-caption rounded-lg font-semibold")}
                            onClick={() => setProgressModalOpen(true)}
                        >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Avancement
                        </Button>
                        <Button
                            variant="secondary"
                            className={cn(SONGES_BUTTON.secondary, "flex-1 h-11 uppercase tracking-wider text-caption rounded-lg font-semibold")}
                            onClick={() => setEditModalOpen(true)}
                        >
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier
                        </Button>
                        <Button
                            className={cn(SONGES_BUTTON.close, "flex-1 h-11 uppercase tracking-wider text-caption rounded-lg")}
                            onClick={() => setCloseModalOpen(true)}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Clôturer
                        </Button>
                    </>
                ) : isMember ? (
                    <Button
                        variant="ghost"
                        className={cn(SONGES_BUTTON.danger, "flex-1 h-11 uppercase tracking-wider text-caption rounded-lg")}
                        onClick={handleLeave}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Quitter
                    </Button>
                ) : pendingRequest ? (
                    <div className="flex-1 flex gap-2">
                        <div className="flex-1 h-11 flex items-center justify-center rounded-lg bg-elevated text-warning border border-warning/30 font-semibold uppercase tracking-wider text-caption">
                            <Clock className="w-4 h-4 mr-2" />
                            En attente
                        </div>
                        <Button
                            variant="ghost"
                            className={cn(SONGES_BUTTON.ghost, "h-11 w-11 rounded-lg border border-border hover:text-danger")}
                            onClick={handleCancelRequest}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                ) : myWaitlistEntry ? (
                    // File d'attente Songes : la promotion est AUTOMATIQUE (dès qu'un membre
                    // part ou est éjecté), mais la carte ne le disait nulle part — le joueur
                    // lisait « Équipe complète » sans savoir qu'il attendait une place.
                    <div className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg bg-elevated text-warning border border-warning/30 font-semibold uppercase tracking-wider text-caption">
                        <Clock className="w-4 h-4" />
                        File d&apos;attente — position {myWaitlistEntry.position}
                    </div>
                ) : canApply ? (
                    <Button
                        className={cn(SONGES_BUTTON.secondary, "flex-1 h-11 uppercase tracking-wider text-caption rounded-lg")}
                        onClick={() => setJoinDialogOpen(true)}
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Postuler
                    </Button>
                ) : (
                    <div className="flex-1 h-11 flex items-center justify-center rounded-lg bg-surface text-muted-foreground text-caption font-semibold uppercase tracking-wider border border-border">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Équipe complète
                    </div>
                )}
            </div>

            {/* --- MODALS --- */}
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogContent className="bg-background border-border text-foreground max-w-sm rounded-lg p-0 overflow-hidden">
                    <div className="p-8">
                        <DialogHeader className="mb-8">
                            <DialogTitle className="flex items-center gap-3 text-2xl font-semibold uppercase tracking-tight">
                                <UserPlus className="w-6 h-6 text-muted-foreground" /> Postuler
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">Classe Dofus</Label>
                                <Select value={selectedClasse} onValueChange={(v) => setSelectedClasse(v as DofusClass)}>
                                    <SelectTrigger className="bg-surface border-border h-12 rounded-lg">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-border">
                                        {DOFUS_CLASSES.map((classe) => (
                                            <SelectItem key={classe} value={classe} className="focus:bg-surface">
                                                <div className="flex items-center gap-3">
                                                    <ClassIcon classId={classe} size={20} />
                                                    <span className="text-sm font-semibold">{classe}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-caption font-semibold uppercase tracking-wider text-foreground/30">Note de motivation</Label>
                                <Textarea
                                    placeholder="Dis-nous pourquoi on doit te prendre..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    maxLength={100}
                                    className="bg-surface border-border min-h-[100px] text-sm resize-none rounded-lg p-4"
                                />
                            </div>

                            <Button onClick={handleSendJoinRequest} disabled={loading} className="w-full bg-surface hover:bg-elevated text-foreground border border-border font-semibold uppercase tracking-wider h-14 rounded-lg">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Envoyer ma candidature"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Classe ACTUELLE du meneur (demande ACCEPTED, la source qu'affiche l'embed) :
                sans elle, le sélecteur repartirait sur la classe principale et l'édition
                changerait silencieusement la classe de la run. */}
            <RunEditModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                initialLeaderClass={
                    run.joinRequests?.find(r => r.userId === run.leaderId && r.status === "ACCEPTED")?.classe ?? null
                }

                guildId={guildId}
                run={run}
                onUpdated={() => { router.refresh(); onRefresh?.(); }}
            />

            <RunProgressModal
                isOpen={progressModalOpen}
                onClose={() => setProgressModalOpen(false)}
                guildId={guildId}
                runId={run.id}
                currentFloor={run.currentFloor}
                onUpdate={() => { router.refresh(); onRefresh?.(); }}
            />

            <RunCloseModal
                isOpen={closeModalOpen}
                runId={run.id}
                guildId={guildId}
                difficulty={run.difficulty}
                epreuveLabel={epreuve?.label ?? null}
                memberUserIds={run.members.filter(m => m.userId !== run.leaderId).map(m => m.userId)}
                onClose={() => setCloseModalOpen(false)}
                onClosed={() => { setCloseModalOpen(false); router.refresh(); onRefresh?.(); }}
            />
        </div>
    );
}
