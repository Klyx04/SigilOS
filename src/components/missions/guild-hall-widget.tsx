"use client";

import { useState } from "react";
import { Home, MapPin, Copy, Check, ShieldAlert } from "lucide-react";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { toast } from "sonner";

interface GuildHallWidgetProps {
    posX: number | null;
    posY: number | null;
    worldId: number | null;
    guildId: string;
}

export function GuildHallWidget({ posX, posY, worldId, guildId }: GuildHallWidgetProps) {
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
        <div className="border border-white/5 bg-zinc-900/20 backdrop-blur-md rounded-3xl overflow-hidden transition-all duration-300 hover:border-cyan-500/20 hover:shadow-[0_20px_40px_rgba(6,182,212,0.05)] space-y-4">
            
            {/* Header Image with Overlay */}
            <div className="relative h-44 w-full overflow-hidden group">
                <img 
                    src="/hall-guilde.jpg" 
                    alt="Hall de Guilde" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-[#090d16]/40 to-transparent" />
                
                {/* Overlay Text */}
                <div className="absolute bottom-4 left-5 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 backdrop-blur-sm shadow-lg">
                        <Home className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/80 mb-0.5">Quartier Général</p>
                        <h4 className="text-base font-black text-white tracking-tight uppercase italic">Hall de Guilde</h4>
                    </div>
                </div>
            </div>

            <div className="px-5 pb-5 space-y-4">
                {posX !== null && posY !== null ? (
                    <div className="space-y-4">
                        {/* Map Viewer Preview */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block">Coordonnées de ralliement</span>
                            <div className="w-full h-40 rounded-2xl overflow-hidden border border-white/10 relative">
                                <MapViewer 
                                    initialX={posX} 
                                    initialY={posY} 
                                    initialZoom={6} 
                                    initialWorldId={worldId ?? 1} 
                                    hideUI={true} 
                                />
                                <div className="absolute top-2 right-2 bg-black/85 border border-cyan-500/30 rounded-lg px-2.5 py-1.5 backdrop-blur-md pointer-events-none z-10 text-[10px] font-mono font-black text-cyan-400">
                                    [{posX}, {posY}]
                                </div>
                            </div>
                        </div>

                        {/* Copy Command Button */}
                        <button
                            onClick={handleCopy}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all group cursor-pointer
                                ${copied
                                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                                    : "bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 hover:border-cyan-500/40"
                                }`}
                        >
                            {copied ? (
                                <><Check className="w-4 h-4" /> Copié !</>
                            ) : (
                                <><Copy className="w-4 h-4 group-hover:scale-110 transition-transform" /> Copier /travel [{posX}, {posY}]</>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-6 bg-zinc-950/40 border border-dashed border-white/5 rounded-2xl text-center">
                        <ShieldAlert className="w-8 h-8 text-amber-500/60 mb-2" />
                        <p className="text-xs text-zinc-400 leading-relaxed max-w-[240px]">
                            Le Hall de Guilde n'a pas encore été configuré par un officier de la guilde.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
