import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { fetchGuildRoles } from "@/server/discord";
import { PermissionsManager } from "./_components/permissions-manager";
import { onboardGuild } from "@/server/actions/admin-actions";
import { redirect } from "next/navigation";
import { type PermissionId } from "@/lib/permissions";

export default async function AdminPage() {
    const session = await auth();
    if (!session?.user) redirect("/");

    // MVP: Target the guild defined in ENV
    const targetGuildId = process.env.DISCORD_GUILD_ID;

    if (!targetGuildId) {
        return (
            <div className="p-6 flex flex-col gap-4">
                <h1 className="text-2xl font-bold text-red-500">Configuration Missing</h1>
                <p className="text-muted-foreground">
                    Please add <code>DISCORD_GUILD_ID</code> to your <code>.env</code> file.
                    <br />
                    This is required for the MVP to know which Guild to manage.
                </p>
            </div>
        );
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
                    <h1 className="text-3xl font-bold tracking-tight">Panneau Admin</h1>
                    <p className="text-muted-foreground">
                        Gestion des permissions pour <span className="font-semibold text-foreground">{config.name}</span>
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
        </div>
    );
}
