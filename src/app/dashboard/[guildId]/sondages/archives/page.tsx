import { History } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import AccessDenied from "@/components/access-denied";
import { getPolls } from "@/server/actions/poll-actions";
import { PollList } from "@/components/sondages/poll-list";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";

export default async function PollArchivesPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewPolls) {
        return <AccessDenied />;
    }

    const pollsResult = await getPolls(guildId);
    const polls = pollsResult.success ? (pollsResult.data as any[]) : [];

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Archives des Sondages"
                description="Consultez l'historique des votes et les décisions passées du Sigil."
                icon={History}
                iconColor="#8b5cf6"
                backHref={`/dashboard/${guildId}/sondages`}
            />

            <PollList
                polls={polls}
                guildId={guildId}
                initialStatus="CLOSED"
            />
        </div>
    );
}
