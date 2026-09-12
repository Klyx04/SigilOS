import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getMyMarketData } from "@/server/actions/market-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MarketMySpaceClient } from "../_components/market-my-space-client";
import { Boxes } from "lucide-react";

export const dynamic = "force-dynamic";

/** « Mes espaces » (S1.23 / S1.31) — annonces actives et archives. */
export default async function MarketMySpacePage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewMarket) {
        return <AccessDenied />;
    }
    if (!user.isAdmin && !(await isModuleEnabled(guildId, "marche"))) {
        redirect(`/dashboard/${guildId}`);
    }

    const myRes = await getMyMarketData(guildId);
    const data = myRes.success && myRes.data
        ? JSON.parse(JSON.stringify(myRes.data))
        : { active: [], archived: [], receivedOffers: [], sentOffers: [] };

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Mes espaces"
                description="Tes annonces en cours et tes archives. Publie, retire, renouvelle ou supprime sans quitter cette page."
                icon={Boxes}
                iconColor="#eab308"
                backHref={`/dashboard/${guildId}/marche`}
                backLabel="Marché"
                compact
            />
            <MarketMySpaceClient
                guildId={guildId}
                active={data.active}
                archived={data.archived}
                received={data.receivedOffers}
                sent={data.sentOffers}
            />
        </div>
    );
}
