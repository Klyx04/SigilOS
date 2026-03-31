import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Gem } from "lucide-react";
import { getDofusListWithProgress, getGuildDofusStats, getDofusWarRoomData } from "@/server/actions/dofus-quest-actions";
import { DofusQuestHub } from "@/components/dofus-quests/DofusQuestHub";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function QuetesDofusPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewQuests) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "quests");
    if (!enabled) return <AccessDenied />;

    // Fetch data in parallel
    const [dofusResult, guildStatsResult, warRoomResult] = await Promise.all([
        getDofusListWithProgress(guildId),
        getGuildDofusStats(guildId),
        getDofusWarRoomData(guildId),
    ]);

    const dofusList = dofusResult.success ? (dofusResult.data ?? []) : [];
    const guildStats = guildStatsResult.success ? guildStatsResult.data ?? null : null;
    const warRoomData = warRoomResult.success ? (warRoomResult.data ?? null) : null;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Quêtes Dofus"
                description="Suivez votre progression vers chaque Dofus et comparez-vous à votre guilde"
                icon={Gem}
                backHref={`/dashboard/${guildId}`}
            />

            {dofusList.length === 0 ? (
                <EmptyState guildId={guildId} isAdmin={user.isAdmin} />
            ) : (
                <DofusQuestHub
                    dofusList={dofusList}
                    guildStats={guildStats}
                    warRoomData={warRoomData}
                    guildId={guildId}
                />
            )}
        </div>
    );
}

function EmptyState({ guildId, isAdmin }: { guildId: string; isAdmin: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)" }}
            >
                <Gem className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="max-w-sm">
                <h3 className="text-white/80 font-semibold text-lg mb-1">Données en cours d'initialisation</h3>
                <p className="text-white/40 text-sm">
                    Les données des Dofus doivent encore être chargées dans la base de données.
                </p>
                {isAdmin && (
                    <p className="text-indigo-400/70 text-xs mt-3">
                        (Admin) Utilisez le panneau d'administration pour lancer le seed des données Dofus.
                    </p>
                )}
            </div>
        </div>
    );
}
