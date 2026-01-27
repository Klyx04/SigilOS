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
        if (!guildId) return;

        const [runResult, userContext] = await Promise.all([
            getDreamRunById(guildId, runId),
            getUserContext(guildId),
        ]);

        if (runResult.success && runResult.run) {
            setRun(runResult.run);
            setOptimisticStatus(runResult.run.status);

            // Fetch profiles for names
            const userIds = runResult.run.members.map((m: any) => m.userId);
            if (userIds.length > 0) {
                const profilesResult = await getMemberProfiles(guildId, userIds);
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
    }, [runId, guildId]);

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
                        guildId={guildId}
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
                        <JoinRequestsPanel guildId={guildId} runId={run.id} isLeader={isLeader} />
                    )}

                    {/* Stats */}
                    <RunStatsPanel guildId={guildId} run={run} currentUserId={currentUserId ?? undefined} isLeader={isLeader} />

                    {/* Bonus Inventory */}
                    <BonusInventory guildId={guildId} bonuses={run.bonuses} runId={run.id} isLeader={isLeader} onUpdate={loadData} />
                </div>
            </div>
        </div>
    );
}
