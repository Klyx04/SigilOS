import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Gem } from "lucide-react";
import { getDofusListWithProgress, getGuildDofusStats } from "@/server/actions/dofus-quest-actions";
import { getOptimizedGuides } from "@/server/actions/optimized-guide-actions";
import { DofusQuestHub } from "@/components/dofus-quests/DofusQuestHub";
import { CharacterQuestSelector } from "@/components/dofus-quests/CharacterQuestSelector";

import { ActivitiesNav } from "@/components/layout/activities-nav";
import { AuroraBackground } from "@/components/ui/aurora-background";

type Props = {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function QuetesDofusPage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const character = (await searchParams)?.character as string || "PRINCIPAL";

    const user = await getUserContext(guildId);
    if (!user.canViewQuests) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "quests");
    if (!enabled) return <AccessDenied />;

    // Fetch data in parallel
    const [dofusResult, guildStatsResult, guidesResult] = await Promise.all([
        getDofusListWithProgress(guildId, character),
        getGuildDofusStats(guildId),
        getOptimizedGuides(guildId),
    ]);

    const dofusList = dofusResult.success ? (dofusResult.data ?? []) : [];
    const guildStats = guildStatsResult.success ? guildStatsResult.data ?? null : null;
    const guides = guidesResult.success ? guidesResult.guides ?? [] : [];

    return (
        <div className="relative min-h-[calc(100vh-4rem)] pb-12">
            <AuroraBackground className="absolute inset-0 z-0 opacity-20 pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                <ActivitiesNav guildId={guildId} />

                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <UnifiedModuleHeader
                        title="Quêtes Dofus"
                        description="Suivez votre progression vers chaque Dofus et comparez-vous à votre guilde"
                        icon={Gem}
                        backHref={`/dashboard/${guildId}`}
                    />
                    
                    <div className="flex-shrink-0 lg:mb-1">
                        <CharacterQuestSelector 
                            mainCharacter={{ 
                                pseudo: user.pseudoDofus || user.name || "Principal", 
                                classe: user.classe 
                             }}
                            mules={user.altPseudos as any || []}
                        />
                    </div>
                </div>

                {dofusList.length === 0 ? (
                    <EmptyState guildId={guildId} isAdmin={user.isAdmin} />
                ) : (
                    <DofusQuestHub
                        dofusList={dofusList}
                        guildStats={guildStats}
                        guides={guides}
                        guildId={guildId}
                        selectedCharacter={character}
                    />
                )}
            </div>
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
