import { redirect } from "next/navigation";
import fs from "fs";
import path from "path";
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
    /**
     * 🎨 Une famille peut être **vide** en base (ex. cosmétique pas encore
     * siphonné) : on ne laisse jamais une carte sans vignette — on retombe sur
     * une autre famille réelle plutôt que sur une icône générique.
     */
    const equipmentIcons = firstIcon(equipment.items);
    const cosmeticIcons = firstIcon(cosmetic.items);
    const resourceIcons = firstIcon(resources.items);
    const anyIcon = [...equipmentIcons, ...resourceIcons, ...cosmeticIcons];

    /**
     * 🎨 **Tes assets priment** (retour user 15/09/2026) : dépose
     * `equipment.png`, `cosmetic.png`, `resource.png` (et `bundle.png`) dans
     * `public/assets/dofus/natures/` — ils sont utilisés **dès le rechargement**,
     * sans toucher au code. À défaut, la vignette est un **objet réel** du
     * catalogue local de la famille (mêmes artworks Dofus, clés par ankama id).
     */
    const localIcon = (name: string): string[] => {
        const relative = `/assets/dofus/natures/${name}.png`;
        return fs.existsSync(path.join(process.cwd(), "public", relative)) ? [relative] : [];
    };
    const equipmentFinal = [...localIcon("equipment"), ...equipmentIcons];
    const cosmeticFinal = [...localIcon("cosmetic"), ...cosmeticIcons];
    const resourceFinal = [...localIcon("resource"), ...resourceIcons];
    const bundleLocal = localIcon("bundle");

    const natureIcons = {
        EQUIPMENT: equipmentFinal.length > 0 ? equipmentFinal.slice(0, 1) : anyIcon.slice(0, 1),
        COSMETIC: cosmeticFinal.length > 0 ? cosmeticFinal.slice(0, 1) : anyIcon.slice(0, 1),
        RESOURCE: resourceFinal.length > 0 ? resourceFinal.slice(0, 1) : anyIcon.slice(0, 1),
        BUNDLE:
            bundleLocal.length > 0
                ? bundleLocal.slice(0, 1)
                : [
                      ...(equipmentFinal.length > 0 ? equipmentFinal.slice(0, 1) : anyIcon.slice(0, 1)),
                      ...(resourceFinal.length > 0 ? resourceFinal.slice(0, 1) : anyIcon.slice(1, 2)),
                      ...(cosmeticFinal.length > 0 ? cosmeticFinal.slice(0, 1) : anyIcon.slice(2, 3)),
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
