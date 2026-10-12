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
import { BossGuideLauncher } from "@/components/songes/BossGuideLauncher";
import { ActivitiesNav } from "@/components/layout/activities-nav";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";
import { SONGES_ACTION_GROUP } from "@/lib/songes/ui";

export default async function SongesPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;

    const userContext = await getUserContext(guildId);

    // Module guard (verrou inclus) — le God garde l'accès (`bypassModules = isGod`)
    if (!userContext.isSuperAdmin && !await isModuleEnabled(guildId, "songes")) {
        redirect(`/dashboard/${guildId}`);
    }

    // RBAC: Check permission to view Songes
    if (!userContext.canViewSonges) {
        return <AccessDenied />;
    }


    const { runs } = await getDreamRuns(guildId, ["RECRUITING", "IN_PROGRESS", "COMPLETED"]);
    const currentUserId = userContext.isAuthenticated ? userContext.id : undefined;

    // Fetch Discord Config for the guild
    const { db } = await import("@/lib/prisma");
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { songesNotifyChannelId: true }
    });
    const isDiscordConfigured = !!guildConfig?.songesNotifyChannelId;

    return (
        <div className="space-y-6 pb-12">
            <div data-tour="songes-header">
                <UnifiedModuleHeader
                    title="Songes Infinis"
                    description="Suivez la progression des runs et rejoignez vos compagnons d'armes."
                    icon={Sparkles}
                    iconColor="#d946ef"
                    backHref={`/dashboard/${guildId}`}
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Un SEUL contenant pour les outils : items alignés, filets entre eux
                                (l'en-tête ne juxtapose plus des boutons étrangers). */}
                            <div data-tour="songes-guide" className={SONGES_ACTION_GROUP}>
                                <BossGuideLauncher />
                                <ModuleTourReplayButton phase="songes" appearance="grouped" />
                            </div>
                            {/* L'action principale est à part : elle seule porte l'accent. */}
                            {(userContext.canCreateSonges || userContext.isAdmin) && (
                                <span aria-hidden className="hidden sm:block w-px h-5 bg-border" />
                            )}
                            {(userContext.canCreateSonges || userContext.isAdmin) && (
                                <div data-tour="songes-create">
                                    <CreateRunButton guildId={guildId} isDiscordConfigured={isDiscordConfigured} />
                                </div>
                            )}
                        </div>
                    }
                />
            </div>

            {/* Active Runs Grid */}
            <Suspense fallback={<SongesGridSkeleton />}>
                <div data-tour="songes-board">
                    <RunCardGrid
                        runs={runs}
                        currentUserId={currentUserId}
                        canJoinSonges={userContext.canJoinSonges}
                        isAdmin={userContext.isAdmin}
                        isDiscordConfigured={isDiscordConfigured}
                    />
                </div>
            </Suspense>
        </div>
    );
}
