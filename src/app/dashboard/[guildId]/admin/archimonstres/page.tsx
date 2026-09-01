import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { MetamobUnlocker } from "./_components/metamob-unlocker";
import { Crown } from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

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
                title="Gestion de la Bourse aux Archimonstres"
                description="Outils d'administration pour le module Metamob."
                imageSrc="/assets/ui/icons/archis.png"
                backHref={`/dashboard/${guildId}/admin/settings`}
                actions={<ModuleHelpActions docSlug="quete-ocre" docTitle="Gestion Archimonstres & Ocre" tourPhase="ocre" />}
            />

            {/* Divider */}
            <div className="border-b border-border" />

            {/* Info Card */}
            <div className="p-4 rounded-lg bg-info/5 border border-info/20 flex gap-3">
                <div className="text-sm">
                    <p className="text-info font-medium">Clés API individuelles</p>
                    <p className="text-muted-foreground mt-1">
                        Désormais, SigilOS utilise uniquement les clés API renseignées par chaque membre sur leur profil. 
                        La clé de guilde globale a été supprimée pour plus de sécurité et de flexibilité.
                    </p>
                </div>
            </div>

            {/* Unlocker Tool */}
            <MetamobUnlocker guildId={guildId} />
        </div>
    );
}
