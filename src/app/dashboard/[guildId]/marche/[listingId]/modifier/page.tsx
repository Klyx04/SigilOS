import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getMarketListing } from "@/server/actions/market-actions";
import { getLocalGameItemDetails } from "@/server/actions/game-item-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MarketCreateClient, type MarketForgeState, type MarketListingEditInitial } from "../../_components/market-create-client";
import { Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

/** Statuts dans lesquels une annonce reste modifiable (miroir de `updateMarketListing`). */
const EDITABLE_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED"] as const;

/**
 * S7.11 — **édition d'une annonce par son vendeur**.
 *
 * Le parcours est celui de la création (`MarketCreateClient`) en mode `edit` :
 * aucune duplication de l'assistant, et les **statuts éditables** sont les mêmes
 * que ceux acceptés par `updateMarketListing` (qui applique de toute façon sa
 * propre garde : c'est lui qui fait foi).
 */
export default async function MarketListingEditPage({
    params,
}: {
    params: Promise<{ guildId: string; listingId: string }>;
}) {
    const { guildId, listingId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewMarket) {
        return <AccessDenied />;
    }
    if (!user.isSuperAdmin && !(await isModuleEnabled(guildId, "marche"))) {
        redirect(`/dashboard/${guildId}`);
    }

    const listingRes = await getMarketListing(guildId, listingId);
    const listing = listingRes.success ? listingRes.data ?? null : null;
    if (!listing) {
        redirect(`/dashboard/${guildId}/marche`);
    }

    // Seul le **vendeur** peut ouvrir cet écran (revérifié côté serveur à l'écriture).
    if (!user.profileId || listing.profileId !== user.profileId) {
        redirect(`/dashboard/${guildId}/marche/${listingId}`);
    }
    // Statut non éditable (réservée / vendue / retirée) : on renvoie sur la fiche.
    if (!EDITABLE_STATUSES.includes(listing.status as (typeof EDITABLE_STATUSES)[number])) {
        redirect(`/dashboard/${guildId}/marche/${listingId}`);
    }
    // L'assistant couvre l'équipement, les lots de ressources **et** le 🧺 lot
    // multiple (décision user du 14/09/2026) ; les autres natures restent au MVP.
    if (
        listing.type !== "EQUIPMENT" &&
        listing.type !== "RESOURCE" &&
        listing.type !== "BUNDLE"
    ) {
        redirect(`/dashboard/${guildId}/marche/${listingId}`);
    }

    // L'objet vient du **catalogue** (jamais d'un item inventé) : on relit sa fiche
    // locale pour disposer des mêmes champs que la création (icône, niveau, plages).
    const itemRes = listing.dofusDbItemId
        ? await getLocalGameItemDetails(listing.dofusDbItemId)
        : null;
    const item = itemRes?.success ? itemRes.data ?? null : null;

    const initial: MarketListingEditInitial = {
        id: listing.id,
        type: listing.type,
        title: listing.title,
        description: listing.description,
        forgedBy: listing.forgedBy,
        priceKamas: listing.priceKamas,
        negotiable: listing.negotiable,
        acceptsTrade: listing.acceptsTrade,
        quantity: listing.quantity,
        unitLabel: listing.unitLabel,
        minQuantity: listing.minQuantity,
        item,
        stats: listing.stats.map((stat) => ({
            effectId: stat.effectId,
            characteristic: stat.characteristic,
            label: stat.label,
            naturalMin: stat.naturalMin,
            naturalMax: stat.naturalMax,
            actualValue: stat.actualValue,
            origin: stat.origin as "NATIVE" | "EXO",
        })),
        components: listing.components.map((component) => ({
            key: component.id,
            dofusDbItemId: component.dofusDbItemId,
            name: component.name,
            iconUrl: component.iconUrl,
            quantity: component.quantity,
            unitLabel: component.unitLabel,
            // 🧺 Lot multiple — le prix de **cet** objet est rejoué tel quel à
            // l'édition (les lots antérieurs restent à `null`).
            priceKamas: component.priceKamas ?? null,
        })),
        // S8.9/S8.10 — forge réelle déclarée (rejouée telle quelle à l'édition).
        forge: {
            transcendenceRuneId: listing.transcendenceRuneId,
            transcendenceLabel: listing.transcendenceLabel,
            strikeElement: listing.strikeElement as MarketForgeState["strikeElement"],
            elementPotionId: listing.elementPotionId,
            elementPotionTier: listing.elementPotionTier,
            huntingWeapon: listing.huntingWeapon ?? "",
        },
    };

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Modifier l'annonce"
                description="Corrige l'objet, le jet, les quantités ou le prix. L'échange se conclut toujours en jeu."
                icon={Pencil}
                iconColor="#eab308"
                backHref={`/dashboard/${guildId}/marche/${listingId}`}
                backLabel="Fiche de l'annonce"
                compact
            />
            <MarketCreateClient guildId={guildId} initial={initial} />
        </div>
    );
}
