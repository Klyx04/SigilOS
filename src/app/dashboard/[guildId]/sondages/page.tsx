import { Activity } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getPolls, checkCanCreatePoll, getMicroStatus } from "@/server/actions/poll-actions";
import { PollList } from "@/components/sondages/poll-list";
import { PollCreator } from "@/components/sondages/poll-creator";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { fetchGuildChannels, fetchGuildRoles } from "@/server/discord";

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
    const [pollsResult, canCreateResult, microStatusResult, channels, roles] = await Promise.all([
        getPolls(guildId),
        checkCanCreatePoll(guildId),
        getMicroStatus(guildId),
        fetchGuildChannels(guildId).catch(() => [] as { id: string; name: string; type: number; position: number }[]),
        fetchGuildRoles(guildId, { excludeManaged: true }).catch(() => [] as { id: string; name: string; color: number }[]),
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

    // Text channels only (type 0) for Discord publish
    const textChannels = channels
        .filter((c) => c.type === 0)
        .map((c) => ({ id: c.id, name: c.name }));

    // Filter @everyone role
    const discordRoles = roles
        .filter((r) => r.name !== "@everyone")
        .map((r) => ({ id: r.id, name: r.name, color: (r as any).color ?? 0 }));

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Sondages"
                description="Votez et donnez votre avis sur les décisions de la guilde."
                icon={Activity}
                iconColor="#06b6d4"
                backHref={`/dashboard/${guildId}`}
                actions={
                    canCreate && (
                        <PollCreator
                            guildId={guildId}
                            discordChannels={textChannels}
                            discordRoles={discordRoles}
                            initialMicroStatus={microStatus}
                        />
                    )
                }
            />

            <PollList polls={polls} guildId={guildId} />
        </div>
    );
}
