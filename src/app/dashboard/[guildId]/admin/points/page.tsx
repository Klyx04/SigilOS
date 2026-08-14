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
    // RBAC dédié « Gestion des Points de Contribution » (points:manage) — personne par défaut,
    // admin de guilde bypass (comme toutes les RBAC). Visible uniquement si accordé.
    if (!user.canManagePoints) return <AccessDenied />;

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
