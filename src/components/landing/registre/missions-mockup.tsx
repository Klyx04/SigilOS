"use client";

import {
    MapPin,
    Copy,
    Check,
    Target,
    Users,
    Shield,
} from "lucide-react";
import { useState } from "react";

/**
 * MissionsMockup — Reproduction fidèle et vectorielle du Hall de Guilde et des coordonnées de ralliement.
 */
export function MissionsMockup() {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-full rounded-lg border border-border-strong bg-surface text-foreground font-sans overflow-hidden shadow-2xl">
            {/* Barre d'en-tête */}
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span>Missions de guilde</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                    <span className="text-emerald-400">Point de ralliement</span>
                </div>
            </div>

            <div className="p-4 space-y-3 bg-background/50">
                {/* Carte Hall de Guilde */}
                <div className="rounded border border-border bg-surface p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-muted/60 border border-border flex items-center justify-center text-foreground">
                                <Shield className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                                    Hall de Guilde
                                </h4>
                                <p className="text-[11px] text-muted-foreground font-mono">
                                    Village des Éleveurs · Koalaks
                                </p>
                            </div>
                        </div>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted border border-border text-foreground font-bold">
                            [-1, -1]
                        </span>
                    </div>

                    {/* Fausse mini-carte stylisée de repère de guilde */}
                    <div className="relative rounded border border-border bg-muted/30 p-3 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                            <div className="text-xs font-medium text-foreground">Coordonnées de ralliement</div>
                            <div className="text-[11px] text-muted-foreground">
                                Ravitaillement des enclos et rassemblement des sorties
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span>8 présents</span>
                        </div>
                    </div>

                    {/* Bouton de copie /travel */}
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded bg-muted hover:bg-muted/80 border border-border text-xs font-medium text-foreground transition-colors"
                    >
                        {copied ? (
                            <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Commande /travel [-1, -1] copiée dans le presse-papier !</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>Copier /travel [-1, -1]</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Pied de carte */}
            <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3.5 py-1.5 text-[10px] text-muted-foreground font-mono">
                <span>Ralliement automatique pour tout le groupe</span>
                <span>Compatible Dofus Unity</span>
            </div>
        </div>
    );
}
