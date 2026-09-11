import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { listMarketReports, listWithdrawnMarketListings } from "@/server/actions/market-admin-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MarketModerationClient } from "../_components/market-moderation-client";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * « Modération du marché » (S4.11 · S5.8) — panneau des signalements
 * (`market:moderate`) et des annonces retirées.
 *
 * Base S4.11 : la liste des dossiers + leur classement + retrait/restauration de
 * l'annonce. S5.8 : vue des annonces **retirées** (avec ou sans signalement) et
 * historique d'audit par annonce, relu à la demande côté client.
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

    // Deux lectures indépendantes : une seule attente (§4.2).
    const [reportsRes, withdrawnRes] = await Promise.all([
        listMarketReports(guildId, "ALL"),
        listWithdrawnMarketListings(guildId),
    ]);
    const reports = reportsRes.success && reportsRes.data ? JSON.parse(JSON.stringify(reportsRes.data)) : [];
    const withdrawn =
        withdrawnRes.success && withdrawnRes.data ? JSON.parse(JSON.stringify(withdrawnRes.data)) : [];

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Modération du marché"
                description="Dossiers de signalement, annonces retirées, retrait et restauration. Chaque décision est journalisée dans l'audit de l'annonce."
                icon={ShieldAlert}
                iconColor="#eab308"
                backHref={`/dashboard/${guildId}/marche`}
                backLabel="Marché"
                compact
            />
            <MarketModerationClient guildId={guildId} reports={reports} withdrawn={withdrawn} />
        </div>
    );
}
