"use client";

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
    CalendarCheck
} from "lucide-react";
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
import type { DreamRun, DreamRunMember, DreamWaitlist } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
    const [selectedClasse, setSelectedClasse] = useState<DofusClass>("Cra");
    const [message, setMessage] = useState("");
    const [profiles, setProfiles] = useState<MemberProfile[]>([]);
    const [pendingRequest, setPendingRequest] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [stuffs, setStuffs] = useState<any[]>([]);
    const [selectedStuffId, setSelectedStuffId] = useState<string>("none");
    const [customStuffName, setCustomStuffName] = useState("");

    const difficulty = DIFFICULTIES[run.difficulty as DifficultyKey];
    const objective = OBJECTIVES[run.objective as ObjectiveKey];
    const isLeader = currentUserId === run.leaderId;
    const isMember = run.members.some((m) => m.userId === currentUserId);
    const epreuve = getEpreuve((run as any).epreuveCode);

    const progress = (run.currentFloor / 26) * 100;
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

    useEffect(() => {
        if (joinDialogOpen && stuffs.length === 0) {
            Promise.all([
                import("@/server/actions/gallery-actions").then(m => m.getStuffGalleryPage(params.guildId as string)),
                import("@/server/actions/user-actions").then(m => m.getUserContext(params.guildId as string))
            ]).then(([res, userCtx]) => {
                if (res.success && res.data && userCtx.profileId) {
                    setStuffs(res.data.builds.filter((s: any) => s.author.id === userCtx.profileId));
                }
            });
        }
    }, [joinDialogOpen, stuffs.length, params.guildId]);

    const getDisplayName = (userId: string): string => {
        const profile = profiles.find((p) => p.userId === userId);
        return profile?.pseudoDofus || profile?.discordNickname || "Joueur";
    };

    const handleSendJoinRequest = async () => {
        setLoading(true);
        const selectedStuff = stuffs.find(s => s.id === selectedStuffId);
        const result = await sendJoinRequest(params.guildId as string, { 
            runId: run.id, 
            classe: selectedClasse, 
            message: message || undefined,
            linkedStuffId: selectedStuffId === "none" ? null : selectedStuffId,
            linkedStuffName: customStuffName || selectedStuff?.name || null,
            linkedStuffThumbnail: selectedStuff?.previewData?.thumbnail || null,
            linkedStuffUrl: selectedStuff?.url || null
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
        <div className="group relative overflow-hidden rounded-3xl bg-[#0d0d12] border border-white/5 p-7 transition-all duration-500 hover:border-white/20 hover:shadow-[0_0_60px_rgba(255,255,255,0.03)]">
            
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] rounded-full pointer-events-none" />

            {/* --- HEADER --- */}
            <div className="relative z-10 flex justify-between items-center gap-4 mb-8">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="relative w-12 h-12 shrink-0 bg-white/5 rounded-xl border border-white/10 p-2 flex items-center justify-center overflow-hidden">
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
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-black uppercase tracking-tight text-white leading-none truncate">{difficulty?.label || run.difficulty}</h3>
                            <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 shadow-sm">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{objective?.label}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                            <Users className="w-3 h-3" /> {run.members.length}/4
                            <span className="opacity-20">•</span>
                            <span className="flex items-center gap-1.5">
                                Leader <span className="text-white/60">{getDisplayName(run.leaderId)}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {(isLeader || isAdmin) && (
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-white/10 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-lg">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-[#0a0514] border-white/10 text-white max-w-sm rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-red-500 text-lg font-black uppercase">
                                        <Trash2 className="w-5 h-5" /> Supprimer ?
                                    </DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-white/50 leading-relaxed py-4 italic">
                                    Confirmer la suppression ?
                                </p>
                                <div className="flex gap-3">
                                    <Button variant="ghost" className="flex-1 rounded-xl h-10" onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
                                    <Button variant="destructive" className="flex-1 font-black uppercase text-[10px] rounded-xl h-10" onClick={handleDelete} disabled={loading}>
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
                <div className="relative z-10 p-4 rounded-2xl border border-white/5 bg-white/5 mb-6 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xl">{epreuve.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: epreuve.color }}>{epreuve.label}</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed">{epreuve.description}</p>
                </div>
            )}

            {/* --- PROGRESSION --- */}
            <div className="relative z-10 mb-8">
                <div className="flex justify-between items-end mb-3">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Étage Actuel</span>
                        <div className="flex items-baseline gap-2">
                           <span className="text-4xl font-black text-white">{run.currentFloor}</span>
                           <span className="text-sm font-bold text-white/10 uppercase">/ 26</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end flex-1 ml-8">
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                            <div 
                                className="h-full rounded-full bg-gradient-to-r from-white/20 via-white/40 to-white/20 bg-[length:200%_auto] animate-[gradient_3s_linear_infinite] shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-1000"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MEMBERS --- */}
            <div className="relative z-10 space-y-3 mb-8">
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
                                member ? "bg-white/5 border-white/10 shadow-lg" : "bg-black/20 border-white/5 border-dashed"
                            )}>
                                <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-zinc-900 border border-white/10 overflow-hidden">
                                    {member ? (
                                        <Avatar className="w-full h-full">
                                            <AvatarImage src={profile?.avatar || undefined} />
                                            <AvatarFallback className="text-[10px] font-black">
                                                {profile?.pseudoDofus?.charAt(0) || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : <UserPlus className="w-3.5 h-3.5 text-white/10" />}
                                </div>
                                <span className={cn(
                                    "text-xs font-black truncate flex-1",
                                    member ? "text-white" : "text-white/10"
                                )}>
                                    {pseudo}
                                </span>
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
            {isLeader && run.joinRequests && run.joinRequests.filter(r => (r as any).status !== 'ACCEPTED').length > 0 && (
                <div className="relative z-10 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 mb-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell className="w-3.5 h-3.5 text-amber-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/70">Candidatures</p>
                    </div>

                    <div className="space-y-3">
                        {run.joinRequests.filter(r => (r as any).status !== 'ACCEPTED').map((c) => {
                            const profile = profiles.find(p => p.userId === c.userId);
                            const name = profile?.pseudoDofus || profile?.discordNickname || "Candidat";
                            return (
                                <div key={c.id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="w-9 h-9 border border-white/10 rounded-xl">
                                                <AvatarImage src={profile?.avatar || undefined} />
                                                <AvatarFallback className="bg-zinc-800 text-[10px] font-bold">{name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-white truncate">{name}</p>
                                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">
                                                    <ClassIcon classId={c.classe as DofusClass} size={12} />
                                                    {c.classe}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <Button 
                                                size="icon" 
                                                className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/20" 
                                                onClick={() => handleRespondCandidacy(c.id, true)} 
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                                            </Button>
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="w-8 h-8 rounded-lg text-white/20 hover:text-rose-500 hover:bg-rose-500/10" 
                                                onClick={() => handleRespondCandidacy(c.id, false)} 
                                                disabled={!!actionLoading}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    {c.message && (
                                        <div className="relative p-2.5 rounded-xl bg-white/5 border-l-2 border-amber-500/50">
                                            <p className="text-[10px] italic text-white/50 leading-relaxed font-medium">“{c.message}”</p>
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
                            className="flex-1 h-11 bg-white/5 hover:bg-white/10 border-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-xl"
                            onClick={() => setProgressModalOpen(true)}
                        >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Avancement
                        </Button>
                        <Button 
                            className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-[10px] shadow-lg rounded-xl transition-all"
                            onClick={() => setCloseModalOpen(true)}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Clôturer
                        </Button>
                    </>
                ) : isMember ? (
                    <Button 
                        variant="ghost" 
                        className="flex-1 h-11 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 font-black uppercase tracking-widest text-[10px] rounded-xl"
                        onClick={handleLeave}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Quitter
                    </Button>
                ) : pendingRequest ? (
                    <div className="flex-1 flex gap-2">
                        <div className="flex-1 h-11 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black uppercase tracking-widest text-[10px] animate-pulse">
                            <Clock className="w-4 h-4 mr-2" />
                            En attente
                        </div>
                        <Button 
                            variant="ghost" 
                            className="h-11 w-11 rounded-xl border border-white/5 text-white/20 hover:text-rose-500"
                            onClick={handleCancelRequest}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                ) : canApply ? (
                    <Button 
                        className="flex-1 h-11 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-xl border border-white/10 shadow-lg transition-all"
                        onClick={() => setJoinDialogOpen(true)}
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Postuler
                    </Button>
                ) : (
                    <div className="flex-1 h-11 flex items-center justify-center rounded-xl bg-white/5 text-white/20 text-[10px] font-black uppercase tracking-widest border border-white/5">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Équipe complète
                    </div>
                )}
            </div>

            {/* --- MODALS --- */}
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogContent className="bg-[#0a0514] border-white/10 text-white max-w-sm rounded-[2rem] p-0 overflow-hidden shadow-2xl">
                    <div className="p-8">
                        <DialogHeader className="mb-8">
                            <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter">
                                <UserPlus className="w-6 h-6 text-white/50" /> Postuler
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Classe Dofus</Label>
                                <Select value={selectedClasse} onValueChange={(v) => setSelectedClasse(v as DofusClass)}>
                                    <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0a0514] border-white/10">
                                        {DOFUS_CLASSES.map((classe) => (
                                            <SelectItem key={classe} value={classe} className="focus:bg-white/5">
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
                                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Note de motivation</Label>
                                <Textarea
                                    placeholder="Dis-nous pourquoi on doit te prendre..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    maxLength={100}
                                    className="bg-white/5 border-white/10 min-h-[100px] text-sm resize-none rounded-xl p-4"
                                />
                            </div>
                            
                            {stuffs.length > 0 && (
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                        Ton Stuff (Optionnel)
                                    </Label>
                                    <Select value={selectedStuffId} onValueChange={setSelectedStuffId}>
                                        <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl text-white">
                                            <SelectValue placeholder="Choisir un stuff" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#0a0514] border-white/10">
                                            <SelectItem value="none" className="text-zinc-500 italic">Aucun stuff</SelectItem>
                                            {stuffs.map((stuff) => (
                                                <SelectItem key={stuff.id} value={stuff.id} className="text-white focus:bg-white/10">
                                                    <div className="flex items-center gap-2">
                                                        {stuff.previewData?.thumbnail && (
                                                            <img src={stuff.previewData.thumbnail} className="w-5 h-5 rounded object-cover border border-white/10" alt="" />
                                                        )}
                                                        <span className="truncate max-w-[200px]">{stuff.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {selectedStuffId !== "none" && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                                            <input
                                                type="text"
                                                placeholder="Nom personnalisé..."
                                                value={customStuffName}
                                                onChange={(e) => setCustomStuffName(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button onClick={handleSendJoinRequest} disabled={loading} className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 font-black uppercase tracking-[0.2em] h-14 rounded-xl shadow-xl">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Envoyer ma candidature"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

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
