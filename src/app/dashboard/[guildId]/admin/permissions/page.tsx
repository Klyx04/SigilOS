import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { fetchGuildRoles } from "@/server/discord";
import { PermissionsManager } from "@/app/dashboard/[guildId]/admin/_components/permissions-manager";
import { onboardGuild } from "@/server/actions/admin-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext, getGuildMembers } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { type PermissionId } from "@/lib/permissions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { AdminTourReplay } from "@/components/tour/admin-tour-replay";
import { Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function PermissionsPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.isDiscordAdmin) {
        await logAdminAccessDenied(guildId, "/admin/permissions");
        return <AccessDenied />;
    }

    let config = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
    });

    if (!config) {
        const res = await onboardGuild(guildId);
        if (!res.success) {
            return (
                <div className="p-6 text-red-500">
                    <h2 className="text-xl font-bold">Onboarding Failed</h2>
                    <p>{res.error}</p>
                </div>
            );
        }
        config = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
    }

    if (!config) return <div>Fatal: Configuration not found after onboarding.</div>;

    let roles: any[] = [];
    let membersData: any = { members: [] };
    try {
        roles = await fetchGuildRoles(guildId);
        membersData = await getGuildMembers(guildId);
    } catch (e) {
        return (
            <div className="p-6 flex flex-col gap-4">
                <h1 className="text-2xl font-bold text-red-500">Discord Connection Failed</h1>
                <p>Could not fetch roles from Discord. Please verify:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                    <li><code>DISCORD_BOT_TOKEN</code> is correct in .env</li>
                    <li>Bot is invited to the server</li>
                </ul>
                <pre className="bg-neutral-900 text-neutral-100 p-4 rounded mt-4 overflow-auto">
                    {String(e)}
                </pre>
            </div>
        );
    }

    const currentMapping = (config.rolesMapping || {}) as Record<string, PermissionId[]>;
    const currentUsersMapping = ((config as any).usersMapping || {}) as Record<string, PermissionId[]>;

    return (
        <div className="space-y-8 pb-12">
            <div data-tour="admin-permissions-header">
                <UnifiedModuleHeader
                    title="Permissions"
                    description={`Attribuez les droits aux rôles Discord et aux membres de ${config.name}`}
                    icon={Shield}
                    backHref={`/dashboard/${guildId}/admin`}
                    actions={<AdminTourReplay user={user} />}
                />
            </div>
            <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-lg mb-8">
                <AlertTriangle className="h-5 w-5 !text-amber-500" />
                <AlertTitle className="pl-8 font-black uppercase tracking-widest text-amber-500">Accès Restreint : Administrateurs Discord</AlertTitle>
                <AlertDescription className="pl-8 mt-2 leading-relaxed text-amber-500/90 font-medium">
                    L'accès à cette page de gestion des permissions (RBAC) est <strong>strictement réservé au Propriétaire du serveur Discord et à ses Administrateurs</strong> (permission native Discord). Il n'est pas possible d'assigner l'accès à ce système via la matrice ci-dessous afin de prévenir toute usurpation de privilèges.
                </AlertDescription>
            </Alert>

            <div data-tour="admin-permissions-matrix">
                <PermissionsManager
                    guildId={guildId}
                    roles={roles}
                    members={membersData.members || []}
                    currentMapping={currentMapping}
                    currentUsersMapping={currentUsersMapping}
                />
            </div>
        </div>
    );
}
