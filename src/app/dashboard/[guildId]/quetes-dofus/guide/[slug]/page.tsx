import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress } from "@/server/actions/optimized-guide-actions";
import { CharacterQuestSelector } from "@/components/dofus-quests/CharacterQuestSelector";
import OptimizedGuideClient from "./OptimizedGuideClient";

type Props = {
    params: Promise<{ guildId: string; slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function OptimizedGuideUserPage({ params, searchParams }: Props) {
    const { guildId, slug } = await params;
    const resolvedSearchParams = await searchParams;
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    // Read selected character (mule) from query string
    const character = (resolvedSearchParams?.character as string) || "PRINCIPAL";
    const altPseudo = character !== "PRINCIPAL" ? character : undefined;

    // Fetch user context for character selector
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

    // Fetch Guild members progress (non-blocking - fail gracefully)
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

    const mules = (user.altPseudos as any[] | undefined) || [];

    return (
        <div className="flex flex-col w-full h-full overflow-hidden">
            {/* Character selector bar — only shown when mules exist */}
            {mules.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-950/80 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400/60">
                        <span>📖 {guideContext.guide.name}</span>
                    </div>
                    <CharacterQuestSelector
                        mainCharacter={{
                            pseudo: user.pseudoDofus || user.name || "Principal",
                            classe: user.classe,
                        }}
                        mules={mules}
                    />
                </div>
            )}

            <Suspense fallback={<div className="flex items-center justify-center w-full h-full"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>}>
                <OptimizedGuideClient
                    guide={guideContext.guide}
                    milestones={guideContext.guide.milestones as any}
                    userProgress={guideContext.guide.milestones.flatMap((m: any) => m.playerProgress || [])}
                    guildProgress={allProgress}
                    guildId={guildId}
                    selectedCharacter={character}
                    mainCharacter={{
                        pseudo: user.pseudoDofus || user.name || "Principal",
                        classe: user.classe,
                    }}
                    mules={mules}
                />
            </Suspense>
        </div>
    );
}
