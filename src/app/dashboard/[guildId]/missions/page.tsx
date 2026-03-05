import { auth } from "@/auth";
import { getWeekMissions, getGuildMissionXpOverride } from "@/server/actions/mission-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { getMyWeeklyKamaStatus } from "@/server/actions/kama-actions";
import { MissionBoard } from "@/components/missions/mission-board";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import AccessDenied from "@/components/access-denied";
import { MissionsErrorState } from "@/components/missions/missions-error-state";
import { GuildProgressBar } from "@/components/missions/guild-progress-bar";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { ActivitiesNav } from "@/components/layout/activities-nav";

export const dynamic = 'force-dynamic';

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

    if (!await isModuleEnabled(guildId, "missions")) {
        redirect(`/dashboard/${guildId}`);
    }

    const user = await getUserContext(guildId);
    if (!user.canViewMissions) {
        return <AccessDenied />;
    }

    const { week, year } = getCurrentWeek();

    // Fetch all data in parallel
    const [response, overrideRes, kamaRes] = await Promise.all([
        getWeekMissions(guildId, week, year),
        getGuildMissionXpOverride(guildId),
        getMyWeeklyKamaStatus(guildId),
    ]);

    if (!response.success) {
        if (response.error?.includes("Member not found") || response.error?.includes("Insufficient Permissions")) {
            return <AccessDenied />;
        }
        return <MissionsErrorState error={response.error || "Une erreur inconnue est survenue."} />;
    }

    const missions = response.data || [];

    // [MIS-1] XP Override
    const xpOverride = (overrideRes.success && overrideRes.data) ? overrideRes.data.xpOverride : null;
    const missionXP = missions.reduce((acc: number, mission: any) => {
        const validatedCount = (mission as any)._count?.submissions || 0;
        return acc + ((mission as any).xpReward || 0) * validatedCount;
    }, 0);

    // [KAM-XP] Add validated kama donations XP this week
    let kamaXP = 0;
    if (kamaRes.success && kamaRes.data) {
        const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");
        const validatedKamas = kamaRes.data.validatedThisWeek;
        const validatedTranches = Math.floor(validatedKamas / KAMA_TRANCHE);
        kamaXP = validatedTranches * REWARDS_PER_TRANCHE.xp;
    }

    const dynamicXP = missionXP + kamaXP;
    const currentXP = xpOverride !== null ? xpOverride : dynamicXP;


    // [MIS-1 FIX] targetTier from published missions, fallback 3
    const missionTierFromPublished = missions.length > 0 ? (missions[0] as any)?.tier ?? null : null;
    const targetTier = missionTierFromPublished !== null ? missionTierFromPublished : 3;

    // Kama status for the widget
    const kamaStatus = (kamaRes.success && kamaRes.data) ? kamaRes.data : null;

    return (
        <div className="space-y-6 pb-12">
            <ActivitiesNav guildId={guildId} />
            <UnifiedModuleHeader
                title="Missions de Guilde"
                description={`Semaine ${week} • Année ${year} | Relevez les défis pour faire briller votre guilde.`}
                icon={ScrollText}
                iconColor="#ef4444"
                backHref={`/dashboard/${guildId}`}
            />

            {/* Guild Progress Bar with kama widget integrated */}
            <div className="px-1">
                <GuildProgressBar
                    currentXP={currentXP}
                    targetTier={targetTier}
                    guildId={guildId}
                    kamaStatus={kamaStatus}
                />
            </div>

            <MissionBoard
                missions={missions}
                currentUserId={session.user.id!}
                guildId={guildId}
            />
        </div>
    );
}
