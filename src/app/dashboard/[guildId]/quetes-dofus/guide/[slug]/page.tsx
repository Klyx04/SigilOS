import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress } from "@/server/actions/optimized-guide-actions";
import OptimizedGuideClient from "./OptimizedGuideClient";

export default async function OptimizedGuideUserPage({ params }: { params: Promise<{ guildId: string, slug: string }> }) {
    const { guildId, slug } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    // 1. Fetch Guide Details & Current User Progress (with robust error handling)
    let guideContext: Awaited<ReturnType<typeof getOptimizedGuideDetail>>;
    try {
        guideContext = await getOptimizedGuideDetail(slug, guildId);
    } catch (e) {
        console.error("[Guide Page] Error fetching guide:", slug, e);
        notFound();
    }

    if (!guideContext.success || !guideContext.guide) {
        console.error("[Guide Page] Guide not found for slug:", slug, "→ result:", guideContext);
        notFound();
    }

    // 2. Fetch Guild members progress (non-blocking - fail gracefully)
    let allProgress: any[] = [];
    try {
        const membersContext = await getGuildOptimizedGuideProgress(slug, guildId);
        allProgress = membersContext.allProgress || [];
    } catch (e) {
        console.error("[Guide Page] Guild progress fetch failed (non-fatal):", e);
    }

    return (
        <div className="flex w-full h-full overflow-hidden">
            <OptimizedGuideClient
                guide={guideContext.guide}
                milestones={guideContext.guide.milestones as any}
                userProgress={guideContext.guide.milestones.flatMap((m: any) => m.playerProgress || [])}
                guildProgress={allProgress}
                guildId={guildId}
            />
        </div>
    );
}
