import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { fetchGuildRoles } from "@/server/discord";
import { PermissionsManager } from "./_components/permissions-manager";
import { onboardGuild } from "@/server/actions/admin-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { type PermissionId } from "@/lib/permissions";


export default async function AdminPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const targetGuildId = guildId;

    // Secure Access (RBAC)
    const user = await getUserContext(targetGuildId);
    if (!user.isAdmin) {
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
        <div className="p-6 space-y-8">
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestion des Droits</h1>
                    <p className="text-muted-foreground">
                        Configuration des permissions pour <span className="font-semibold text-foreground">{config.name}</span>
                    </p>
                </div>
                {config.iconUrl && (
                    <img src={config.iconUrl} alt="Guild Icon" className="w-12 h-12 rounded-full border" />
                )}
            </div>

            <PermissionsManager
                guildId={targetGuildId}
                roles={roles}
                currentMapping={currentMapping}
            />

            {/* Feature Settings Section */}
            <div className="border-t pt-8 mt-8">
                <h2 className="text-xl font-semibold mb-4">Paramètres des fonctionnalités</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <a
                        href={`/dashboard/${targetGuildId}/admin/absence`}
                        className="group block p-6 bg-zinc-900/60 border border-white/10 rounded-xl hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-cyan-500/10 rounded-lg">
                                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                                Notifications d'absence
                            </h3>
                        </div>
                        <p className="text-sm text-zinc-400">
                            Configurez le salon Discord pour les notifications de mode vacances.
                        </p>
                        <div className="mt-4 flex items-center text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Configurer</span>
                            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </a>

                    <a
                        href={`/dashboard/${targetGuildId}/admin/archimonstres`}
                        className="group block p-6 bg-zinc-900/60 border border-white/10 rounded-xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-all"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                                Clé API Metamob
                            </h3>
                        </div>
                        <p className="text-sm text-zinc-400">
                            Configurez une clé API Metamob spécifique à votre guilde.
                        </p>
                        <div className="mt-4 flex items-center text-xs text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Configurer</span>
                            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </a>

                    <a
                        href={`/dashboard/${targetGuildId}/admin/songes`}
                        className="group block p-6 bg-zinc-900/60 border border-white/10 rounded-xl hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                                Notifications Songes
                            </h3>
                        </div>
                        <p className="text-sm text-zinc-400">
                            Configurez le salon Discord pour les candidatures aux runs Songes.
                        </p>
                        <div className="mt-4 flex items-center text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Configurer</span>
                            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    );
}
