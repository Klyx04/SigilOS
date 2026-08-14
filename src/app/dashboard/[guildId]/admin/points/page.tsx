import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Coins } from "lucide-react";
import { PointsSettingsClient } from "../_components/points-settings-client";

export default async function AdminPointsPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const user = await getUserContext(guildId);

    if (!user.isMember) return <AccessDenied />;
    // RBAC : admin de guilde OU permission « Organisation d'Activités » (GAME_OPERATIONS)
    // qui couvre déjà Songes & Donjons/Quêtes — pas de visibilité pour un simple membre.
    if (!user.isAdmin && !user.canCreateSonges && !user.canViewFinder) return <AccessDenied />;

    return (
        <div className="p-6 space-y-6">
            <UnifiedModuleHeader
                title="Points de Contribution"
                description="Personnalisez les points attribués à la clôture des posts DJ / quêtes et des runs Songes."
                icon={Coins}
                iconColor="#f59e0b"
                backHref={`/dashboard/${guildId}/admin`}
            />
            <PointsSettingsClient guildId={guildId} />
        </div>
    );
}
