import { Activity } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getPolls, checkCanCreatePoll, getMicroStatus, getPollSettings, getPollPublicConfig } from "@/server/actions/poll-actions";
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
    // 🔒 SECURITY: Admins use getPollSettings (full config), members use getPollPublicConfig (safe subset)
    const [pollsResult, canCreateResult, microStatusResult, pollSettingsResult, channels, roles] = await Promise.all([
        getPolls(guildId),
        checkCanCreatePoll(guildId),
        getMicroStatus(guildId),
        isAdmin
            ? getPollSettings(guildId).catch(() => ({ success: false as const, data: null }))
            : getPollPublicConfig(guildId).catch(() => ({ success: false as const, data: null })),
        // Only fetch full channel list for admins (members get restricted list below)
        isAdmin ? fetchGuildChannels(guildId).catch(() => [] as { id: string; name: string; type: number; position: number }[]) : Promise.resolve([] as { id: string; name: string; type: number; position: number }[]),
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

    // 🔒 SECURITY: Non-admins only see the admin-configured channel (if any).
    // Admins get the full text channel list for overrides.
    const adminConfiguredChannelId = pollSettingsResult.success && pollSettingsResult.data?.pollsNotifyChannelId
        ? pollSettingsResult.data.pollsNotifyChannelId
        : null;

    let textChannels: { id: string; name: string }[] = [];
    if (isAdmin) {
        // Admins: full list of text channels (type 0)
        textChannels = channels
            .filter((c) => c.type === 0)
            .map((c) => ({ id: c.id, name: c.name }));
    } else if (adminConfiguredChannelId) {
        // Members: only the channel configured by admin — fetch its name from the guild channels list
        // We need to fetch just that one channel; re-use the already-fetched list if admin, otherwise
        // we resolve the channel name from Discord via a targeted fetch.
        const allChannels = await fetchGuildChannels(guildId).catch(() => [] as { id: string; name: string; type: number; position: number }[]);
        const configuredChannel = allChannels.find((c) => c.id === adminConfiguredChannelId && c.type === 0);
        if (configuredChannel) {
            textChannels = [{ id: configuredChannel.id, name: configuredChannel.name }];
        }
    }

    // 🔒 SECURITY: Roles whitelist — only return whitelisted ping roles.
    // Admins get the full roles list; members only see what admin whitelisted.
    const pollsPingRoleIds: string[] = (pollSettingsResult.success && (pollSettingsResult.data as any)?.pollsPingRoleIds) || [];
    const allRoles = roles
        .filter((r) => r.name !== "@everyone")
        .map((r) => ({ id: r.id, name: r.name, color: (r as any).color ?? 0 }));

    const discordRoles = isAdmin
        ? allRoles
        : allRoles.filter((r) => pollsPingRoleIds.includes(r.id));

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
