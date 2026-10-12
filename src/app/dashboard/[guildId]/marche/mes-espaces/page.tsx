import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getMyMarketData } from "@/server/actions/market-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MarketMySpaceClient } from "../_components/market-my-space-client";
import { Boxes } from "lucide-react";

export const dynamic = "force-dynamic";

/** « Mon espace » (S1.23 / S1.31) — annonces actives et archives. */
export default async function MarketMySpacePage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewMarket) {
        return <AccessDenied />;
    }
    if (!user.isSuperAdmin && !(await isModuleEnabled(guildId, "marche"))) {
        redirect(`/dashboard/${guildId}`);
    }

    const myRes = await getMyMarketData(guildId);
    const data = myRes.success && myRes.data
        ? JSON.parse(JSON.stringify(myRes.data))
        : { active: [], archived: [], receivedOffers: [], sentOffers: [] };

    /**
     * S8.14 — DTO **minimal** du membre courant pour la bulle profil (bulle
     * « avatar + pseudo » mutualisée) : `id` = `UserProfile.id` **interne**, jamais
     * un identifiant Discord. Aucune requête ajoutée (le contexte est déjà là).
     */
    const viewer = user.profileId
        ? {
              id: user.profileId,
              name: user.pseudoDofus?.trim() || user.name || "Membre",
              image: user.image ?? null,
          }
        : null;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Mon espace"
                description="Tes annonces en cours et tes archives. Publie, retire, renouvelle ou supprime sans quitter cette page."
                icon={Boxes}
                iconColor="#eab308"
                backHref={`/dashboard/${guildId}/marche`}
                backLabel="Marché"
                compact
            />
            <MarketMySpaceClient
                guildId={guildId}
                viewer={viewer}
                active={data.active}
                archived={data.archived}
                received={data.receivedOffers}
                sent={data.sentOffers}
            />
        </div>
    );
}
