import { Suspense } from "react";
import { getDreamRuns } from "@/server/actions/songes/dream-run-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { RunCardGrid } from "@/components/songes/RunCardGrid";
import { CreateRunButton } from "@/components/songes/CreateRunButton";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { InfinityIcon } from "lucide-react";

export default async function SongesPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;
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
                imageSrc="/assets/ui/icons/songes.png"
                backHref={`/dashboard/${guildId}`}
                actions={
                    (userContext.canCreateSonges || userContext.isAdmin) && (
                        <CreateRunButton guildId={guildId} />
                    )
                }
            />

            {/* Active Runs Grid */}
            <Suspense fallback={<div className="text-purple-400">Chargement...</div>}>
                <RunCardGrid
                    runs={runs}
                    currentUserId={currentUserId}
                    canJoinSonges={userContext.canJoinSonges}
                />
            </Suspense>
        </div>
    );
}
