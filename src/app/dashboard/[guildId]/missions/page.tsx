import { auth } from "@/auth";
import { getWeekMissions, getGuildMissionXpOverride, getWeeklyGuildatons } from "@/server/actions/mission-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { getMyWeeklyKamaStatus, getKamaStats } from "@/server/actions/kama-actions";
import { getUserProfile } from "@/server/actions/profile-actions";
import { MissionBoard } from "@/components/missions/mission-board";
import { redirect } from "next/navigation";
import { ScrollText, Eye } from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import AccessDenied from "@/components/access-denied";
import { MissionsErrorState } from "@/components/missions/missions-error-state";
import { GuildProgressBar } from "@/components/missions/guild-progress-bar";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { ActivitiesNav } from "@/components/layout/activities-nav";
import { getDofusWeek } from "@/lib/date-utils";
import { PersonalGuildatonWidget } from "@/components/missions/personal-guildaton-widget";
import { db } from "@/lib/prisma";
import { GuildHallWidget } from "@/components/missions/guild-hall-widget";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

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
    const [response, overrideRes, kamaRes, kamaStatsRes, profileRes, guildConfig] = await Promise.all([
        getWeekMissions(guildId, week, year),
        getGuildMissionXpOverride(guildId),
        getMyWeeklyKamaStatus(guildId),
        getKamaStats(guildId),
        getUserProfile(guildId),
        db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                guildHallPosX: true,
                guildHallPosY: true,
                guildHallWorldId: true,
                missionVitrineMode: true,
                raidRequireKamaDonation: true,
            }
        })
    ]);

    const weeklyGuildatons = profileRes.success && profileRes.data 
        ? await getWeeklyGuildatons(profileRes.data.id, week, year)
        : 0;

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

    const missions = JSON.parse(JSON.stringify(response.data || []));

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
    // [MIS-1] Override already includes the generated dynamic XP if it is set.
    const currentXP = xpOverride !== null ? xpOverride : dynamicXP;


    // [MIS-1 FIX] targetTier from published missions, fallback 3
    const missionTierFromPublished = missions.length > 0 ? (missions[0] as any)?.tier ?? null : null;
    const targetTier = missionTierFromPublished !== null ? missionTierFromPublished : 3;

    // Kama status for the widget
    const kamaStatus = (kamaRes.success && kamaRes.data) ? kamaRes.data : null;

    const vitrineMode = !!guildConfig?.missionVitrineMode || !user.isMember;

    return (
        <div className="space-y-6 pb-12">
            <div data-tour="missions-header">
                <UnifiedModuleHeader
                    title="Missions de Guilde"
                    description={`Semaine ${week} • Année ${year} | Relevez les défis pour faire briller votre guilde.`}
                    icon={ScrollText}
                    iconColor="#ef4444"
                    backHref={`/dashboard/${guildId}`}
                    actions={<ModuleTourReplayButton phase="missions" />}
                />
            </div>

            {vitrineMode && (
                <div className="mx-1 p-4 rounded-xl bg-info/10 border border-info/20 text-info flex items-start gap-3 shadow-lg shadow-blue-500/5 animate-in fade-in duration-300">
                    <Eye className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <h4 className="font-bold text-sm tracking-wide text-info uppercase">Mode Vitrine Actif</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Les missions de guilde sont en mode lecture seule pour le moment. Vous pouvez consulter les objectifs de la semaine, mais l'upload de captures d'écran (bouton PREUVE) et l'accès aux classements d'activité et de guildatons sont désactivés.
                        </p>
                    </div>
                </div>
            )}

            {/* Dashboard Row 1: XP Progress & Weekly Rewards */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-1">
                <div className="xl:col-span-2" data-tour="missions-progress">
                    <GuildProgressBar
                        currentXP={currentXP}
                        targetTier={targetTier}
                        guildId={guildId}
                        kamaStatus={kamaStatus}
                        raidRequireKamaDonation={guildConfig?.raidRequireKamaDonation ?? true}
                    />
                </div>
                <div className="space-y-6" data-tour="missions-hall">
                    <GuildHallWidget 
                        posX={guildConfig?.guildHallPosX ?? null} 
                        posY={guildConfig?.guildHallPosY ?? null} 
                        worldId={guildConfig?.guildHallWorldId ?? null} 
                        guildId={guildId}
                    />
                </div>
            </div>

            <MissionBoard
                missions={missions}
                currentUserId={session.user.id!}
                guildId={guildId}
                isRestricted={isRestricted}
                availableAt={availableAt}
                vitrineMode={vitrineMode}
                hideUpload={!!user.isSuperAdmin}
            />
        </div>
    );
}
