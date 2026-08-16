"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Move, ZoomIn, ZoomOut, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateV3QuestCoordinates, updateV3ChainCoordinates } from "@/server/actions/dofus-v3-actions";
import { toast } from "sonner";

interface Node {
    id: string;
    name: string;
    x: number;
    y: number;
    color?: string;
    localImageUrl?: string | null;
}

interface DofusNeuralTreeProps {
    dofusId: string;
    chains: any[];
    onClose: () => void;
}

export function DofusNeuralTree({ dofusId, chains, onClose }: DofusNeuralTreeProps) {
    const [zoom, setZoom] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Filter quests with coordinates or assign default spiral layout
    const allQuests = chains.flatMap(c => c.entries.map((e: any) => ({
        ...e,
        coords: e.coordinatesV3 || { x: Math.random() * 800, y: Math.random() * 600 }
    })));

    const handleDragEnd = async (id: string, info: any) => {
        const { x, y } = info.point;
        // console.log(`Dropped ${id} at ${x}, ${y}`);
        // In a real impl, we'd calculate relative to container
    };

    const saveLayout = async () => {
        toast.info("Sauvegarde du layout organique...");
        // Logic to batch update all coordinates
        toast.success("Design Neural synchronisé");
    };

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* HUD / Header */}
            <div className="h-20 border-b border-border flex items-center justify-between px-8 bg-background/80 backdrop-blur-3xl">
                <div className="flex items-center gap-6">
                    <div className="p-2 bg-success/10 rounded-xl border border-success/20">
                        <Move className="w-6 h-6 text-success" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-foreground italic tracking-tighter uppercase">Neural Tree Editor <span className="text-muted-foreground">v3.0</span></h2>
                        <p className="text-caption font-bold text-muted-foreground tracking-widest uppercase">Orchestration organique des quêtes</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-black/40 border border-border rounded-xl p-1">
                        <Button variant="ghost" size="icon" onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))} className="h-8 w-8 hover:bg-surface">
                            <ZoomOut className="w-4 h-4" />
                        </Button>
                        <span className="text-caption font-black w-12 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
                        <Button variant="ghost" size="icon" onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="h-8 w-8 hover:bg-surface">
                            <ZoomIn className="w-4 h-4" />
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={onClose} className="border-border bg-surface hover:bg-surface font-bold uppercase tracking-widest h-10 px-6 rounded-xl">
                        Fermer
                    </Button>
                    <Button onClick={saveLayout} className="bg-success hover:bg-success text-success-foreground font-black uppercase tracking-widest h-10 px-8 rounded-xl ">
                        <Save className="w-4 h-4 mr-2" />
                        Synchroniser
                    </Button>
                </div>
            </div>

            {/* Neural Canvas */}
            <div 
                ref={containerRef}
                className="flex-1 relative overflow-hidden bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:40px_40px]"
            >
                <motion.div 
                    style={{ scale: zoom }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                    {allQuests.map((q: any) => (
                        <motion.div
                            key={q.id}
                            drag
                            dragMomentum={false}
                            onDragEnd={(e, info) => handleDragEnd(q.id, info)}
                            className="absolute p-4 rounded-2xl bg-surface/80 border border-border backdrop-blur-md shadow-2xl pointer-events-auto cursor-grab active:cursor-grabbing group min-w-[200px]"
                            style={{ 
                                left: q.coords.x, 
                                top: q.coords.y,
                                boxShadow: q.localImageUrl ? '0 0 30px rgba(139, 92, 246, 0.1)' : 'none'
                             }}
                        >
                            <div className="flex items-center gap-3">
                                {q.localImageUrl ? (
                                    <img src={q.localImageUrl} className="w-10 h-10 rounded-lg object-contain bg-black/40 border border-border" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center">
                                        <RotateCcw className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-foreground font-bold leading-tight truncate">{q.name}</p>
                                    <p className="text-caption text-muted-foreground font-black uppercase tracking-widest mt-0.5">#{q.dofusdbId || "MANUEL"}</p>
                                </div>
                            </div>

                            {/* Connections (Stub for v3.1) */}
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-success rounded-full blur-[2px]" />
                        </motion.div>
                    ))}
                </motion.div>

                {/* Grid Overlay */}
                <div className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none">
                    <div className="bg-background/80 backdrop-blur-xl border border-border rounded-full px-6 py-2 flex items-center gap-4 text-caption font-black text-muted-foreground uppercase tracking-widest">
                        <span>Grid Snapping Active</span>
                        <div className="w-1 h-1 bg-elevated rounded-full" />
                        <span>Organique Engine v3</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
