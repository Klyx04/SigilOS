"use client";

import { useEffect } from "react";
import { RefreshCw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reloadForStaleDeployment } from "@/lib/stale-deployment";

/**
 * Panneau de **décalage de build** — rendu par les frontières d'erreur
 * (`dashboard/[guildId]/error.tsx`, `god/error.tsx`, `global-error.tsx`) quand l'échec vient
 * d'un onglet resté ouvert pendant un déploiement (voir `src/lib/stale-deployment.ts`).
 *
 * Pourquoi un écran dédié plutôt que « Section Indisponible » : ce n'est **pas** une panne du
 * produit, et « Réessayer » est ici **inopérant** (le bundle en mémoire est périmé). On recharge
 * donc l'onglet automatiquement, une seule fois par fenêtre de garde ; au-delà, le bouton reste
 * à disposition (jamais de boucle de rechargement).
 */
export function StaleDeploymentPanel() {
    useEffect(() => {
        reloadForStaleDeployment();
    }, []);

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
            <div className="relative z-10 max-w-lg w-full animate-in fade-in zoom-in-95 duration-300 mt-8">
                <div className="bg-black/40 backdrop-blur-3xl border border-border p-8 md:p-12 rounded-[2.5rem] shadow-2xl text-center ring-1 ring-white/5">
                    <div className="mx-auto w-20 h-20 bg-info/10 rounded-[1.5rem] flex items-center justify-center mb-8 border border-info/20">
                        <Rocket className="w-10 h-10 text-info" />
                    </div>

                    <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground mb-4 drop-shadow-md">
                        Nouvelle version déployée
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-[95%] mx-auto">
                        Cet onglet utilise encore la version précédente de SigilOS (mise à jour
                        pendant votre visite). Le rechargement est automatique ; s&apos;il ne part
                        pas, lancez-le ci-dessous.
                    </p>

                    <Button
                        onClick={() => reloadForStaleDeployment() || window.location.reload()}
                        variant="sigil-destructive"
                        className="w-full sm:w-auto h-12 px-8"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        <span>Recharger la page</span>
                    </Button>
                </div>
            </div>

            <div className="mt-8 text-center opacity-40">
                <span className="text-caption font-black uppercase tracking-widest text-muted-foreground">
                    SigilOS • Mise à jour en attente
                </span>
            </div>
        </div>
    );
}
