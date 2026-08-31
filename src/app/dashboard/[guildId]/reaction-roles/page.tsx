import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Sparkles, HelpCircle } from "lucide-react";
import { fetchGuildRoles, fetchGuildChannels } from "@/server/discord";
import { getReactionRoleGroupsAction } from "@/server/actions/reaction-role-actions";
import { ReactionRolesManager } from "@/components/reaction-roles/ReactionRolesManager";
import { db } from "@/lib/prisma";

export default async function ReactionRolesPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const user = await getUserContext(guildId);

    if (!user.canManageReactionRoles) {
        await logAdminAccessDenied(guildId, "/reaction-roles");
        return <AccessDenied />;
    }

    const [groupsRes, rawRoles, rawChannels] = await Promise.all([
        getReactionRoleGroupsAction(guildId),
        fetchGuildRoles(guildId, { excludeManaged: true }).catch(() => []),
        fetchGuildChannels(guildId).catch(() => []),
    ]);

    const groups = groupsRes.success && groupsRes.data ? groupsRes.data : [];

    // Filter text channels (type 0 = GUILD_TEXT, type 5 = GUILD_ANNOUNCEMENT)
    const channels = rawChannels
        .filter((c: any) => c.type === 0 || c.type === 5)
        .map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.type
        }));

    const roles = rawRoles.map((r: any) => ({
        id: r.id,
        name: r.name,
        color: r.color || 0,
        position: r.position || 0
    }));

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Rôles par Réaction & Menus"
                description="Gérez les panneaux de sélection de rôles Discord avec boutons, menus déroulants et attribution instantanée."
                icon={Sparkles}
                iconColor="#8b5cf6"
                backHref={`/dashboard/${guildId}/admin`}
            />

            <ReactionRolesManager
                guildId={guildId}
                initialGroups={groups}
                discordRoles={roles}
                discordChannels={channels}
            />
        </div>
    );
}
