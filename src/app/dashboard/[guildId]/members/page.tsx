import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getGuildMembers } from "@/server/actions/profile-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { MemberDirectory } from "@/components/directory/member-directory";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";
import { getInterGuildMembers } from "@/server/actions/inter-guild";
import { InterGuildMembers } from "./_components/inter-guild-members";

export default async function MembersPage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // RBAC: Check permission to view Roster
    const user = await getUserContext(guildId);
    if (!user.canViewRoster) {
        return <AccessDenied />;
    }

    const [response, legendaryItems, interGuild] = await Promise.all([
        getGuildMembers(guildId),
        db.legendaryItem.findMany({ orderBy: { name: "asc" } }),
        user.interGuildEnabled ? getInterGuildMembers(guildId) : Promise.resolve({ members: [], peerCount: 0 }),
    ]);

    if (!response.success) {
        return (
            <div className="p-8 text-center text-red-400">
                <p>Impossible de charger l'annuaire.</p>
                <p className="text-sm opacity-75">{response.error}</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <div data-tour="annuaire-header">
                <UnifiedModuleHeader
                    title="Annuaire de Guilde"
                    description="Retrouvez les artisans et membres de votre guilde."
                    imageSrc="/assets/ui/icons/members.png"
                    backHref={`/dashboard/${guildId}`}
                    actions={<ModuleTourReplayButton phase="annuaire" />}
                />
            </div>

            <div data-tour="annuaire-board">
                {user.interGuildEnabled && (
                    <div className="mb-6">
                        <InterGuildMembers members={interGuild.members} peerCount={interGuild.peerCount} />
                    </div>
                )}
                <MemberDirectory 
                    initialMembers={JSON.parse(JSON.stringify(response.data || []))} 
                    legendaryItems={JSON.parse(JSON.stringify(legendaryItems))}
                    guildId={guildId} 
                />
            </div>
        </div>
    );
}
