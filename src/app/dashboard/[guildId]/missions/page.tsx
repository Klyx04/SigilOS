import { auth } from "@/auth";
import { getWeekMissions } from "@/server/actions/mission-actions";
import { MissionBoard } from "@/components/missions/mission-board";
import { redirect, notFound } from "next/navigation";

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

    // We can resolve params async in Next.js 15 but `params` prop is just an object in standard setup.
    // In Next 15 `params` is a Promise. Let's assume standard behavior or check Next config.
    // The user said Next 15+.

    // Quick Fix for Params: 
    // In strict Next 15, params is a Promise.
    const { guildId } = await params;

    // For now assuming the project setup for Dashboard layout feeds `params` correctly. 
    // Let's rely on standard Next 14/15 pattern.
    // const guildId = params.guildId;

    const { week, year } = getCurrentWeek();

    const response = await getWeekMissions(guildId, week, year);

    if (!response.success) {
        // Check for specific permission errors
        if (response.error?.includes("Member not found") || response.error?.includes("Insufficient Permissions")) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                    <h2 className="text-xl font-bold text-red-500">Accès Refusé</h2>
                    <p className="text-zinc-400 max-w-md text-center">
                        Vous ne semblez pas être membre de ce serveur Discord ou vous n'avez pas les droits nécessaires.
                    </p>
                </div>
            );
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
