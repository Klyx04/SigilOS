import { auth } from "@/auth";
import { MissionEditor } from "@/components/missions/mission-editor";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";

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
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Gestion des Missions</h1>
                <p className="text-zinc-400">Préparez et publiez les missions de la semaine.</p>
            </div>

            <MissionEditor guildId={guildId} />
        </div>
    );
}
