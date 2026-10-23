"use client";

import { useState } from "react";
import { toggleLegendaryPet } from "@/server/actions/legendary-actions";
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
        <div className="space-y-4">
            <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <Image
                        src="/assets/icons/croquette.png"
                        alt="Croquette légendaire"
                        width={22}
                        height={22}
                        className="object-contain"
                    />
                    <h4 className="text-sm font-bold text-foreground">
                        Service Légendaire — Familier & Monture
                    </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Déclarez si vous pouvez rendre un familier, montilier ou une monture légendaire pour les membres de la guilde.
                </p>

                <a
                    href="https://www.dofuspourlesnoobs.com/les-animaux-fantastiques.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface/50 border border-border hover:bg-surface text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <span>Prérequis : Quête Les Animaux Fantastiques</span>
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>

            {/* Toggle — editable */}
            {!readOnly && (
                <div className="p-4 bg-surface/50 border border-border rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${canOffer ? "bg-warning/15 border-warning/30" : "bg-surface border-border"}`}>
                            <Image
                                src="/assets/icons/croquette.png"
                                alt="Croquette"
                                width={24}
                                height={24}
                                className={`object-contain ${canOffer ? "" : "grayscale opacity-40"}`}
                            />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-foreground">
                                Capacité de transmutation légendaire
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {canOffer
                                    ? "Activé — visible sur votre profil et dans l'annuaire"
                                    : "Non actif"}
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
            )}

            {/* Read-only view */}
            {readOnly && (
                <div className={`p-4 rounded-xl flex items-center gap-3 border ${canOffer ? "bg-surface/50 border-warning/30" : "bg-surface/20 border-border"}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${canOffer ? "bg-warning/15 border-warning/30" : "bg-surface border-border"}`}>
                        <Image
                            src="/assets/icons/croquette.png"
                            alt="Croquette"
                            width={22}
                            height={22}
                            className={`object-contain ${canOffer ? "" : "grayscale opacity-30"}`}
                        />
                    </div>
                    <div>
                        <p className={`text-xs font-semibold ${canOffer ? "text-warning" : "text-muted-foreground"}`}>
                            {canOffer ? "Propose le service légendaire" : "Service non proposé"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {canOffer
                                ? "Peut rendre un familier ou monture légendaire."
                                : "Ce membre ne propose pas ce service."}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
