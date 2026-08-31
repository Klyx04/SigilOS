import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Key } from "lucide-react";
import { GuildApiKeysManager } from "@/components/admin/GuildApiKeysManager";
import { getGuildApiKeysAction } from "@/server/actions/api-key-actions";

export default async function GuildApiKeysAdminPage({
    params
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const user = await getUserContext(guildId);

    if (!user.isAuthenticated || !user.isAdmin) {
        return <AccessDenied />;
    }

    const config = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, name: true }
    });

    if (!config) return <div>Guilde introuvable</div>;

    const keysRes = await getGuildApiKeysAction(config.id);

    return (
        <div className="space-y-8 pb-12">
            <UnifiedModuleHeader
                title="Clés d'API & Intégrations"
                description={`Gérez les jetons d'accès programmatiques sécurisés de ${config.name}`}
                icon={Key}
                backHref={`/dashboard/${guildId}/admin`}
            />

            <GuildApiKeysManager
                guildId={config.id}
                initialKeys={keysRes.success ? (keysRes.data as any) || [] : []}
            />
        </div>
    );
}
