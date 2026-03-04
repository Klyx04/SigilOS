import { auth } from "@/auth";
import { getWeekMissions, getGuildMissionXpOverride } from "@/server/actions/mission-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { MissionBoard } from "@/components/missions/mission-board";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import AccessDenied from "@/components/access-denied";
import { MissionsErrorState } from "@/components/missions/missions-error-state";
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
        if (response.error?.includes("Member not found") || response.error?.includes("Insufficient Permissions")) {
            return <AccessDenied />;
        }
        return <MissionsErrorState error={response.error || "Une erreur inconnue est survenue."} />;
    }

    const missions = response.data || [];

    // [MIS-1] XP Override - reads missionWeekXpOverride from DB
    // Falls back to dynamic XP (sum of validated submissions) if no override set
    const overrideRes = await getGuildMissionXpOverride(guildId);
    const xpOverride = (overrideRes.success && overrideRes.data) ? overrideRes.data.xpOverride : null;

    const dynamicXP = missions.reduce((acc: number, mission: any) => {
        const validatedCount = (mission as any)._count?.submissions || 0;
        return acc + ((mission as any).xpReward || 0) * validatedCount;
    }, 0);

    const currentXP = xpOverride !== null ? xpOverride : dynamicXP;

    // [MIS-1 FIX] Use the tier of published missions if available (source of truth),
    // fallback on the config tier.
    const missionTierFromPublished = missions.length > 0 ? (missions[0] as any)?.tier ?? null : null;
    // Default tier 3 if no missions published yet and no config available
    const targetTier = missionTierFromPublished !== null ? missionTierFromPublished : 3;

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
