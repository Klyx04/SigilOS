import { auth } from "@/auth";
import { getWeekMissions } from "@/server/actions/mission-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { MissionBoard } from "@/components/missions/mission-board";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";

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

    return (
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Missions de Guilde</h1>
                    <p className="text-zinc-400">Semaine {week} • Année {year}</p>
                </div>
            </div>

            <MissionBoard
                missions={missions}
                currentUserId={session.user.id!}
                guildId={guildId}
            />
        </div>
    );
}
