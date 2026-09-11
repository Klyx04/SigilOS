import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { listMarketReports } from "@/server/actions/market-admin-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MarketModerationClient } from "../_components/market-moderation-client";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * « Modération du marché » (S4.11) — panneau des signalements (`market:moderate`).
 *
 * Base S4.11 : la liste des dossiers + leur classement + retrait/restauration de
 * l'annonce. Le dossier complet (filtres avancés, historique d'audit intégré)
 * est complété en S5.7.
 */
export default async function MarketModerationPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canManageMarket) {
        return <AccessDenied />;
    }
    if (!user.isAdmin && !(await isModuleEnabled(guildId, "marche"))) {
        redirect(`/dashboard/${guildId}`);
    }

    const reportsRes = await listMarketReports(guildId, "ALL");
    const reports = reportsRes.success && reportsRes.data ? JSON.parse(JSON.stringify(reportsRes.data)) : [];

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Modération du marché"
                description="Dossiers de signalement, retrait et restauration des annonces. Chaque décision est journalisée dans l'audit de l'annonce."
                icon={ShieldAlert}
                iconColor="#eab308"
                backHref={`/dashboard/${guildId}/marche`}
                backLabel="Marché"
                compact
            />
            <MarketModerationClient guildId={guildId} reports={reports} />
        </div>
    );
}
