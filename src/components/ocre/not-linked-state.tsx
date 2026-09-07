"use client";

import { AlertCircle, Crown, EyeOff, Info, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { MetamobLink } from "@/components/profile/metamob-link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OcreSyncButton } from "@/components/ocre/ocre-sync-button";

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
    // Compte lié mais aucune quête visible : le cas typique est une quête
    // en privé sur Metamob (invisible pour SigilOS). Message grand public,
    // sans jargon technique, + actions qui débloquent vraiment.
    const isNoVisibleQuest = error === "NO_VISIBLE_QUEST" || error === "NO_QUEST";

    if (isNoVisibleQuest && metamobPseudo) {
        return (
            <div className="max-w-2xl mx-auto py-12">
                <div className="text-center space-y-4">
                    <div className="inline-flex p-3 rounded-2xl bg-warning/10 border border-warning/20 text-warning mb-2">
                        <EyeOff className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-black text-foreground tracking-tight">Aucune quête trouvée</h2>
                    <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                        Votre compte Metamob <strong className="text-foreground">{metamobPseudo}</strong> est
                        bien lié, mais SigilOS ne voit aucune quête.
                        Si votre quête est en <strong className="text-foreground">privé sur Metamob</strong>,
                        passez-la en <strong className="text-foreground">publique</strong> puis synchronisez.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                        <OcreSyncButton guildId={guildId} lastSync={metamobLastSync} />
                        <Button variant="outline" asChild>
                            <a
                                href={`https://www.metamob.fr/profile/${encodeURIComponent(metamobPseudo)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Ouvrir mon profil Metamob
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
            <div className="max-w-3xl mx-auto py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-3">
                    <div className="inline-flex p-3 rounded-2xl bg-warning/10 border border-warning/20 text-warning mb-2">
                        <Crown className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Configuration Metamob</h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Pour synchroniser votre progression et trouver des partenaires d'échange, liez votre compte Metamob (V2).
                    </p>
                </div>

                <div className="bg-surface/50 backdrop-blur-sm border border-border rounded-3xl p-1 shadow-2xl overflow-hidden">
                    <MetamobLink 
                        guildId={guildId}
                        metamobPseudo={metamobPseudo}
                        metamobVerified={metamobVerified}
                        metamobLastSync={metamobLastSync}
                    />
                </div>

                <Card className="bg-info/5 border-info/20 rounded-2xl">
                    <CardContent className="p-4 flex gap-4 items-start">
                        <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
                        <div className="text-caption text-info/80 leading-relaxed">
                            <p className="font-bold text-info mb-1 uppercase tracking-widest text-caption">Pourquoi lier mon compte ?</p>
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
