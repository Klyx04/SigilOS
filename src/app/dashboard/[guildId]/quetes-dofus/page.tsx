import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Gem } from "lucide-react";
import { getDofusListWithProgress, getGuildDofusStats } from "@/server/actions/dofus-quest-actions";
import { getOptimizedGuides, getOptimizedGuideDetail, getGuildOptimizedGuideProgress } from "@/server/actions/optimized-guide-actions";
import { DofusQuestHub } from "@/components/dofus-quests/DofusQuestHub";
import { CharacterQuestSelector } from "@/components/dofus-quests/CharacterQuestSelector";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

import { ActivitiesNav } from "@/components/layout/activities-nav";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

type Props = {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function QuetesDofusPage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const resolvedSearchParams = await searchParams;
    const character = resolvedSearchParams?.character as string || "PRINCIPAL";

    const user = await getUserContext(guildId);
    if (!user.canViewQuests) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "quests");
    if (!enabled) return <AccessDenied />;

    // Fetch data in parallel
    const [dofusResult, guildStatsResult, guidesResult, rushSylvestre] = await Promise.all([
        getDofusListWithProgress(guildId, character),
        getGuildDofusStats(guildId),
        getOptimizedGuides(guildId),
        db.optimizedGuide.findUnique({
            where: { slug: "rush-sylvestre" },
            select: { isUnderConstruction: true, isActive: true },
        }).catch(() => null),
    ]);

    const dofusList = dofusResult.success ? (dofusResult.data ?? []) : [];
    const guildStats = guildStatsResult.success ? guildStatsResult.data ?? null : null;
    const guides = guidesResult.success ? guidesResult.guides ?? [] : [];

    // Fetch user profile for Metamob sync status
    const profile = user.profileId ? await db.userProfile.findUnique({
        where: { id: user.profileId },
        select: {
            metamobPseudo: true,
            metamobVerified: true,
            metamobLastSync: true,
            metamobQuestSlug: true,
        }
    }) : null;

    const userProfile = profile ? {
        metamobPseudo: profile.metamobPseudo,
        metamobVerified: profile.metamobVerified,
        metamobLastSync: profile.metamobLastSync?.toISOString() || null,
        metamobQuestSlug: profile.metamobQuestSlug,
    } : null;

    const guideSlug = resolvedSearchParams?.guide as string || (guides.length > 0 ? guides[0].slug : null);

    let guideDetail = null;
    let guideUserProgress = null;
    let guideGuildProgress = null;

    if (guideSlug) {
        try {
            const detailRes = await getOptimizedGuideDetail(guideSlug, guildId);
            if (detailRes.success && detailRes.guide) {
                guideDetail = detailRes.guide;
                guideUserProgress = detailRes.guide.milestones.flatMap((m: any) => m.playerProgress || []);
                
                const membersContext = await getGuildOptimizedGuideProgress(guideSlug, guildId);
                // Phase I : lignes allégées renvoyées par le serveur (shape inchangée).
                guideGuildProgress = membersContext.allProgress || [];
            }
        } catch (e) {
            logger.error("[Quest Page] Error fetching guide details", { error: e });
        }
    }

    const serializedGuides = JSON.parse(JSON.stringify(guides));
    const serializedGuideDetail = guideDetail ? JSON.parse(JSON.stringify(guideDetail)) : null;
    const serializedGuideUserProgress = guideUserProgress ? JSON.parse(JSON.stringify(guideUserProgress)) : null;
    const serializedGuideGuildProgress = guideGuildProgress ? JSON.parse(JSON.stringify(guideGuildProgress)) : null;

    return (
        <div className="relative min-h-[calc(100vh-4rem)] pb-12">
            <AuroraBackground className="absolute inset-0 z-0 opacity-20 pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6" data-tour="quetes-header">
                    <UnifiedModuleHeader
                        title="Quêtes Dofus"
                        description="Suivez votre progression vers chaque Dofus et comparez-vous à votre guilde"
                        imageSrc="/assets/dofus/game-icons/dofus.png"
                        backHref={`/dashboard/${guildId}`}
                        actions={<ModuleTourReplayButton phase="quetesDofus" />}
                    />
                    
                    <div className="flex-shrink-0 lg:mb-1" data-tour="quetes-character">
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
                    <div data-tour="quetes-board">
                        <DofusQuestHub
                            dofusList={dofusList}
                            guildStats={guildStats}
                            guides={serializedGuides}
                            rushSylvestreGuide={rushSylvestre}
                            guildId={guildId}
                            selectedCharacter={character}
                            userProfile={userProfile}
                            selectedGuideSlug={guideSlug}
                            selectedGuideDetail={serializedGuideDetail}
                            selectedGuideUserProgress={serializedGuideUserProgress}
                            selectedGuideGuildProgress={serializedGuideGuildProgress}
                        />
                    </div>
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
                <Gem className="w-8 h-8 text-info" />
            </div>
            <div className="max-w-sm">
                <h3 className="text-foreground/80 font-semibold text-lg mb-1">Données en cours d'initialisation</h3>
                <p className="text-foreground/40 text-sm">
                    Les données des Dofus doivent encore être chargées dans la base de données.
                </p>
                {isAdmin && (
                    <p className="text-info/70 text-xs mt-3">
                        (Admin) Utilisez le panneau d'administration pour lancer le seed des données Dofus.
                    </p>
                )}
            </div>
        </div>
    );
}
