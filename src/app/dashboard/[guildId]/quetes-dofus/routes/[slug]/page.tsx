import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress } from "@/server/actions/optimized-guide-actions";
import OptimizedGuideClient from "./OptimizedGuideClient";

export default async function OptimizedGuideUserPage({ params }: { params: { guildId: string, slug: string } }) {
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    // 1. Fetch Guide Details & Current User Progress
    const guideContext = await getOptimizedGuideDetail(params.slug, params.guildId);
    
    if (!guideContext.success || !guideContext.guide) {
        notFound();
    }

    // 2. Fetch Guild members progress
    const membersContext = await getGuildOptimizedGuideProgress(params.slug, params.guildId);

    return (
        <div className="flex flex-col w-full h-full p-4 lg:p-8 xl:p-12 overflow-y-auto custom-scrollbar">
            <OptimizedGuideClient 
                guide={guideContext.guide} 
                questsDetail={guideContext.questsDetail || []} 
                memberProgress={membersContext.memberProgress || []} 
                currentUserId={session.user.id}
            />
        </div>
    );
}
