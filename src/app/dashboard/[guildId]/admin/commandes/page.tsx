import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { db } from "@/lib/prisma";
import { fetchGuildRoles, fetchGuildChannels } from "@/server/discord";
import { getGuildSlashCommandPermissionsAction } from "@/server/actions/slash-command-actions";
import { SlashCommandsRbacPanel } from "@/components/admin/SlashCommandsRbacPanel";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Terminal, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
    title: "Admin Commandes Discord | SigilOS",
    description: "Configuration des permissions des commandes Slash Discord par rôle et par salon.",
};

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function AdminCommandesPage({ params }: Props) {
    const { guildId } = await params;
    const session = await auth();

    if (!session?.user) {
        redirect("/");
    }

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || (!user.isAdmin && !user.canManageRBAC)) {
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

    const [slashPermsRes, rawRoles, rawChannels] = await Promise.all([
        getGuildSlashCommandPermissionsAction(config.id),
        fetchGuildRoles(guildId).catch(() => []),
        fetchGuildChannels(guildId).catch(() => [])
    ]);

    const slashPerms = slashPermsRes.success && slashPermsRes.data ? slashPermsRes.data : [];

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
                title="Commandes Slash Discord"
                description={`Gérez les rôles et les salons autorisés à exécuter les commandes du bot pour ${config.name}`}
                icon={Terminal}
                backHref={`/dashboard/${guildId}/admin`}
                actions={
                    <Button asChild variant="outline" size="sm" className="gap-2 rounded-xl border-border text-xs font-bold">
                        <Link href={`/dashboard/${guildId}/commandes`}>
                            <Eye className="w-3.5 h-3.5 text-accent" />
                            Guide Visuel Membres
                        </Link>
                    </Button>
                }
            />

            <SlashCommandsRbacPanel
                guildId={config.id}
                initialMatrix={slashPerms}
                discordRoles={discordRoles}
                discordChannels={discordChannels}
            />
        </div>
    );
}
