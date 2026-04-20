import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getPoll, checkUserHasPollRole, getPollSettings } from "@/server/actions/poll-actions";
import { PollDetail } from "@/components/sondages/poll-detail";
import { auth } from "@/auth";

export default async function PollDetailPage({
    params,
}: {
    params: Promise<{ guildId: string; pollId: string }>;
}) {
    const { guildId, pollId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewPolls) {
        return <AccessDenied />;
    }

    if (!user.isAdmin && !await isModuleEnabled(guildId, "polls")) {
        redirect(`/dashboard/${guildId}`);
    }

    const result = await getPoll(guildId, pollId);
    const session = await auth();
    const hasMicro = session?.user?.id ? await checkUserHasPollRole(guildId, session.user.id) : false;

    const settings = await getPollSettings(guildId);
    const isDiscordConfigured = !!settings.success && !!settings.data?.pollsNotifyChannelId;

    if (!result.success || !result.data) {
        redirect(`/dashboard/${guildId}/sondages`);
    }

    return (
        <div className="pb-12">
            <PollDetail
                poll={result.data as any}
                guildId={guildId}
                isAdmin={user.isAdmin}
                currentProfileId={user.profileId}
                hasMicro={hasMicro}
                isDiscordConfigured={isDiscordConfigured}
            />
        </div>
    );
}
