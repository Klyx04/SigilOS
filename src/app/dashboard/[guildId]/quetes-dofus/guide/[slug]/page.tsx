import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress } from "@/server/actions/optimized-guide-actions";
import OptimizedGuideClient from "./OptimizedGuideClient";

export default async function OptimizedGuideUserPage({ params }: { params: Promise<{ guildId: string, slug: string }> }) {
    const { guildId, slug } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    let guideContext: Awaited<ReturnType<typeof getOptimizedGuideDetail>>;
    try {
        guideContext = await getOptimizedGuideDetail(slug, guildId);
        console.error("[DEBUG GUIDE PAGE] guideContext success:", guideContext.success, "guide found:", !!guideContext.guide);
    } catch (e: any) {
        console.error("[DEBUG GUIDE PAGE] Error fetching guide:", slug, e?.message, e?.stack);
        notFound();
    }

    if (!guideContext.success || !guideContext.guide) {
        console.error("[DEBUG GUIDE PAGE] Guide not found for slug:", slug, "→ result:", JSON.stringify(guideContext));
        notFound();
    }

    // 2. Fetch Guild members progress (non-blocking - fail gracefully)
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

    return (
        <div className="flex w-full h-full overflow-hidden">
            <Suspense fallback={<div className="flex items-center justify-center w-full h-full"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>}>
                <OptimizedGuideClient
                    guide={guideContext.guide}
                    milestones={guideContext.guide.milestones as any}
                    userProgress={guideContext.guide.milestones.flatMap((m: any) => m.playerProgress || [])}
                    guildProgress={allProgress}
                    guildId={guildId}
                />
            </Suspense>
        </div>
    );
}
