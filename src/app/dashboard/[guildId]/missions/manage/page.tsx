import { auth } from "@/auth";
import { MissionEditor } from "@/components/missions/mission-editor";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MissionXpOverrideControl } from "@/components/missions/mission-xp-override-control";
import { getDofusConfig } from "@/server/actions/admin-actions";
import { getWeekMissions } from "@/server/actions/mission-actions";

export const dynamic = 'force-dynamic';

function getCurrentWeek() {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return { week, year: now.getFullYear() };
}

export default async function MissionsManagePage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");
    const { guildId } = await params;

    // RBAC: Check permission to manage missions
    const user = await getUserContext(guildId);
    if (!user.canManageMissions) {
        await logAdminAccessDenied(guildId, "/missions/manage");
        return <AccessDenied />;
    }

    const configRes = await getDofusConfig(guildId);
    const configTier = configRes.data?.missionTier || 3;

    // Use published mission tier if available (source of truth)
    const { week, year } = getCurrentWeek();
    const missionsRes = await getWeekMissions(guildId, week, year);
    const missions = missionsRes.data || [];
    const missionTierFromPublished = missions.length > 0 ? (missions[0] as any)?.tier ?? null : null;
    const targetTier = missionTierFromPublished !== null ? missionTierFromPublished : configTier;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Gestion des Missions"
                description="Préparez et publiez les missions de la semaine pour la guilde."
                imageSrc="/assets/ui/icons/missions.png"
                backHref={`/dashboard/${guildId}/missions`}
            />

            {/* [MIS-1] Contrôle de la barre XP manuelle */}
            <MissionXpOverrideControl guildId={guildId} targetTier={targetTier} />

            <MissionEditor guildId={guildId} />
        </div>
    );
}
