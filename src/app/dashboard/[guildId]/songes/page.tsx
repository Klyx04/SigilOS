import { Suspense } from "react";
import { getDreamRuns } from "@/server/actions/songes/dream-run-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { RunCardGrid } from "@/components/songes/RunCardGrid";
import { CreateRunButton } from "@/components/songes/CreateRunButton";
import { SongesGridSkeleton } from "@/components/songes/RunSkeletons";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Sparkles } from "lucide-react";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { redirect } from "next/navigation";

export default async function SongesPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;

    // Module guard
    if (!await isModuleEnabled(guildId, "songes")) {
        redirect(`/dashboard/${guildId}`);
    }

    const userContext = await getUserContext(guildId);

    // RBAC: Check permission to view Songes
    if (!userContext.canViewSonges) {
        return <AccessDenied />;
    }


    const { runs } = await getDreamRuns(guildId, ["RECRUITING", "IN_PROGRESS", "COMPLETED"]);
    const currentUserId = userContext.isAuthenticated ? userContext.id : undefined;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Songes Infinis"
                description="Suivez la progression des runs et rejoignez vos compagnons d'armes."
                icon={Sparkles}
                iconColor="#d946ef"
                backHref={`/dashboard/${guildId}`}
                actions={
                    (userContext.canCreateSonges || userContext.isAdmin) && (
                        <CreateRunButton guildId={guildId} />
                    )
                }
            />

            {/* Active Runs Grid */}
            <Suspense fallback={<SongesGridSkeleton />}>
                <RunCardGrid
                    runs={runs}
                    currentUserId={currentUserId}
                    canJoinSonges={userContext.canJoinSonges}
                    isAdmin={userContext.isAdmin}
                />
            </Suspense>
        </div>
    );
}
