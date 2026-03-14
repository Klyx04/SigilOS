import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { Shield, Bell } from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import AccessDenied from "@/components/access-denied";
import { RelanceClient } from "@/components/admin/relance/relance-client";
import { fetchGuildChannels, fetchGuildRoles } from "@/server/discord";
import { getRelanceHistory } from "@/server/actions/relance-actions";

export const dynamic = "force-dynamic";

export default async function RelancePage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const user = await getUserContext(guildId);

    if (!user.isAdmin) {
        return <AccessDenied />;
    }

    // Fetch initial data
    const [channels, roles, historyRes] = await Promise.all([
        fetchGuildChannels(guildId),
        fetchGuildRoles(guildId),
        getRelanceHistory(guildId)
    ]);

    const textChannels = (channels || []).filter(c => c.type === 0 || c.type === 5); // Text or Announcement
    const history = historyRes.success ? historyRes.data : [];

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Gestion des Relances"
                description="Pingez les membres absents, gérez les rôles et gardez votre guilde active."
                icon={Bell}
                iconColor="#f43f5e"
                backHref={`/dashboard/${guildId}/admin`}
            />

            <div className="px-4 lg:px-8">
                <RelanceClient 
                    guildId={guildId} 
                    channels={textChannels as any}
                    roles={roles || []}
                    initialHistory={history || []}
                />
            </div>
        </div>
    );
}
