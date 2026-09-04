import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { db } from "@/lib/prisma";
import { fetchGuildRoles, fetchGuildChannels } from "@/server/discord";
import { getGuildSlashCommandPermissionsAction } from "@/server/actions/slash-command-actions";
import { CommandsVisualGuide } from "@/components/commands/CommandsVisualGuide";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Terminal } from "lucide-react";

export const metadata = {
    title: "Guide des Commandes Discord | SigilOS",
    description: "Consultez le catalogue interactif des commandes slash Discord de votre guilde, la syntaxe et les canaux autorisés.",
};

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function CommandesBotPage({ params }: Props) {
    const { guildId } = await params;
    const session = await auth();

    if (!session?.user) {
        redirect("/");
    }

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember) {
        return <AccessDenied />;
    }

    if (!user.canViewCommands) {
        return <AccessDenied />;
    }

    const config = await db.guildConfig.findFirst({
        where: {
            OR: [
                { id: guildId },
                { discordGuildId: guildId }
            ]
        },
        select: { id: true, name: true, discordGuildId: true }
    });

    if (!config) {
        return <AccessDenied />;
    }

    const actualDiscordId = config.discordGuildId || (typeof guildId === "string" && /^\d+$/.test(guildId) ? guildId : "");

    const [permissions, rawRoles, rawChannels] = await Promise.all([
        db.guildSlashCommandPermission.findMany({
            where: { guildId: config.id }
        }),
        actualDiscordId ? fetchGuildRoles(actualDiscordId).catch(() => []) : [],
        actualDiscordId ? fetchGuildChannels(actualDiscordId).catch(() => []) : []
    ]);

    const { SLASH_COMMANDS_CATALOG } = await import("@/lib/slash-commands-catalog");
    const permMap = new Map(permissions.map(p => [p.commandName, p]));

    const matrix = SLASH_COMMANDS_CATALOG.map(cmd => {
        const existing = permMap.get(cmd.name);
        return {
            command: cmd,
            isEnabled: existing ? existing.isEnabled : true,
            roleIds: existing ? existing.roleIds : [],
            channelIds: existing ? existing.channelIds : []
        };
    });

    const discordRoles = rawRoles.map((r: any) => ({
        id: r.id,
        name: r.name,
        color: r.color
    }));

    const discordChannels = rawChannels
        .filter((c: any) => c.type === 0 || c.type === 5)
        .map((c: any) => ({
            id: c.id,
            name: c.name || "salon"
        }));

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Commandes Discord"
                description={`Explorez les commandes du bot SigilOS, leur syntaxe et les salons autorisés dans ${config.name}`}
                icon={Terminal}
                backHref={`/dashboard/${guildId}`}
            />

            <CommandsVisualGuide
                matrix={matrix}
                discordRoles={discordRoles}
                discordChannels={discordChannels}
                userRoleIds={user.roles || []}
                isAdmin={user.isAdmin}
                guildName={config.name}
            />
        </div>
    );
}
