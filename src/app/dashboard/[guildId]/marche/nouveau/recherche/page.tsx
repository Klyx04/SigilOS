import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getMarketListing } from "@/server/actions/market-actions";
import { getLocalGameItemDetails } from "@/server/actions/game-item-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MarketWantedCreateClient } from "../../_components/market-wanted-create-client";
import type { GameItemSearchResult } from "@/server/actions/game-item-actions";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Lot M1 — recherche d'achat (WANTED) : création (`/nouveau/recherche`) et
 * édition (`?id=`, depuis la modale `modifier` qui redirige ici les WANTED).
 */
export default async function MarketWantedCreatePage({
    params,
    searchParams,
}: {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ id?: string }>;
}) {
    const { guildId } = await params;
    const { id } = await searchParams;

    const user = await getUserContext(guildId);
    if (!user.canViewMarket) {
        return <AccessDenied />;
    }
    if (!user.isSuperAdmin && !(await isModuleEnabled(guildId, "marche"))) {
        redirect(`/dashboard/${guildId}`);
    }

    let initial = null;
    if (id) {
        const listingRes = await getMarketListing(guildId, id);
        const listing = listingRes.success ? (listingRes.data ?? null) : null;
        if (!listing || listing.type !== "WANTED") {
            redirect(`/dashboard/${guildId}/marche`);
        }
        if (!user.profileId || listing.profileId !== user.profileId) {
            redirect(`/dashboard/${guildId}/marche/${id}`);
        }
        if (!["DRAFT", "ACTIVE", "EXPIRED"].includes(listing.status)) {
            redirect(`/dashboard/${guildId}/marche/${id}`);
        }
        const itemRes = listing.dofusDbItemId ? await getLocalGameItemDetails(listing.dofusDbItemId) : null;
        const item = (itemRes?.success ? (itemRes.data ?? null) : null) as GameItemSearchResult | null;
        initial = {
            id: listing.id,
            title: listing.title,
            description: listing.description,
            priceKamas: listing.priceKamas,
            negotiable: listing.negotiable,
            quantity: listing.quantity,
            unitLabel: listing.unitLabel,
            item,
            wantedTranscendence: (listing as { wantedTranscendence?: string }).wantedTranscendence === "REQUIRED" ||
                (listing as { wantedTranscendence?: string }).wantedTranscendence === "FORBIDDEN"
                ? ((listing as { wantedTranscendence?: string }).wantedTranscendence as "REQUIRED" | "FORBIDDEN")
                : ("ANY" as const),
            criteria: ((listing as { wantedCriteria?: { effectId: number; characteristic: number | null; label: string; minValue: number; exo: boolean }[] }).wantedCriteria ?? []).map(
                (criterion) => ({
                    effectId: criterion.effectId,
                    characteristic: criterion.characteristic,
                    label: criterion.label,
                    minValue: criterion.minValue,
                    exo: criterion.exo,
                })
            ),
        };
    }

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title={id ? "Modifier ma recherche" : "Recherche d'achat"}
                description="Décris ce que tu veux acheter (objet, budget max, exo / over / forge) : les vendeurs te proposent, tu tranches."
                icon={Search}
                iconColor="#3b82f6"
                backHref={`/dashboard/${guildId}/marche`}
                backLabel="Marché"
            />
            <MarketWantedCreateClient guildId={guildId} initial={initial} />
        </div>
    );
}
