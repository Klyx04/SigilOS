import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDreamRuns } from "@/server/actions/songes/dream-run-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { SongesHeader } from "@/components/songes/SongesHeader";
import { RunCardGrid } from "@/components/songes/RunCardGrid";
import { CreateRunButton } from "@/components/songes/CreateRunButton";

export default async function SongesPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;
    const userContext = await getUserContext(guildId);

    // RBAC: Check permission to view Songes
    if (!userContext.canViewSonges && !userContext.isAdmin) {
        notFound();
    }

    const { runs } = await getDreamRuns(["RECRUITING", "IN_PROGRESS", "COMPLETED"]);
    const currentUserId = userContext.isAuthenticated ? userContext.id : undefined;

    return (
        <div className="space-y-6">
            {/* Header */}
            <SongesHeader />

            {/* Create Button - only if has permission */}
            {(userContext.canCreateSonges || userContext.isAdmin) && (
                <div className="flex justify-end">
                    <CreateRunButton />
                </div>
            )}

            {/* Active Runs Grid */}
            <Suspense fallback={<div className="text-purple-400">Chargement...</div>}>
                <RunCardGrid
                    runs={runs}
                    currentUserId={currentUserId}
                />
            </Suspense>
        </div>
    );
}
