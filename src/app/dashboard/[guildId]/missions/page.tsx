import { auth } from "@/auth";
import { getWeekMissions, getGuildMissionXpOverride, getWeeklyGuildatons } from "@/server/actions/mission-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { getMyWeeklyKamaStatus, getKamaStats } from "@/server/actions/kama-actions";
import { MissionBoard } from "@/components/missions/mission-board";
import { redirect } from "next/navigation";
import { ScrollText, Info } from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import AccessDenied from "@/components/access-denied";
import { MissionsErrorState } from "@/components/missions/missions-error-state";
import { GuildProgressBar } from "@/components/missions/guild-progress-bar";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { ActivitiesNav } from "@/components/layout/activities-nav";
import { getDofusWeek } from "@/lib/date-utils";
import { WeeklyGuildatonCounter } from "@/components/missions/weekly-guildaton-counter";

export const dynamic = 'force-dynamic';


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

    const { week, year } = getDofusWeek();

    // Fetch all data in parallel
    const [response, overrideRes, kamaRes, kamaStatsRes, weeklyGuildatons] = await Promise.all([
        getWeekMissions(guildId, week, year),
        getGuildMissionXpOverride(guildId),
        getMyWeeklyKamaStatus(guildId),
        getKamaStats(guildId), // Fetch total guild stats for kama XP calculation
        getWeeklyGuildatons(user.profileId!, week, year),
    ]);

    // 24h Restriction Check
    const HOURS_RESIDENCY = 24;
    const profileCreatedAt = user.createdAt ? new Date(user.createdAt) : new Date();
    const diffMs = Date.now() - profileCreatedAt.getTime();
    const isRestricted = (diffMs / (1000 * 60 * 60)) < HOURS_RESIDENCY && !user.isAdmin;
    const availableAt = new Date(profileCreatedAt.getTime() + (HOURS_RESIDENCY * 60 * 60 * 1000)).toISOString();

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

    // [KAM-XP] Add validated kama donations XP this week (guild-wide)
    let kamaXP = 0;
    if (kamaStatsRes.success && kamaStatsRes.data) {
        const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");
        const validatedWeeklyKamas = kamaStatsRes.data.weeklyTotal || 0; // The whole guild's valid kamas this week
        const validatedTranches = Math.floor(validatedWeeklyKamas / KAMA_TRANCHE);
        kamaXP = validatedTranches * REWARDS_PER_TRANCHE.xp;
    }

    const dynamicXP = missionXP + kamaXP;
    const currentXP = xpOverride !== null ? Math.max(xpOverride, dynamicXP) : dynamicXP;


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

            {/* Dashboard Row 1: XP Progress & Weekly Rewards */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-1">
                <div className="xl:col-span-2">
                    <GuildProgressBar
                        currentXP={currentXP}
                        targetTier={targetTier}
                        guildId={guildId}
                        kamaStatus={kamaStatus}
                    />
                </div>
                <div className="space-y-6">
                    <WeeklyGuildatonCounter current={weeklyGuildatons || 0} />
                    
                    {/* Placeholder for other stats/widgets if needed */}
                    <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/5 flex flex-col items-center justify-center gap-3 text-center">
                         <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                             <Info className="w-5 h-5 text-indigo-400" />
                         </div>
                         <div>
                             <p className="text-xs font-bold text-white uppercase tracking-tighter">Information</p>
                             <p className="text-[10px] text-zinc-500 leading-relaxed mt-1">
                                Pensez à lier vos stuffs Dofusbook dans votre Profil (onglet Stuff) pour plus de visibilité.
                             </p>
                         </div>
                    </div>
                </div>
            </div>

            <MissionBoard
                missions={missions}
                currentUserId={session.user.id!}
                guildId={guildId}
                isRestricted={isRestricted}
                availableAt={availableAt}
            />
        </div>
    );
}
