"use client";
// Songes — surfaces et actions sur les TOKENS du thème (accent unique : info) ; contrat : src/lib/songes/ui.ts

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
        <div className="rounded-lg bg-background border border-info/40 p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">📊 Statistiques</h3>

            {/* Progress */}
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-info">Progression globale</span>
                    <span className="text-warning">{Math.round(progress)}%</span>
                </div>
                <div className="h-3 bg-info/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-info transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Current Palier */}
            <div className="p-3 rounded-lg bg-info/10 border border-info/40 mb-4">
                <div className="text-sm text-info">Palier actuel</div>
                <div className="text-lg font-bold" style={{ color: currentPalier.couleur }}>
                    {currentPalier.nom}
                </div>
                <div className="text-sm text-info">
                    Étages {currentPalier.etages[0]} - {currentPalier.etages[currentPalier.etages.length - 1]}
                </div>
            </div>

            {/* Team with Dofus Pseudos */}
            <div className="mb-4">
                <h4 className="text-sm font-medium text-info mb-2">Équipe</h4>
                <div className="space-y-2">
                    {run.members.map((member) => {
                        const displayName = getDisplayName(member.userId);
                        const classe = getClasse(member.userId);
                        const isCurrentUser = member.userId === currentUserId;
                        const memberIsLeader = member.userId === run.leaderId;

                        return (
                            <div
                                key={member.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-info/10 border border-info/40"
                            >
                                <div className="w-8 h-8 rounded-full bg-info/15 flex items-center justify-center">
                                    {memberIsLeader ? (
                                        <Crown className="w-4 h-4 text-warning" />
                                    ) : (
                                        <User className="w-4 h-4 text-info" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-foreground truncate">{displayName}</div>
                                    <div className="text-xs text-info">
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
                                            <span className="text-caption font-bold text-info group-hover:text-info truncate max-w-[120px]">
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
                                                    className="h-7 w-7 text-info hover:text-info hover:bg-info/10"
                                                >
                                                    <div className="relative">
                                                        <User className="w-3 h-3" />
                                                        <div className="absolute -bottom-1 -right-1 bg-info/15 rounded-full w-2 h-2 border border-border" />
                                                    </div>
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="bg-background border-border text-foreground">
                                                <DialogHeader>
                                                    <DialogTitle>🛡️ Modifier mon Stuff</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label>Choisir un stuff de ma galerie</Label>
                                                        <Select value={selectedStuffId} onValueChange={setSelectedStuffId}>
                                                            <SelectTrigger className="bg-surface border-border">
                                                                <SelectValue placeholder="Choisir un stuff..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-background border-border">
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
                                                            className="w-full bg-info/10 border border-info/40 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none"
                                                        />
                                                    </div>
                                                    <Button onClick={handleUpdateStuff} disabled={loadingAction === "updateStuff"} className="w-full bg-info/15 hover:bg-info/15">
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
                                                className="h-7 w-7 text-danger hover:text-danger hover:bg-danger/10"
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
                                                className="h-7 w-7 text-warning hover:text-warning hover:bg-warning/10"
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
                            className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-info/40 text-info"
                        >
                            <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center text-info">
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
