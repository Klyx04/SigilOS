"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, User, LogOut, UserMinus, Loader2, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PALIERS, getPalierFromFloor } from "@/lib/songes/types";
import { getMemberProfiles, kickMember, leaveDreamRun } from "@/server/actions/songes/dream-run-actions";
import type { DreamRun, DreamRunMember } from "@prisma/client";

type RunWithMembers = DreamRun & {
    members: (DreamRunMember & {
        linkedStuffId?: string | null;
        linkedStuffName?: string | null;
        linkedStuffThumbnail?: string | null;
        linkedStuffUrl?: string | null;
    })[];
};

interface MemberProfile {
    userId: string;
    pseudoDofus: string | null;
    classe: string | null;
    discordNickname: string | null;
}

interface RunStatsPanelProps {
    guildId: string;
    run: RunWithMembers;
    currentUserId?: string;
    isLeader?: boolean;
}

export function RunStatsPanel({ guildId, run, currentUserId, isLeader = false }: RunStatsPanelProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [profiles, setProfiles] = useState<MemberProfile[]>([]);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [stuffs, setStuffs] = useState<any[]>([]);
    const [isStuffDialogOpen, setIsStuffDialogOpen] = useState(false);
    const [selectedStuffId, setSelectedStuffId] = useState<string>("none");
    const [customStuffName, setCustomStuffName] = useState("");

    const currentPalier = getPalierFromFloor(run.currentFloor || 1);
    const progress = (run.currentFloor / 26) * 100;
    const isMember = run.members.some((m) => m.userId === currentUserId);

    // Load member profiles with Dofus pseudos
    useEffect(() => {
        async function loadProfiles() {
            const userIds = run.members.map((m) => m.userId);
            if (userIds.length > 0) {
                const result = await getMemberProfiles(guildId, userIds);
                if (result.success && result.profiles) {
                    setProfiles(result.profiles as MemberProfile[]);
                }
            }
        }
        loadProfiles();

        async function loadStuffs() {
            if (isMember) {
                const [res, userCtx] = await Promise.all([
                    import("@/server/actions/gallery-actions").then(m => m.getStuffGalleryPage(guildId)),
                    import("@/server/actions/user-actions").then(m => m.getUserContext(guildId))
                ]);
                if (res.success && res.data && userCtx.profileId) {
                    setStuffs(res.data.builds.filter((s: any) => s.author.id === userCtx.profileId));
                }
            }
        }
        loadStuffs();
    }, [run.members, isMember, guildId]);

    const getDisplayName = (userId: string) => {
        const profile = profiles.find((p) => p.userId === userId);
        if (profile?.pseudoDofus) return profile.pseudoDofus;
        if (profile?.discordNickname) return profile.discordNickname;
        return "Joueur";
    };

    const getClasse = (userId: string) => {
        const profile = profiles.find((p) => p.userId === userId);
        return profile?.classe || null;
    };

    const handleKick = (targetUserId: string) => {
        setLoadingAction(targetUserId);
        startTransition(async () => {
            await kickMember(guildId, run.id, targetUserId);
            router.refresh();
            setLoadingAction(null);
        });
    };

    const handleLeave = async () => {
        setLoadingAction("leave");
        await leaveDreamRun(guildId, run.id);
        // Redirect to songes list after leaving
        router.push(`/dashboard/${guildId}/songes`);
    };

    const handleUpdateStuff = async () => {
        setLoadingAction("updateStuff");
        const selectedStuff = stuffs.find(s => s.id === selectedStuffId);
        const { updateMemberStuff } = await import("@/server/actions/songes/dream-run-actions");
        
        await updateMemberStuff(guildId, {
            runId: run.id,
            linkedStuffId: selectedStuffId === "none" ? null : selectedStuffId,
            linkedStuffName: customStuffName || selectedStuff?.name || null,
            linkedStuffThumbnail: selectedStuff?.previewData?.thumbnail || null,
            linkedStuffUrl: selectedStuff?.url || null
        });
        
        setIsStuffDialogOpen(false);
        router.refresh();
        setLoadingAction(null);
    };

    return (
        <div className="rounded-xl bg-gradient-to-b from-[#1a0933] to-[#0d0520] border border-purple-500/30 p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">📊 Statistiques</h3>

            {/* Progress */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-purple-200">Progression globale</span>
                    <span className="text-amber-400">{Math.round(progress)}%</span>
                </div>
                <div className="h-3 bg-purple-900/50 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-green-500 via-purple-500 to-amber-500 transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Current Palier */}
            <div className="p-3 rounded-lg bg-purple-900/30 border border-purple-500/20 mb-4">
                <div className="text-sm text-purple-300">Palier actuel</div>
                <div className="text-lg font-bold" style={{ color: currentPalier.couleur }}>
                    {currentPalier.nom}
                </div>
                <div className="text-sm text-purple-300/70">
                    Étages {currentPalier.etages[0]} - {currentPalier.etages[currentPalier.etages.length - 1]}
                </div>
            </div>

            {/* Team with Dofus Pseudos */}
            <div className="mb-4">
                <h4 className="text-sm font-medium text-purple-200 mb-2">Équipe</h4>
                <div className="space-y-2">
                    {run.members.map((member) => {
                        const displayName = getDisplayName(member.userId);
                        const classe = getClasse(member.userId);
                        const isCurrentUser = member.userId === currentUserId;
                        const memberIsLeader = member.userId === run.leaderId;

                        return (
                            <div
                                key={member.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-purple-900/20 border border-purple-500/20"
                            >
                                <div className="w-8 h-8 rounded-full bg-purple-600/50 flex items-center justify-center">
                                    {memberIsLeader ? (
                                        <Crown className="w-4 h-4 text-amber-400" />
                                    ) : (
                                        <User className="w-4 h-4 text-purple-300" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-foreground truncate">{displayName}</div>
                                    <div className="text-xs text-purple-300/70">
                                        {classe && <span className="mr-2">{classe}</span>}
                                        {memberIsLeader ? "👑 Leader" : "Membre"}
                                    </div>
                                    {/* Linked Stuff Display */}
                                    {member.linkedStuffId && (
                                        <a 
                                            href={member.linkedStuffUrl || "#"} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="mt-1.5 flex items-center gap-1.5 p-1 rounded bg-surface border border-border hover:bg-surface transition-colors w-fit group"
                                        >
                                            {member.linkedStuffThumbnail && (
                                                <img src={member.linkedStuffThumbnail} className="w-5 h-5 rounded object-cover border border-border" alt="" />
                                            )}
                                            <span className="text-caption font-bold text-indigo-300 group-hover:text-indigo-200 truncate max-w-[120px]">
                                                {member.linkedStuffName || "Voir le stuff"}
                                            </span>
                                        </a>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                    {/* Update stuff button (if it's the current user) */}
                                    {isCurrentUser && (
                                        <Dialog open={isStuffDialogOpen} onOpenChange={setIsStuffDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/30"
                                                >
                                                    <div className="relative">
                                                        <User className="w-3 h-3" />
                                                        <div className="absolute -bottom-1 -right-1 bg-indigo-500 rounded-full w-2 h-2 border border-[#0d0520]" />
                                                    </div>
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="bg-[#1a0933] border-purple-500/30 text-foreground">
                                                <DialogHeader>
                                                    <DialogTitle>🛡️ Modifier mon Stuff</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label>Choisir un stuff de ma galerie</Label>
                                                        <Select value={selectedStuffId} onValueChange={setSelectedStuffId}>
                                                            <SelectTrigger className="bg-purple-900/30 border-purple-500/30">
                                                                <SelectValue placeholder="Choisir un stuff..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-[#1a0933] border-purple-500/30">
                                                                <SelectItem value="none" className="text-muted-foreground italic">Aucun stuff</SelectItem>
                                                                {stuffs.map((stuff) => (
                                                                    <SelectItem key={stuff.id} value={stuff.id} className="text-foreground">
                                                                        <div className="flex items-center gap-2">
                                                                            {stuff.previewData?.thumbnail && (
                                                                                <img src={stuff.previewData.thumbnail} className="w-5 h-5 rounded object-cover" alt="" />
                                                                            )}
                                                                            <span>{stuff.name}</span>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Nom personnalisé (optionnel)</Label>
                                                        <input
                                                            type="text"
                                                            placeholder="Ex: Stuff Terre/Feu"
                                                            value={customStuffName}
                                                            onChange={(e) => setCustomStuffName(e.target.value)}
                                                            className="w-full bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none"
                                                        />
                                                    </div>
                                                    <Button onClick={handleUpdateStuff} disabled={loadingAction === "updateStuff"} className="w-full bg-indigo-600 hover:bg-indigo-500">
                                                        {loadingAction === "updateStuff" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mettre à jour mon stuff"}
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                        {/* Kick button (leader only) */}
                                        {isLeader && !isCurrentUser && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                                onClick={() => handleKick(member.userId)}
                                                disabled={loadingAction === member.userId}
                                            >
                                                {loadingAction === member.userId ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <UserMinus className="w-3 h-3" />
                                                )}
                                            </Button>
                                        )}

                                        {/* Leave button (for current user, if not leader) */}
                                        {isCurrentUser && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-orange-400 hover:text-orange-300 hover:bg-orange-900/30"
                                                onClick={handleLeave}
                                                disabled={loadingAction === "leave"}
                                            >
                                                {loadingAction === "leave" ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <LogOut className="w-3 h-3" />
                                                )}
                                            </Button>
                                        )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Empty slots (not clickable) */}
                    {[...Array(4 - run.members.length)].map((_, i) => (
                        <div
                            key={`empty-${i}`}
                            className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-purple-700/50 text-purple-500/50"
                        >
                            <div className="w-8 h-8 rounded-full bg-purple-900/20 flex items-center justify-center text-purple-600">
                                +
                            </div>
                            <div className="text-sm">Slot libre</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Points de Rêve (Removed per request) */}
        </div>
    );
}
