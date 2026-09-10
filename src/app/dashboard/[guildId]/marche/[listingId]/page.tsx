import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getMarketListing } from "@/server/actions/market-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MarketListingClient } from "../_components/market-listing-client";
import { Store } from "lucide-react";

export const dynamic = "force-dynamic";

/** Fiche d'une annonce (S1.22) + actions vendeur. */
export default async function MarketListingPage({
    params,
}: {
    params: Promise<{ guildId: string; listingId: string }>;
}) {
    const { guildId, listingId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewMarket) {
        return <AccessDenied />;
    }
    if (!user.isAdmin && !(await isModuleEnabled(guildId, "marche"))) {
        redirect(`/dashboard/${guildId}`);
    }

    const listingRes = await getMarketListing(guildId, listingId);
    if (!listingRes.success || !listingRes.data) {
        redirect(`/dashboard/${guildId}/marche`);
    }

    const listing = JSON.parse(JSON.stringify(listingRes.data));
    const isOwner = listing.profileId === user.profileId;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title={listing.title}
                description={`Annonce ${listing.type === "RESOURCE" ? "de ressources" : "d'équipement"} · publiée sur le marché de la guilde`}
                icon={Store}
                iconColor="#eab308"
                backHref={`/dashboard/${guildId}/marche`}
                backLabel="Marché"
                compact
            />
            <MarketListingClient
                guildId={guildId}
                listing={listing}
                isOwner={isOwner}
                canManage={user.canManageMarket}
            />
        </div>
    );
}
