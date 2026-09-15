import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { searchItems } from "@/lib/market/item-catalog";
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

    /**
     * 🎨 **Vrais assets du module** : les vignettes des natures sont des **objets
     * réellement siphonnés** dans le catalogue local Dofus (`GameItem`), servis
     * par le proxy d'assets — aucune illustration inventée, aucune icône
     * générique. Une famille vide ⇒ repli sur l'icône lucide côté assistant.
     *
     * Le « lot multiple » se dessine avec **trois** prises différentes, ce qui dit
     * exactement ce qu'il est : un lot hétérogène.
     */
    const [equipment, cosmetic, resources] = await Promise.all([
        searchItems({ family: "EQUIPMENT", pageSize: 1 }),
        searchItems({ family: "COSMETIC", pageSize: 1 }),
        searchItems({ family: "RESOURCES_OTHER", pageSize: 1 }),
    ]);
    const firstIcon = (items: { iconUrl: string | null }[]): string[] => {
        const url = items[0]?.iconUrl;
        return url ? [url] : [];
    };
    const natureIcons = {
        EQUIPMENT: firstIcon(equipment.items),
        COSMETIC: firstIcon(cosmetic.items),
        RESOURCE: firstIcon(resources.items),
        BUNDLE: [
            ...firstIcon(equipment.items),
            ...firstIcon(resources.items),
            ...firstIcon(cosmetic.items),
        ].slice(0, 3),
    };

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Publier une annonce"
                description="Comme à l'hôtel des ventes : tu exposes ton objet ou ton lot, tu fixes ton prix, et l'échange se conclut en jeu."
                icon={Store}
                iconColor="#eab308"
                backHref={`/dashboard/${guildId}/marche`}
                backLabel="Marché"
            />
            <MarketCreateClient guildId={guildId} natureIcons={natureIcons} />
        </div>
    );
}
