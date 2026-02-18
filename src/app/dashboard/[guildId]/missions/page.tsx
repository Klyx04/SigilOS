import { auth } from "@/auth";
import { getWeekMissions } from "@/server/actions/mission-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { MissionBoard } from "@/components/missions/mission-board";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import AccessDenied from "@/components/access-denied";
import { GuildProgressBar } from "@/components/missions/guild-progress-bar";
import { isModuleEnabled } from "@/server/actions/module-actions";

export const dynamic = 'force-dynamic';

// Local Helper if not in utils
function getCurrentWeek() {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return { week, year: now.getFullYear() };
}

export default async function MissionsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Module guard
    if (!await isModuleEnabled(guildId, "missions")) {
        redirect(`/dashboard/${guildId}`);
    }

    // RBAC: Check permission to view Missions
    const user = await getUserContext(guildId);
    if (!user.canViewMissions) {
        return <AccessDenied />;
    }


    const { week, year } = getCurrentWeek();

    const response = await getWeekMissions(guildId, week, year);

    if (!response.success) {
        // Check for specific permission errors
        if (response.error?.includes("Member not found") || response.error?.includes("Insufficient Permissions")) {
            return <AccessDenied />;
        }

        return (
            <div className="p-8 text-center text-red-500 bg-red-500/10 rounded-xl border border-red-500/20">
                <p className="font-semibold">Erreur de chargement des missions</p>
                <p className="text-sm opacity-80">{response.error}</p>
            </div>
        );
    }

    const missions = response.data || [];

    // Guild Config for Target Tier
    const { getDofusConfig } = await import("@/server/actions/admin-actions"); // Dynamic import to avoid cycles if any
    const configRes = await getDofusConfig(guildId);
    const targetTier = configRes.data?.missionTier || 3;

    // Calculate Total Weekly XP (Activity Points)
    // Formula: Sum of (Mission XP * Count of Validated Submissions)
    const currentXP = missions.reduce((acc: number, mission: any) => {
        // @ts-ignore - _count is added in the query but locally typed maybe not
        const validatedCount = mission._count?.submissions || 0;
        return acc + (mission.xpReward || 0) * validatedCount;
    }, 0);

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Missions de Guilde"
                description={`Semaine ${week} • Année ${year} | Relevez les défis pour faire briller votre guilde.`}
                icon={ScrollText}
                iconColor="#ef4444"
                backHref={`/dashboard/${guildId}`}
            />

            {/* Guild Progress Bar */}
            <div className="px-1">
                <GuildProgressBar currentXP={currentXP} targetTier={targetTier} guildId={guildId} />
            </div>

            <MissionBoard
                missions={missions}
                currentUserId={session.user.id!}
                guildId={guildId}
            />
        </div>
    );
}
