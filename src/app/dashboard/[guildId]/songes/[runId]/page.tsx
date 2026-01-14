"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDreamRunById, updateCurrentFloor } from "@/server/actions/songes/dream-run-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { RunDetailHeader } from "@/components/songes/RunDetailHeader";
import { RunStatsPanel } from "@/components/songes/RunStatsPanel";
import { BonusInventory } from "@/components/songes/BonusInventory";
import { JoinRequestsPanel } from "@/components/songes/JoinRequestsPanel";
import { DreamMap2D } from "@/components/songes/DreamMap2D";
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
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const loadData = useCallback(async () => {
        const [runResult, userContext] = await Promise.all([
            getDreamRunById(runId),
            getUserContext(),
        ]);

        if (runResult.success && runResult.run) {
            setRun(runResult.run);
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

    // Handler pour le leader qui sélectionne un étage
    const handleFloorSelect = async (floorNumber: number) => {
        const result = await updateCurrentFloor(runId, floorNumber);
        if (result.success) {
            // Reload data to reflect the change
            loadData();
            router.refresh();
        }
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
    const isMember = run.members.some(m => m.userId === currentUserId);

    return (
        <div className="space-y-6">
            {/* Header - with isLeader for close button */}
            <RunDetailHeader run={run} guildId={guildId} isLeader={isLeader} />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2D Map Viewer */}
                <div className="lg:col-span-2">
                    <DreamMap2D
                        currentFloor={run.currentFloor}
                        isLeader={isLeader && run.status === "IN_PROGRESS"}
                        onFloorSelect={handleFloorSelect}
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
                    <BonusInventory bonuses={run.bonuses} runId={run.id} />
                </div>
            </div>
        </div>
    );
}
