import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { MetamobSettingsClient } from "./_components/metamob-settings-client";
import Link from "next/link";
import { ArrowLeft, Bug } from "lucide-react";

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
        <div className="p-6 space-y-6 max-w-2xl">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href={`/dashboard/${guildId}/admin`}
                    className="p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Configuration Metamob</h1>
                    <p className="text-muted-foreground">
                        Gérez la clé API pour la Bourse aux Archimonstres
                    </p>
                </div>
            </div>

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
