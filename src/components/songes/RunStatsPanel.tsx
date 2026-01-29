"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, User, LogOut, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PALIERS, getPalierFromFloor } from "@/lib/songes/types";
import { getMemberProfiles, kickMember, leaveDreamRun } from "@/server/actions/songes/dream-run-actions";
import type { DreamRun, DreamRunMember } from "@prisma/client";

type RunWithMembers = DreamRun & {
    members: DreamRunMember[];
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
    }, [run.members]);

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

    return (
        <div className="rounded-xl bg-gradient-to-b from-[#1a0933] to-[#0d0520] border border-purple-500/30 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">📊 Statistiques</h3>

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
                                    <div className="text-sm text-white truncate">{displayName}</div>
                                    <div className="text-xs text-purple-300/70">
                                        {classe && <span className="mr-2">{classe}</span>}
                                        {memberIsLeader ? "👑 Leader" : "Membre"}
                                    </div>
                                </div>

                                {/* Actions */}
                                {!memberIsLeader && (
                                    <>
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
                                    </>
                                )}
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
