"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDreamRunById, updateCurrentFloor, getMemberProfiles } from "@/server/actions/songes/dream-run-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Moon, BookOpen } from "lucide-react";
import { BossGuide } from "@/components/songes/BossGuide";
import { RunDetailHeader } from "@/components/songes/RunDetailHeader";
import { RunStatsPanel } from "@/components/songes/RunStatsPanel";
import { BonusInventory } from "@/components/songes/BonusInventory";
import { JoinRequestsPanel } from "@/components/songes/JoinRequestsPanel";
import { RunTree } from "@/components/songes/RunTree";
import { RunLeaderActions } from "@/components/songes/RunLeaderActions";
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
    const [bossGuideOpen, setBossGuideOpen] = useState(false);

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

    // Check for run existence when window regains focus (detect deleted runs)
    useEffect(() => {
        const handleFocus = () => {
            if (!loading) loadData();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [loadData, loading]);

    // Helper to get name
    const getLeaderName = () => {
        if (!run) return "Inconnu";
        const profile = profiles.find(p => p.userId === run.leaderId);
        // Prioritize Discord Nickname as requested by user
        return profile?.discordNickname || profile?.pseudoDofus || "Meneur";
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    <Moon className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
                </div>
                <div className="text-zinc-500 font-medium animate-pulse">🌙 Synchronisation des Songes...</div>
            </div>
        );
    }

    if (error || !run) {
        return (
            <div className="flex items-center justify-center min-h-[600px] p-6">
                <EmptyState
                    icon={Moon}
                    title="Cette run a disparu"
                    description={error || "Il semblerait que cette run n'existe plus ou qu'elle ait été terminée par son meneur."}
                    variant="premium"
                    action={{
                        label: "Retour aux Songes",
                        onClick: () => router.push(`/dashboard/${guildId}/songes`)
                    }}
                    className="max-w-md w-full"
                />
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
                    {/* Leader Actions */}
                    {isLeader && (run.status === "RECRUITING" || run.status === "IN_PROGRESS") && (
                        <RunLeaderActions guildId={guildId} runId={run.id} />
                    )}

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
            {/* Boss Guide Floating Button */}
            <button
                onClick={() => setBossGuideOpen(true)}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-900/40 hover:shadow-purple-500/30 transition-all active:scale-95 group"
                title="Guide des Boss — Songes Pour Les Noobs"
            >
                <BookOpen className="w-5 h-5 group-hover:rotate-6 transition-transform" />
                <span className="text-sm">Guide Boss</span>
            </button>

            {/* Boss Guide Drawer */}
            <BossGuide isOpen={bossGuideOpen} onClose={() => setBossGuideOpen(false)} />
        </div>
    );
}
