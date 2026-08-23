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
    // #66bis : l'accès à la matrice est ouvert aux admins Discord natifs ET aux
    // détenteurs de la permission RBAC « Gestion des Accès » (system:rbac), ce qui
    // permet à une guilde de désigner un successeur même sans rôle Discord Admin.
    if (!user.canManageRBAC) {
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
                <div className="p-6 text-danger">
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
                <h1 className="text-2xl font-bold text-danger">Discord Connection Failed</h1>
                <p>Could not fetch roles from Discord. Please verify:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                    <li><code>DISCORD_BOT_TOKEN</code> is correct in .env</li>
                    <li>Bot is invited to the server</li>
                </ul>
                <pre className="bg-surface text-foreground p-4 rounded mt-4 overflow-auto">
                    {String(e)}
                </pre>
            </div>
        );
    }

    const currentMapping = (config.rolesMapping || {}) as Record<string, PermissionId[]>;
    const currentUsersMapping = ((config as any).usersMapping || {}) as Record<string, PermissionId[]>;

    // Chantier #72 — kill-switch God « Membres Spécifiques » : quand la plateforme
    // désactive les permissions individuelles, on masque les sélecteurs par membre
    // (lecture seule) et l'écriture est rejetée côté serveur (fail-closed).
    const { getRbacUsersMappingEnabled } = await import("@/lib/platform-rbac");
    const rbacUsersMappingEnabled = await getRbacUsersMappingEnabled();

    return (
        <div className="space-y-8 pb-12">
            <div data-tour="admin-permissions-header">
                <UnifiedModuleHeader
                    title="Permissions"
                    description={`Attribuez les droits aux rôles Discord et aux membres de ${config.name}`}
                    icon={Shield}
                    backHref={`/dashboard/${guildId}/admin`}
                    actions={<AdminTourReplay phase="adminPermissions" />}
                />
            </div>
            <Alert className="bg-warning/10 border-warning/20 text-warning mb-8">
                <AlertTriangle className="h-5 w-5 !text-warning" />
                <AlertTitle className="pl-8 font-black uppercase tracking-widest text-warning">Accès restreint : qui peut gérer les permissions ?</AlertTitle>
                <AlertDescription className="pl-8 mt-2 leading-relaxed text-warning/90 font-medium">
                    Deux profils peuvent gérer cette matrice : les <strong>Administrateurs Discord</strong> (propriétaire ou permission native) et les détenteurs de la permission RBAC <strong>« Gestion des Accès »</strong> (<code>system:rbac</code>) — donnée par un administrateur pour désigner un successeur. Les permissions <strong>« Administrateur Suprême »</strong> et <strong>« Gestion des Accès »</strong> elles-mêmes restent réservées aux administrateurs Discord : un gestionnaire délégué ne peut pas les octroyer ni les révoquer (anti-escalade).
                </AlertDescription>
            </Alert>

            <div data-tour="admin-permissions-matrix">
                <PermissionsManager
                    guildId={guildId}
                    roles={roles}
                    members={membersData.members || []}
                    currentMapping={currentMapping}
                    currentUsersMapping={currentUsersMapping}
                    usersMappingEnabled={rbacUsersMappingEnabled}
                />
            </div>
        </div>
    );
}
