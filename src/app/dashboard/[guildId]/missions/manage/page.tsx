import { auth } from "@/auth";
import { MissionEditor } from "@/components/missions/mission-editor";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { BonusMenuButton } from "@/components/admin/BonusMenuButton";

export const dynamic = 'force-dynamic';

export default async function MissionsManagePage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");
    const { guildId } = await params;

    // RBAC: Check permission to manage missions
    const user = await getUserContext(guildId);
    if (!user.canManageMissions) {
        await logAdminAccessDenied(guildId, "/missions/manage");
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Gestion des Missions"
                description="Préparez et publiez les missions de la semaine pour la guilde."
                imageSrc="/assets/ui/icons/missions.png"
                backHref={`/dashboard/${guildId}/missions`}
            />

            <MissionEditor guildId={guildId} />
        </div>
    );
}
