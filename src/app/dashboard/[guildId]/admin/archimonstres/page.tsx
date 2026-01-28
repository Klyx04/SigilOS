import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { MetamobSettingsClient } from "./_components/metamob-settings-client";
import { Bug } from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";

export default async function ArchimonstresAdminPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // Secure Access (RBAC) + Audit Log
    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
        await logAdminAccessDenied(guildId, "/admin/archimonstres");
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Configuration Metamob"
                description="Gérez la clé API pour la Bourse aux Archimonstres."
                imageSrc="/assets/ui/icons/archis.png"
                backHref={`/dashboard/${guildId}/admin/settings`}
            />

            {/* Divider */}
            <div className="border-b border-white/10" />

            {/* Info Card */}
            <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 flex gap-3">
                <Bug className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="text-amber-300 font-medium">Pourquoi configurer une clé API ?</p>
                    <p className="text-muted-foreground mt-1">
                        Une clé API spécifique à votre guilde permet d'éviter les limites de rate-limiting
                        partagées. Si non configurée, la clé globale de l'application sera utilisée.
                    </p>
                </div>
            </div>

            {/* Settings Component */}
            <MetamobSettingsClient guildId={guildId} />
        </div>
    );
}
