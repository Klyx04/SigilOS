"use client";

import { useState } from "react";
import { Home, Copy, Check, ShieldAlert } from "lucide-react";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { toast } from "sonner";

interface GuildHallWidgetProps {
    posX: number | null;
    posY: number | null;
    worldId: number | null;
    guildId: string;
}

export function GuildHallWidget({ posX, posY, worldId }: GuildHallWidgetProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (posX === null || posY === null) return;
        const cmd = `/travel ${posX} ${posY}`;
        navigator.clipboard.writeText(cmd);
        setCopied(true);
        toast.success("Commande copiée !");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="border border-border bg-surface rounded-2xl overflow-hidden transition-all duration-200 hover:border-border-strong space-y-4">
            
            {/* Header / Title */}
            <div className="p-4 sm:p-5 pb-0 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-info/10 border border-info/20 text-info">
                    <Home className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-base font-black text-foreground tracking-tight uppercase">Hall de Guilde</h4>
                    <p className="text-xs text-muted-foreground">Point de ralliement officiel</p>
                </div>
            </div>

            <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4">
                {posX !== null && posY !== null ? (
                    <div className="space-y-3.5">
                        {/* Map Viewer Preview */}
                        <div className="space-y-1.5">
                            <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden border border-border relative">
                                <MapViewer
                                    initialX={posX}
                                    initialY={posY}
                                    // Bug 10/10/2026 — `6` dépassait le `maxZoom: 3` de ce CRS
                                    // (zooms négatifs ici) : Leaflet clampait au max = aperçu
                                    // « trop zoomé ». `-3` cadre le point avec son contexte,
                                    // comme les autres mini-aperçus (`CoordHoverMap`, popover).
                                    initialZoom={-3}
                                    initialWorldId={worldId ?? 1} 
                                    hideUI={true} 
                                />
                                <div className="absolute top-2 right-2 bg-black/80 border border-border rounded-lg px-2.5 py-1 backdrop-blur-md pointer-events-none z-10 text-xs font-mono font-bold text-foreground">
                                    [{posX}, {posY}]
                                </div>
                            </div>
                        </div>

                        {/* Copy Command Button */}
                        <button
                            onClick={handleCopy}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border
                                ${copied
                                    ? "bg-success/15 border-success/30 text-success"
                                    : "bg-surface hover:bg-elevated border-border text-foreground hover:border-border-strong"
                                }`}
                        >
                            {copied ? (
                                <><Check className="w-3.5 h-3.5 text-success" /> Commande copiée</>
                            ) : (
                                <><Copy className="w-3.5 h-3.5 text-muted-foreground" /> Copier /travel [{posX}, {posY}]</>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-6 bg-elevated/40 border border-dashed border-border rounded-xl text-center">
                        <ShieldAlert className="w-7 h-7 text-warning/70 mb-2" />
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
                            Le Hall de Guilde n'a pas encore été configuré par un officier de la guilde.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
