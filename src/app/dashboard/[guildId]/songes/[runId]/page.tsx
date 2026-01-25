"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDreamRunById, updateCurrentFloor, getMemberProfiles } from "@/server/actions/songes/dream-run-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { RunDetailHeader } from "@/components/songes/RunDetailHeader";
import { RunStatsPanel } from "@/components/songes/RunStatsPanel";
import { BonusInventory } from "@/components/songes/BonusInventory";
import { JoinRequestsPanel } from "@/components/songes/JoinRequestsPanel";
import { RunTree } from "@/components/songes/RunTree";
import type { DreamRun, DreamRunMember, DreamWaitlist, DreamFloor, DreamRunBonus, DreamJoinRequest } from "@prisma/client";

type RunWithRelations = DreamRun & {
    members: DreamRunMember[];
    waitlist: DreamWaitlist[];
    floors: DreamFloor[];
    bonuses: DreamRunBonus[];
    joinRequests?: DreamJoinRequest[];
};


export default function RunDetailPage() {
    const params = useParams();
    const router = useRouter();
    const guildId = params.guildId as string;
    const runId = params.runId as string;

    const [run, setRun] = useState<RunWithRelations | null>(null);
    const [profiles, setProfiles] = useState<any[]>([]); // Store profiles
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        const [runResult, userContext] = await Promise.all([
            getDreamRunById(runId),
            getUserContext(),
        ]);

        if (runResult.success && runResult.run) {
            setRun(runResult.run);
            setOptimisticStatus(runResult.run.status);

            // Fetch profiles for names
            const userIds = runResult.run.members.map((m: any) => m.userId);
            if (userIds.length > 0) {
                const profilesResult = await getMemberProfiles(userIds);
                if (profilesResult.success) {
                    setProfiles(profilesResult.profiles || []);
                }
            }

        } else {
            setError(runResult.error || "Run non trouvée");
        }

        if (userContext.isAuthenticated && userContext.id) {
            setCurrentUserId(userContext.id);
        }

        setLoading(false);
    }, [runId]);

    // Initial load only - no polling to reduce server load
    // Data refreshes after user actions (floor select, etc.)
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Sync optimistic status when real run data updates
    useEffect(() => {
        if (run) {
            setOptimisticStatus(run.status);
        }
    }, [run]);

    // Helper to get name
    const getLeaderName = () => {
        if (!run) return "Inconnu";
        const profile = profiles.find(p => p.userId === run.leaderId);
        // Prioritize Discord Nickname as requested by user
        return profile?.discordNickname || profile?.pseudoDofus || "Meneur";
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-purple-400 animate-pulse text-xl">🌙 Chargement de la run...</div>
            </div>
        );
    }

    if (error || !run) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-red-400">{error || "Run non trouvée"}</div>
            </div>
        );
    }

    const isLeader = currentUserId === run.leaderId;

    // Find leader name for display
    const leaderMember = run.members.find(m => m.userId === run.leaderId);
    // Best effort name resolution: Dofus Pseudo > Discord Nick > "Inconnu"
    // Note: We might need to fetch profiles properly if not populated, but members usually have some info. 
    // Wait, run.members here mimics the relation. 
    // In RunCard we fetched profiles separately. Let's see if we have names here.
    // The type RunWithRelations has members. DreamRunMember has userId. 
    // We probably need to fetch the profile name or use what we have. 
    // For now let's pass a placeholder or look if we can get it from context/props if already loaded.
    // Actually RunDetailHeader doesn't show leader name. 
    // Let's rely on a helper or just fetch it. 
    // Since names are needed, let's just pass "Leader" or fetch it.
    // Better: Helper function or lookup.
    // Let's check getDreamRunById return type. It returns "members".

    // Quick fix: User wanted "Pseudo du lead". I don't have the profile loaded here yet unless I fetch it.
    // However, I can use a simple async fetch or just pass "Leader" if I can't find it easily without refactor.
    // Wait, RunCard loads profiles. Here I don't have profiles loaded in state.
    // I should add profile loading or just pass the ID for now? No, UI needs text.
    // I'll grab the user name from the session if it matches, otherwise "Leader".
    // Actually, let's just use "Meneur" if we can't get the name easily, OR fetch it.
    // I will fetch profiles like in RunCard to be clean.

    return (
        <div className="space-y-6">
            <RunDetailHeader
                run={run}
                guildId={guildId}
                isLeader={isLeader}
                optimisticStatus={optimisticStatus || run.status}
                onStatusChange={setOptimisticStatus}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <RunTree
                        currentFloor={run.currentFloor}
                        runId={run.id}
                        isLeader={isLeader}
                        runStatus={optimisticStatus || run.status}
                        leaderName={getLeaderName()}
                        onStatusChange={setOptimisticStatus}
                        onUpdate={loadData}
                    />
                </div>

                {/* Side Panel */}
                <div className="space-y-4">
                    {/* Join Requests Panel - Only for leader, both RECRUITING and IN_PROGRESS */}
                    {isLeader && (run.status === "RECRUITING" || run.status === "IN_PROGRESS") && (
                        <JoinRequestsPanel runId={run.id} isLeader={isLeader} />
                    )}

                    {/* Stats */}
                    <RunStatsPanel run={run} currentUserId={currentUserId ?? undefined} isLeader={isLeader} />

                    {/* Bonus Inventory */}
                    <BonusInventory bonuses={run.bonuses} runId={run.id} isLeader={isLeader} onUpdate={loadData} />
                </div>
            </div>
        </div>
    );
}
