import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MarketCreateClient } from "../_components/market-create-client";
import { Store } from "lucide-react";

export const dynamic = "force-dynamic";

/** Création d'annonce (S1.21 → S1.33) — assistant multi-étapes (D28). */
export default async function MarketCreatePage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewMarket) {
        return <AccessDenied />;
    }
    if (!user.isAdmin && !(await isModuleEnabled(guildId, "marche"))) {
        redirect(`/dashboard/${guildId}`);
    }

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Publier une annonce"
                description="Choisis ton objet ou ton lot, fixe ton prix, puis publie. L'échange se conclut en jeu."
                icon={Store}
                iconColor="#eab308"
                backHref={`/dashboard/${guildId}/marche`}
                backLabel="Marché"
            />
            <MarketCreateClient guildId={guildId} />
        </div>
    );
}
