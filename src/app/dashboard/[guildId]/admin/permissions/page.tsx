import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { fetchGuildRoles } from "@/server/discord";
import { PermissionsManager } from "../_components/permissions-manager";
import { onboardGuild } from "@/server/actions/admin-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { type PermissionId } from "@/lib/permissions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Shield } from "lucide-react";

export default async function PermissionsPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
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

    let roles;
    try {
        roles = await fetchGuildRoles(guildId);
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

    return (
        <div className="space-y-8 pb-12">
            <UnifiedModuleHeader
                title="Permissions"
                description={`Attribuez les droits aux rôles Discord de ${config.name}`}
                icon={Shield}
                backHref={`/dashboard/${guildId}/admin`}
            />
            <PermissionsManager
                guildId={guildId}
                roles={roles}
                currentMapping={currentMapping}
            />
        </div>
    );
}
