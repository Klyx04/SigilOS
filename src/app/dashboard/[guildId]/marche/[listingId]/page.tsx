import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getMarketListing, getMarketPriceStats, getMarketListingDiscordState } from "@/server/actions/market-actions";
import { getItemCatalogEntry } from "@/lib/market/item-catalog";
import { MARKET_ITEM_FAMILY_LABELS, resolveMarketItemPolicy } from "@/lib/market/item-families";
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

    // S2.15/S2.18 — carte d'item (métadonnées catalogue + prix moyen guilde) et
    // S3.8 — état de synchronisation Discord (bandeau « à resynchroniser »).
    const [priceStatsRes, discordStateRes, catalogEntry] = await Promise.all([
        listing.dofusDbItemId ? getMarketPriceStats(guildId, listing.dofusDbItemId) : Promise.resolve(null),
        getMarketListingDiscordState(guildId, listingId),
        listing.dofusDbItemId ? getItemCatalogEntry(listing.dofusDbItemId) : Promise.resolve(null),
    ]);
    const averagePrice = priceStatsRes?.success ? priceStatsRes.data?.average ?? null : null;
    const discordState = discordStateRes.success ? discordStateRes.data ?? null : null;

    /**
     * Constat beta — la fiche doit dire la **vérité de l'objet** : nom réel du
     * catalogue, famille, et présence d'un **jet déclaré**. Tout est calculé
     * **côté serveur** (D17) : l'UI n'arbitre aucune règle métier, elle ne fait
     * qu'afficher (et le serveur reste seul juge à l'écriture, cf. T10).
     */
    const itemPolicy = catalogEntry
        ? resolveMarketItemPolicy({
              typeId: catalogEntry.typeId,
              superTypeId: catalogEntry.superTypeId,
              typeName: catalogEntry.typeName,
              category: catalogEntry.category,
          })
        : null;

    /** Un lot (ou un objet brut/cosmétique) n'a **jamais** de jet déclaré. */
    const declaredJet =
        listing.type === "EQUIPMENT" && listing.stats.length > 0 && (itemPolicy?.statEditorAllowed ?? true);

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
                canViewRoster={user.canViewRoster}
                averagePrice={averagePrice}
                itemSetName={catalogEntry?.itemSetName ?? null}
                realWeight={catalogEntry?.realWeight ?? null}
                itemDescription={catalogEntry?.description ?? null}
                /** Nom réel du catalogue (constat beta : « le nom n'est pas bon »). */
                itemName={catalogEntry?.name ?? listing.itemName ?? null}
                itemFamilyLabel={itemPolicy ? MARKET_ITEM_FAMILY_LABELS[itemPolicy.family] : null}
                declaredJet={declaredJet}
                discordState={discordState}
            />
        </div>
    );
}
