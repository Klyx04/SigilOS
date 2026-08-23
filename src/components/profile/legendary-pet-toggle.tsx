"use client";

import { useState } from "react";
import { toggleLegendaryPet } from "@/server/actions/legendary-actions";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import Image from "next/image";

interface LegendaryPetToggleProps {
    guildId: string;
    initialValue?: boolean;
    readOnly?: boolean;
}

export function LegendaryPetToggle({ guildId, initialValue = false, readOnly = false }: LegendaryPetToggleProps) {
    const [canOffer, setCanOffer] = useState(initialValue);
    const [loading, setLoading] = useState(false);

    const handleToggle = async (enabled: boolean) => {
        if (readOnly || loading) return;
        setCanOffer(enabled);
        setLoading(true);

        const res = await toggleLegendaryPet(guildId, enabled);
        if (!res.success) {
            toast.error(res.error || "Erreur lors de la mise à jour");
            setCanOffer(!enabled); // rollback
        } else {
            toast.success(enabled ? "Service légendaire déclaré ✨" : "Statut retiré");
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter text-foreground">
                    <Image
                        src="/assets/icons/croquette.png"
                        alt="Croquette légendaire"
                        width={28}
                        height={28}
                        className="object-contain drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                    />
                    Service Légendaire — Familier & Monture
                </div>
                <p className="text-muted-foreground text-sm">
                    Déclarez si vous êtes en mesure de <strong className="text-foreground">rendre un familier, montilier ou une monture légendaire</strong> pour d'autres membres de la guilde.
                    Cela implique d'avoir complété la quête prérequis et de posséder les croquettes nécessaires.
                </p>

                {/* Prerequisite quest link card */}
                <a
                    href="https://www.dofuspourlesnoobs.com/les-animaux-fantastiques.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 group flex items-center gap-3 p-3 rounded-xl bg-surface/60 border border-border hover:border-warning/30 hover:bg-warning/5 transition-all duration-300"
                >
                    {/* Dofus pour les noobs miniature */}
                    <div className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-border bg-elevated flex items-center justify-center">
                        <Image
                            src="https://www.dofuspourlesnoobs.com/favicon.ico"
                            alt="Dofus pour les noobs"
                            width={32}
                            height={32}
                            className="object-contain"
                            unoptimized
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-caption font-black uppercase tracking-widest text-warning/80 group-hover:text-warning transition-colors">
                            Prérequis — Les Animaux Fantastiques
                        </p>
                        <p className="text-caption text-muted-foreground truncate mt-0.5">
                            dofuspourlesnoobs.com · Guide complet de la quête
                        </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-warning transition-colors shrink-0" />
                </a>
            </div>

            {/* Toggle — editable */}
            {!readOnly && (
                <Card className="p-6 bg-surface/40 border-border rounded-2xl">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 flex items-center gap-4">
                            <div className={`relative w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border transition-all duration-300 ${canOffer ? "bg-warning/15 border-warning/40 " : "bg-elevated/50 border-border"}`}>
                                <Image
                                    src="/assets/icons/croquette.png"
                                    alt="Croquette"
                                    width={36}
                                    height={36}
                                    className={`object-contain transition-all duration-300 ${canOffer ? "drop-shadow-[0_0_10px_rgba(251,191,36,0.8)] scale-110" : "grayscale opacity-40"}`}
                                />
                            </div>
                            <div>
                                <h4 className="text-foreground font-bold uppercase tracking-widest text-sm">
                                    Peut rendre un familier / monture légendaire
                                </h4>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {canOffer
                                        ? "✅ Vous proposez ce service — les membres peuvent vous contacter."
                                        : "Activez si vous avez complété la quête et pouvez offrir ce service."}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={canOffer}
                            onCheckedChange={handleToggle}
                            disabled={loading}
                            className="data-[state=checked]:bg-warning"
                        />
                    </div>
                </Card>
            )}

            {/* Read-only view */}
            {readOnly && (
                <Card className={`p-6 rounded-2xl flex items-center gap-4 ${canOffer ? "bg-warning/10 border-warning/30" : "bg-surface/20 border-border"}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${canOffer ? "bg-warning/15 border-warning/30" : "bg-elevated/30 border-border"}`}>
                        <Image
                            src="/assets/icons/croquette.png"
                            alt="Croquette"
                            width={32}
                            height={32}
                            className={`object-contain ${canOffer ? "drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "grayscale opacity-30"}`}
                        />
                    </div>
                    <div>
                        <p className={`font-bold text-sm uppercase tracking-widest ${canOffer ? "text-warning" : "text-muted-foreground"}`}>
                            {canOffer ? "Propose le service légendaire" : "Service non disponible"}
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                            {canOffer
                                ? "Ce joueur peut rendre un familier, montilier ou monture légendaire."
                                : "Ce joueur ne propose pas ce service."}
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
}
