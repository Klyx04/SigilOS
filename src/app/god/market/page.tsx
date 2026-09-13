import { redirect } from "next/navigation";
import { ShoppingBag, Shield } from "lucide-react";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getGodMarketOverview } from "@/server/actions/god-market-actions";
import { GodMarketPanel } from "./_components/god-market-panel";

export const metadata = {
    title: "GOD | Marché",
    description: "Supervision plateforme du module Marché : indicateurs, santé Discord, médias, réglages et journal.",
};

/**
 * 🔒 S8.18 — onglet God « Marché » (§18).
 *
 * `isSuperAdmin()` **fail-closed** : la page ne protège **rien** (une server
 * action s'appelle directement), elle n'est qu'une première barrière — chaque
 * action de `god-market-actions.ts` re-garde. Les agrégats affichés sont
 * **cross-guild** : aucun sous-God, aucun admin de guilde n'y a accès.
 */
export default async function GodMarketPage() {
    const isGod = await isSuperAdmin();
    if (!isGod) redirect("/god");

    const result = await getGodMarketOverview();

    return (
        <div className="space-y-8 py-8">
            <div className="flex flex-col gap-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-caption font-semibold text-amber-400 uppercase tracking-wider w-fit">
                    <Shield className="w-3 h-3" />
                    Supervision plateforme
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                    <ShoppingBag className="w-7 h-7 text-warning" />
                    Marché — supervision
                </h1>
                <p className="text-muted-foreground max-w-2xl font-medium">
                    Vue d&apos;ensemble de toutes les guildes : annonces, réservations, offres, signalements, volume de
                    preuves, santé de la synchronisation Discord, réglages globaux et journal du marché.
                </p>
            </div>

            {result.success ? (
                <GodMarketPanel initialOverview={result.data} />
            ) : (
                <div className="p-6 rounded-2xl border border-danger/30 bg-danger/5 text-danger font-medium">
                    {result.error}
                </div>
            )}
        </div>
    );
}
