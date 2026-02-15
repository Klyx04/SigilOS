import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { fetchGuildRoles } from "@/server/discord";
import { PermissionsManager } from "./_components/permissions-manager";
import { onboardGuild } from "@/server/actions/admin-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { type PermissionId } from "@/lib/permissions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Shield, Sparkles, ScrollText, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";


export default async function AdminPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const targetGuildId = guildId;

    // Secure Access (RBAC) + Audit Log
    const user = await getUserContext(targetGuildId);
    if (!user.isAdmin) {
        await logAdminAccessDenied(targetGuildId, "/admin");
        return <AccessDenied />;
    }

    if (!targetGuildId) {
        return <div>Invalid Guild ID</div>;
    }

    // Get or Create GuildConfig
    let config = await db.guildConfig.findUnique({
        where: { discordGuildId: targetGuildId }
    });

    if (!config) {
        // Auto-onboard for smoother DX
        const res = await onboardGuild(targetGuildId);
        if (!res.success) {
            return (
                <div className="p-6 text-red-500">
                    <h2 className="text-xl font-bold">Onboarding Failed</h2>
                    <p>{res.error}</p>
                </div>
            );
        }
        config = await db.guildConfig.findUnique({ where: { discordGuildId: targetGuildId } });
    }

    if (!config) return <div>Fatal: Configuration not found after onboarding.</div>;

    // Fetch Roles
    let roles;
    try {
        roles = await fetchGuildRoles(targetGuildId);
    } catch (e) {
        return (
            <div className="p-6 flex flex-col gap-4">
                <h1 className="text-2xl font-bold text-red-500">Discord Connection Failed</h1>
                <p>Could not fetch roles from Discord. Please verify:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                    <li><code>DISCORD_BOT_TOKEN</code> is correct in .env</li>
                    <li>Bot is invited to the server</li>
                    <li>Bot has "Manage Roles" or similar permissions if needed (usually just view is enough)</li>
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
                title="Gestion des Droits"
                description={`Configuration des permissions pour ${config.name}`}
                icon={Shield}
                backHref={`/dashboard/${guildId}`}
            />

            {/* Admin Module Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {/* Missions Card */}
                <Link href={`/dashboard/${guildId}/missions/manage`}>
                    <Card className="bg-card/20 border-border hover:border-blue-500/50 transition-all cursor-pointer group h-full hover:bg-card/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="group-hover:text-blue-400 transition-colors flex items-center gap-2 text-base">
                                <ScrollText className="w-5 h-5" />
                                Gérer les Missions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Créer et modifier les missions hebdomadaires.
                            </p>
                            <div className="mt-4 flex items-center text-xs text-blue-400 font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                Accéder à l'éditeur <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {/* Validation Card */}
                <Link href={`/dashboard/${guildId}/missions/validation`}>
                    <Card className="bg-card/20 border-border hover:border-green-500/50 transition-all cursor-pointer group h-full hover:bg-card/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="group-hover:text-green-400 transition-colors flex items-center gap-2 text-base">
                                <CheckCircle className="w-5 h-5" />
                                Valider Preuves
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Accepter ou refuser les soumissions des membres.
                            </p>
                            <div className="mt-4 flex items-center text-xs text-green-400 font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                Ouvrir la file <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {/* Bonus Management Card */}
                <Link href={`/dashboard/${guildId}/missions/manage#bonus`}>
                    <Card className="bg-card/20 border-border hover:border-amber-500/50 transition-all cursor-pointer group h-full hover:bg-card/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="group-hover:text-amber-400 transition-colors flex items-center gap-2 text-base">
                                <Sparkles className="w-5 h-5" />
                                Gérer les Bonus
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Acheter des bonus temporaires pour la guilde.
                            </p>
                            <div className="mt-4 flex items-center text-xs text-amber-400 font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                                Gérer les bonus <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <PermissionsManager
                guildId={targetGuildId}
                roles={roles}
                currentMapping={currentMapping}
            />
        </div>
    );
}
