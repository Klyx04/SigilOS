import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getMarketListings } from "@/server/actions/market-actions";
import { db } from "@/lib/prisma";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";
import { MarketCatalogClient } from "./_components/market-catalog-client";
import { Store } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Module « Marché » — catalogue (S1.19 → S1.25).
 * Garde serveur : module actif + permission `market:trade` (§16.2).
 */
export default async function MarketPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewMarket) {
        return <AccessDenied />;
    }

    const isAdmin = user.isAdmin;
    if (!isAdmin && !(await isModuleEnabled(guildId, "marche"))) {
        redirect(`/dashboard/${guildId}`);
    }

    const [listingsRes, guildConfig] = await Promise.all([
        getMarketListings(guildId),
        db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { marketNotifyChannelId: true },
        }),
    ]);

    const listings = listingsRes.success ? JSON.parse(JSON.stringify(listingsRes.data || [])) : [];
    const channelConfigured = !!guildConfig?.marketNotifyChannelId;

    return (
        <div className="space-y-6 pb-12">
            <div data-tour="marche-header">
                <UnifiedModuleHeader
                    title="Marché"
                    description="Annonces d'équipements forgemagie et de lots de ressources entre membres. L'échange se conclut en jeu : SigilOS ne garantit pas la transaction."
                    icon={Store}
                    iconColor="#eab308"
                    backHref={`/dashboard/${guildId}`}
                    actions={<ModuleTourReplayButton phase="marche" />}
                />
            </div>

            <Suspense
                fallback={
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                        Chargement du marché…
                    </div>
                }
            >
                <MarketCatalogClient
                    guildId={guildId}
                    listings={listings}
                    canManage={user.canManageMarket}
                    isAdmin={isAdmin}
                    channelConfigured={channelConfigured}
                />
            </Suspense>
        </div>
    );
}
