import { notFound, redirect } from "next/navigation";
export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress } from "@/server/actions/optimized-guide-actions";
import { getMemberProfile } from "@/server/actions/profile-actions";
import { CharacterQuestSelector } from "@/components/dofus-quests/CharacterQuestSelector";
import OptimizedGuideClient from "./OptimizedGuideClient";
import RushTimelineClient from "./RushTimelineClient";

type Props = {
    params: Promise<{ guildId: string; slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function OptimizedGuideUserPage({ params, searchParams }: Props) {
    const { guildId, slug } = await params;
    const resolvedSearchParams = await searchParams;
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    const character = (resolvedSearchParams?.character as string) || "PRINCIPAL";
    const altPseudo = character !== "PRINCIPAL" ? character : undefined;

    const user = await getUserContext(guildId);

    let guideContext: Awaited<ReturnType<typeof getOptimizedGuideDetail>>;
    try {
        guideContext = await getOptimizedGuideDetail(slug, guildId, altPseudo);
    } catch (e: any) {
        console.error("[Guide Page] Error fetching guide:", slug, e?.message);
        notFound();
    }

    if (!guideContext.success || !guideContext.guide) {
        notFound();
    }

    const guide = guideContext.guide as any;
    const isTimeline = guide.displayMode === "TIMELINE";

    // Fetch Guild members progress (non-blocking)
    let allProgress: any[] = [];
    try {
        const membersContext = await getGuildOptimizedGuideProgress(slug, guildId);
        allProgress = (membersContext.allProgress || []).map((p: any) => ({
            profileId: p.profileId,
            milestoneId: p.milestoneId,
            isCompleted: p.isCompleted || false,
            completedSteps: Array.isArray(p.completedSteps) ? p.completedSteps : [],
            currentStep: p.currentStep || null,
            userName: p.profile?.displayName || p.profile?.pseudoDofus || p.profile?.user?.name || "Voyageur",
            userAvatar: p.profile?.user?.image || undefined,
            profileSlug: p.profile?.pseudoDofus || p.profileId
        }));
    } catch (e) {
        console.error("[Guide Page] Guild progress fetch failed (non-fatal):", e);
    }

    // Fetch full profile to get alignment, alignmentOrder, alignmentLevel, altPseudos, class & metamob
    let userProfile: { 
        alignment?: string | null; 
        alignmentOrder?: string | null; 
        alignmentLevel?: number; 
        altPseudos?: any[]; 
        dofusClass?: string | null;
        metamobPseudo?: string | null;
        pseudoDofus?: string | null;
    } = {};
    try {
        const profileId = user.profileId;
        if (!profileId) throw new Error("Profile ID not found");
        const profileRes = await getMemberProfile(guildId, profileId);
        if (profileRes.success && profileRes.data) {
            const p = profileRes.data;
            userProfile = {
                alignment: p.alignment,
                alignmentOrder: p.alignmentOrder,
                alignmentLevel: p.alignmentLevel ?? 0,
                altPseudos: Array.isArray(p.altPseudos) ? p.altPseudos : [],
                dofusClass: p.classe,
                metamobPseudo: p.metamobPseudo,
                pseudoDofus: p.pseudoDofus,
            };
        }
    } catch (e) {
        console.error("[Guide Page] Profile fetch failed (non-fatal):", e);
    }

    // Fetch Ocre progress stats if metamob is linked
    let ocreStats: any = null;
    let capturedOcreMonsterIds: number[] = [];
    let capturedMonsterNames: string[] = [];
    if (userProfile.metamobPseudo) {
        try {
            const { getMyOcreProgress } = await import("@/server/actions/ocre-actions");
            const ocreRes = await getMyOcreProgress(guildId);
            if (ocreRes.success && ocreRes.data?.stats) {
                ocreStats = {
                    bosses: ocreRes.data.stats.bosses,
                    archis: ocreRes.data.stats.archis,
                    progressPercent: ocreRes.data.stats.progressPercent,
                    currentStep: ocreRes.data.questInfo?.currentStep ?? 1,
                    serverName: ocreRes.data.questInfo?.serverName || "Dofus Unity",
                };
                // Build lists of captured monster IDs and names for dungeon detection
                const monsters = ocreRes.data.monsters;
                if (Array.isArray(monsters)) {
                    const captured = monsters.filter((m: any) => m.owned != null && m.owned > 0);
                    capturedOcreMonsterIds = captured.map((m: any) => m.id);
                    capturedMonsterNames = captured
                        .map((m: any) => m.name?.fr || m.name || "")
                        .filter(Boolean);
                }
            }
        } catch (e) {
            console.error("[Guide Page] Metamob stats fetch error (non-fatal):", e);
        }
    }

    const mules = (user.altPseudos as any[] | undefined) || [];

    return (
        <div className="flex flex-col w-full h-full overflow-hidden">

            <Suspense fallback={
                <div className="flex items-center justify-center w-full h-full">
                    <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                </div>
            }>
                {isTimeline ? (
                    <div className="flex-1 overflow-y-auto px-6">
                        <div className="mx-auto max-w-5xl">
                        <RushTimelineClient
                            key={character}
                            guide={{
                                id: guide.id,
                                name: guide.name,
                                slug: guide.slug,
                                description: guide.description,
                                imageUrl: guide.imageUrl,
                                isUnderConstruction: guide.isUnderConstruction ?? false,
                            }}
                            milestones={guide.milestones as any}
                            guildProgress={allProgress}
                            guildId={guildId}
                            selectedCharacter={character}
                            mules={mules}
                            currentUserProfile={{
                                alignment: userProfile.alignment,
                                alignmentOrder: userProfile.alignmentOrder,
                                alignmentLevel: userProfile.alignmentLevel,
                                altPseudos: mules,
                                dofusClass: userProfile.dofusClass,
                                metamobPseudo: userProfile.metamobPseudo,
                                pseudoDofus: userProfile.pseudoDofus,
                            }}
                            ocreStats={ocreStats}
                            capturedOcreMonsterIds={Array.from(capturedOcreMonsterIds)}
                            capturedMonsterNames={capturedMonsterNames}
                        />
                        </div>
                        </div>
                ) : (
                    <OptimizedGuideClient
                        key={character}
                        guide={guide}
                        milestones={guide.milestones as any}
                        userProgress={guide.milestones.flatMap((m: any) => m.playerProgress || [])}
                        guildProgress={allProgress}
                        guildId={guildId}
                        selectedCharacter={character}
                        mainCharacter={{
                            pseudo: user.pseudoDofus || user.name || "Principal",
                            classe: user.classe,
                        }}
                        mules={mules}
                        currentUserProfile={{
                            alignment: userProfile.alignment,
                            alignmentOrder: userProfile.alignmentOrder,
                            alignmentLevel: userProfile.alignmentLevel,
                            altPseudos: mules,
                            dofusClass: userProfile.dofusClass,
                            metamobPseudo: userProfile.metamobPseudo,
                            pseudoDofus: userProfile.pseudoDofus,
                        }}
                        ocreStats={ocreStats}
                    />
                )}
            </Suspense>
        </div>
    );
}
