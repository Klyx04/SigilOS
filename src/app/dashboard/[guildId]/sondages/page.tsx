import { Activity } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getPolls, checkCanCreatePoll, getMicroStatus, getPollSettings, getPollPublicConfig } from "@/server/actions/poll-actions";
import { PollList } from "@/components/sondages/poll-list";
import { PollCreator } from "@/components/sondages/poll-creator";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

export default async function PollsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewPolls) {
        return <AccessDenied />;
    }

    const isAdmin = user.isAdmin;
    if (!isAdmin && !await isModuleEnabled(guildId, "polls")) {
        redirect(`/dashboard/${guildId}`);
    }

    // Fetch everything in parallel
    // 🔒 SECURITY: Admins use getPollSettings (full config), members use getPollPublicConfig (safe subset)
    const [pollsResult, canCreateResult, microStatusResult, pollSettingsResult] = await Promise.all([
        getPolls(guildId),
        checkCanCreatePoll(guildId),
        getMicroStatus(guildId),
        isAdmin
            ? getPollSettings(guildId).catch(() => ({ success: false as const, data: null }))
            : getPollPublicConfig(guildId).catch(() => ({ success: false as const, data: null })),
    ]);

    const polls = pollsResult.success ? (pollsResult.data as any[]) : [];
    const canCreate = canCreateResult.data?.canCreate || false;
    const microStatus = microStatusResult.success && microStatusResult.data ? {
        holder: microStatusResult.data.holder,
        expiresAt: microStatusResult.data.expiresAt,
        isMicroHolder: microStatusResult.data.isMicroHolder,
        isAdmin: microStatusResult.data.isAdmin,
        isSuperAdmin: microStatusResult.data.isSuperAdmin,
    } : null;

    // 🔒 SECURITY: La whitelist des salons ET des rôles de ping est appliquée côté
    // composant PollCreator via getPollSettings/getDiscordRolesAction (pattern DJ/songes),
    // de façon identique pour les admins et les membres (fail-closed).
    // Plus de fetch de salons/rôles ici : allégé et supprime le bypass admin.

    return (
        <div className="space-y-6 pb-12">
            <div data-tour="sondages-header">
                <UnifiedModuleHeader
                    title="Sondages"
                    description="Votez et donnez votre avis sur les décisions de la guilde."
                    icon={Activity}
                    iconColor="#06b6d4"
                    backHref={`/dashboard/${guildId}`}
                    actions={
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            {canCreate && (
                                <div data-tour="sondages-create">
                                    <PollCreator
                                        guildId={guildId}
                                        initialMicroStatus={microStatus}
                                    />
                                </div>
                            )}
                            <ModuleTourReplayButton phase="sondages" />
                        </div>
                    }
                />
            </div>

            <div data-tour="sondages-board">
                <PollList polls={polls} guildId={guildId} />
            </div>
        </div>
    );
}
