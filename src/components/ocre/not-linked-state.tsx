"use client";

import { AlertCircle, Crown, Info } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { MetamobLink } from "@/components/profile/metamob-link";
import { Card, CardContent } from "@/components/ui/card";

interface NotLinkedStateProps {
    guildId: string;
    error?: string;
    metamobPseudo?: string | null;
    metamobVerified?: boolean;
    metamobLastSync?: Date | null;
}

export function NotLinkedState({ 
    guildId, 
    error, 
    metamobPseudo, 
    metamobVerified, 
    metamobLastSync 
}: NotLinkedStateProps) {
    const isNotLinked = error?.includes("Aucun compte Metamob") || 
                       error?.includes("Profil Metamob non lié.") || 
                       error?.includes("Compte non lié");

    if (isNotLinked) {
        return (
            <div className="max-w-3xl mx-auto py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-3">
                    <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-2">
                        <Crown className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Configuration Metamob</h2>
                    <p className="text-zinc-400 max-w-md mx-auto">
                        Pour synchroniser votre progression et trouver des partenaires d'échange, liez votre compte Metamob (V2).
                    </p>
                </div>

                <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-1 shadow-2xl overflow-hidden">
                    <MetamobLink 
                        guildId={guildId}
                        metamobPseudo={metamobPseudo}
                        metamobVerified={metamobVerified}
                        metamobLastSync={metamobLastSync}
                    />
                </div>

                <Card className="bg-blue-500/5 border-blue-500/20 rounded-2xl">
                    <CardContent className="p-4 flex gap-4 items-start">
                        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-blue-300/80 leading-relaxed">
                            <p className="font-bold text-blue-300 mb-1 uppercase tracking-widest text-[10px]">Pourquoi lier mon compte ?</p>
                            SigilOS utilise l'API Metamob pour récupérer vos archimonstres manquants en temps réel. 
                            Cela vous permet de voir instantanément qui dans votre guilde possède ce qu'il vous manque.
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-12">
            <EmptyState
                icon={AlertCircle}
                title="Erreur de chargement"
                description={error || "Impossible de charger vos données Metamob. Réessayez plus tard."}
                variant="premium"
                action={{
                    label: "Actualiser la page",
                    onClick: () => window.location.reload()
                }}
            />
        </div>
    );
}
