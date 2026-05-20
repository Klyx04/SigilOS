import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { getGuildModules } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Puzzle, ShieldAlert } from "lucide-react";
import { db } from "@/lib/prisma";
import Link from "next/link";
import { ModulesClient } from "./_components/modules-client";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function AdminModulesPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.isDiscordAdmin) {
        await logAdminAccessDenied(guildId, "/admin/modules");
        return <AccessDenied />;
    }

    const modules = await getGuildModules(guildId);
    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { rolesMapping: true }
    });
    const rolesMapping = (guild?.rolesMapping as Record<string, string[]>) || {};
    const isRbacConfigured = Array.isArray(rolesMapping["dashboard:login"]) && rolesMapping["dashboard:login"].length > 0;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Modules"
                description="Activez ou désactivez les fonctionnalités de votre guilde"
                icon={Puzzle}
                backHref={`/dashboard/${guildId}/admin`}
            />

            {!isRbacConfigured && (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
                    <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                        <h3 className="text-amber-400 font-black text-sm uppercase tracking-wide">Rôles Discord Requis</h3>
                        <p className="text-amber-500/80 text-xs font-medium">
                            Vous devez configurer au moins un rôle Discord pour l'accès au Dashboard avant de pouvoir activer de nouveaux modules pour vos membres.
                        </p>
                        <Link
                            href={`/dashboard/${guildId}/admin/permissions`}
                            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-amber-500 text-amber-950 text-xs font-bold uppercase tracking-wider hover:bg-amber-400 transition-colors"
                        >
                            Configurer les rôles
                        </Link>
                    </div>
                </div>
            )}

            <ModulesClient guildId={guildId} initialModules={modules} />
        </div>
    );
}
