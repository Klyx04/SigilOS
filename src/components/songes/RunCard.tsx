"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Users, Play, Eye, Loader2, Crown, Trash2, UserPlus, Clock, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    leaveDreamRun
} from "@/server/actions/songes/dream-run-actions";
import { DIFFICULTIES, OBJECTIVES, DOFUS_CLASSES, type DifficultyKey, type ObjectiveKey, type DofusClass } from "@/lib/songes/types";
import type { DreamRun, DreamRunMember, DreamWaitlist } from "@prisma/client";

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
}

interface RunCardProps {
    run: RunWithRelations;
    currentUserId?: string;
}

export function RunCard({ run, currentUserId }: RunCardProps) {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [joinDialogOpen, setJoinDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedClasse, setSelectedClasse] = useState<DofusClass>("Cra");
    const [message, setMessage] = useState("");
    const [profiles, setProfiles] = useState<MemberProfile[]>([]);
    const [pendingRequest, setPendingRequest] = useState(false);

    const difficulty = DIFFICULTIES[run.difficulty as DifficultyKey];
    const objective = OBJECTIVES[run.objective as ObjectiveKey];
    const progress = (run.currentFloor / 26) * 100;
    const isLeader = currentUserId === run.leaderId;
    const isMember = run.members.some((m) => m.userId === currentUserId);
    const canApply = (run.status === "RECRUITING" || run.status === "IN_PROGRESS") &&
        !isMember && !isLeader && run.members.length < 4 && !pendingRequest;

    // Load member profiles with Dofus pseudos
    useEffect(() => {
        async function loadData() {
            const userIds = run.members.map((m) => m.userId);
            if (userIds.length > 0) {
                const result = await getMemberProfiles(userIds);
                if (result.success && result.profiles) {
                    setProfiles(result.profiles as MemberProfile[]);
                }
            }
            // Check if current user has pending request
            // If user is now a member, reset pending state
            if (isMember) {
                setPendingRequest(false);
            } else if (currentUserId && !isLeader) {
                const requestStatus = await getMyJoinRequestStatus(run.id);
                if (requestStatus.success && requestStatus.status === "PENDING") {
                    setPendingRequest(true);
                } else {
                    setPendingRequest(false);
                }
            }
        }
        loadData();
    }, [run.members, run.id, currentUserId, isMember, isLeader]);

    const getDisplayName = (userId: string): string => {
        const profile = profiles.find((p) => p.userId === userId);
        if (profile?.pseudoDofus) return profile.pseudoDofus;
        if (profile?.discordNickname) return profile.discordNickname;
        return "Joueur";
    };

    const handleSendJoinRequest = async () => {
        setLoading(true);
        await sendJoinRequest({ runId: run.id, classe: selectedClasse, message: message || undefined });
        setJoinDialogOpen(false);
        setPendingRequest(true);
        router.refresh();
        setLoading(false);
    };

    const handleCancelRequest = async () => {
        setLoading(true);
        await cancelJoinRequest(run.id);
        setPendingRequest(false);
        router.refresh();
        setLoading(false);
    };

    const handleStart = async () => {
        setLoading(true);
        await startDreamRun(run.id);
        router.refresh();
        setLoading(false);
    };

    const handleDelete = async () => {
        setLoading(true);
        await deleteDreamRun(run.id);
        setDeleteDialogOpen(false);
        router.refresh();
        setLoading(false);
    };

    const handleLeave = async () => {
        setLoading(true);
        await leaveDreamRun(run.id);
        router.refresh();
        setLoading(false);
    };

    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1a0933] to-[#0d0520] border border-purple-500/30 p-4 hover:border-purple-400/50 transition-all">
            {/* Glow effect based on difficulty */}
            <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
                style={{ backgroundColor: difficulty?.couleur }}
            />

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
                </div>

                <div className="flex items-center gap-2">
                    {/* Delete Button (leader only) */}
                    {isLeader && (
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/30">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-[#1a0933] border-red-500/30 text-white">
                                <DialogHeader>
                                    <DialogTitle>Supprimer la Run ?</DialogTitle>
                                </DialogHeader>
                                <p className="text-purple-200 text-sm">Cette action est irréversible. Tous les membres seront retirés.</p>
                                <div className="flex gap-2 justify-end mt-4">
                                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
                                    <Button onClick={handleDelete} disabled={loading} className="bg-red-600 hover:bg-red-500">
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Supprimer"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
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

                    {/* Candidature Badge (leader only) */}
                    {isLeader && run.joinRequests && run.joinRequests.length > 0 && (
                        <div className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                            <Bell className="w-3 h-3" />
                            {run.joinRequests.length} candidature{run.joinRequests.length > 1 ? "s" : ""}
                        </div>
                    )}
                </div>
            </div>

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
                                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${member
                                        ? "bg-purple-600/50 border-purple-400 text-white"
                                        : "bg-purple-900/30 border-purple-700/50 border-dashed"
                                        }`}
                                    title={member ? displayName : "Libre"}
                                >
                                    {member ? (
                                        memberIsLeader ? (
                                            <Crown className="w-4 h-4 text-amber-400" />
                                        ) : (
                                            <span className="text-xs font-semibold">{firstLetter}</span>
                                        )
                                    ) : null}
                                </div>
                                {member && (
                                    <span className="text-[10px] text-purple-300/80 truncate max-w-[50px]" title={displayName}>
                                        {shortName}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                {/* Pending Request - Click to cancel */}
                {pendingRequest ? (
                    <Button
                        size="sm"
                        onClick={handleCancelRequest}
                        disabled={loading}
                        className="flex-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4 mr-1" />}
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
                        <DialogContent className="bg-[#1a0933] border-purple-500/30 text-white">
                            <DialogHeader>
                                <DialogTitle>Candidature Run Songes</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-purple-200">Classe</Label>
                                    <Select value={selectedClasse} onValueChange={(v) => setSelectedClasse(v as DofusClass)}>
                                        <SelectTrigger className="bg-purple-900/30 border-purple-500/30">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1a0933] border-purple-500/30">
                                            {DOFUS_CLASSES.map((classe) => (
                                                <SelectItem key={classe} value={classe} className="text-white focus:bg-purple-700/50">
                                                    {classe}
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
                                        className="bg-purple-900/30 border-purple-500/30 text-white"
                                    />
                                </div>
                                <Button onClick={handleSendJoinRequest} disabled={loading} className="w-full bg-green-600 hover:bg-green-500">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer ma candidature"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                ) : null}

                {/* Start Button (leader only, recruiting status) */}
                {run.status === "RECRUITING" && isLeader && (
                    <Button
                        size="sm"
                        onClick={handleStart}
                        disabled={loading}
                        className="flex-1 bg-purple-600 hover:bg-purple-500"
                    >
                        <Play className="w-4 h-4 mr-1" />
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
                        disabled={loading}
                        className="bg-orange-600/80 hover:bg-orange-500 text-white"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 mr-1" />}
                        Quitter
                    </Button>
                )}
            </div>
        </div>
    );
}
