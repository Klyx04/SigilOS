import { notFound, redirect } from "next/navigation";
export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { logger } from "@/lib/logger";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress, listSubGuides } from "@/server/actions/optimized-guide-actions";
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

    // Contexte de navigation croisée (lien vers un sous-guide d'un AUTRE guide) :
    // résolu CÔTÉ SERVEUR → passé en props au client (fiabilité, pas de useSearchParams).
    const fromSlug = (resolvedSearchParams?.from as string) || null;
    const fromTitle = (resolvedSearchParams?.fromTitle as string) || null;

    const user = await getUserContext(guildId);

    let guideContext: Awaited<ReturnType<typeof getOptimizedGuideDetail>>;
    try {
        guideContext = await getOptimizedGuideDetail(slug, guildId, altPseudo);
    } catch (e: any) {
        logger.error("[Guide Page] Error fetching guide", { slug, error: e?.message });
        notFound();
    }

    if (!guideContext.success || !guideContext.guide) {
        notFound();
    }

    const guide = guideContext.guide as any;
    const isTimeline = guide.displayMode === "TIMELINE";

    // Fetch Guild members progress (non-blocking) — Phase I : agrégation serveur.
    // Le serveur renvoie les lignes allégées (shape client inchangée) + les agrégats
    // presenceMap/uniqueGuildMembers (AUDIT-MILITAIRE §2.1).
    let allProgress: any[] = [];
    let serverUniqueGuildMembers: any[] = [];
    let serverPresenceMap: any = {};
    let subGuideIdMap: Record<number, string> = {};
    let subGuideTotals: Record<string, number> = {};
    try {
        const [membersContext, subsRes] = await Promise.all([
            getGuildOptimizedGuideProgress(slug, guildId),
            listSubGuides(),
        ]);
        allProgress = membersContext.allProgress || [];
        serverUniqueGuildMembers = membersContext.uniqueGuildMembers || [];
        serverPresenceMap = membersContext.presenceMap || {};
        if (subsRes.success && Array.isArray(subsRes.subs)) {
            subsRes.subs.forEach((s: any) => {
                if (s.ganymadeId) subGuideIdMap[s.ganymadeId] = s.guideRef;
                if (s.guideRef && s.totalSteps) subGuideTotals[s.guideRef] = s.totalSteps;
            });
        }
    } catch (e) {
        logger.error("[Guide Page] Guild progress fetch failed (non-fatal)", { error: e });
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
        logger.error("[Guide Page] Profile fetch failed (non-fatal)", { error: e });
    }

    // Fetch Ocre progress stats if metamob is linked
    let ocreStats: any = null;
    let capturedOcreMonsterIds: number[] = [];
    let capturedMonsterNames: string[] = [];
    let ocreMonsters: any[] = [];
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
                    ocreMonsters = monsters;
                    const captured = monsters.filter((m: any) => m.owned != null && m.owned > 0);
                    capturedOcreMonsterIds = captured.map((m: any) => m.id);
                    capturedMonsterNames = captured
                        .map((m: any) => m.name?.fr || m.name || "")
                        .filter(Boolean);
                }
            }
        } catch (e) {
            logger.error("[Guide Page] Metamob stats fetch error (non-fatal)", { error: e });
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
                            ocreMonsters={ocreMonsters}
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
                        serverUniqueGuildMembers={serverUniqueGuildMembers}
                        serverPresenceMap={serverPresenceMap}
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
                        ocreMonsters={ocreMonsters}
                        subGuideIdMap={subGuideIdMap}
                        subGuideTotals={subGuideTotals}
                        fromSlug={fromSlug}
                        fromTitle={fromTitle}
                    />
                )}
            </Suspense>
        </div>
    );
}
