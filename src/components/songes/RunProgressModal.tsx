"use client";
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import { useState } from "react";
import Image from "next/image";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { updateCurrentFloor } from "@/server/actions/songes/dream-run-actions";
import { PALIERS } from "@/lib/songes/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";

interface RunProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    guildId: string;
    runId: string;
    currentFloor: number;
    onUpdate?: () => void;
}

export function RunProgressModal({
    isOpen,
    onClose,
    guildId,
    runId,
    currentFloor,
    onUpdate,
}: RunProgressModalProps) {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleFloorClick = async (floor: number) => {
        if (floor === currentFloor) return;
        
        setIsUpdating(true);
        try {
            const result = await updateCurrentFloor(guildId, runId, floor);
            if (result.success) {
                toast.success(`Étage ${floor} défini`);
                onUpdate?.();
                onClose();
            } else {
                toast.error(result.error || "Erreur lors de la mise à jour");
            }
        } catch (error) {
            toast.error("Erreur de communication avec le serveur");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl bg-background border-border text-foreground overflow-hidden p-0">
                {/* Background Decor */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-600/30 blur-[100px] rounded-full" />
                    <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-600/30 blur-[100px] rounded-full" />
                </div>

                <div className="relative z-10 p-6">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-purple-400" />
                            Progression du Rêve
                        </DialogTitle>
                        <DialogDescription className="text-foreground/50 font-medium">
                            Sélectionnez l'étage actuel de la run pour mettre à jour la progression.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {PALIERS.map((palier, idx) => {
                            const isCurrentPalier = palier.etages.includes(currentFloor as never);
                            const lastFloor = palier.etages[palier.etages.length - 1];
                            const isCompleted = currentFloor > lastFloor;

                            return (
                                <div key={palier.id} className="relative group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div 
                                            className={cn(
                                                "relative w-10 h-10 rounded-lg border-2 flex items-center justify-center overflow-hidden transition-all",
                                                isCurrentPalier ? "scale-110  border-current" : "opacity-40 border-border"
                                            )}
                                            style={{ 
                                                color: palier.couleur,
                                                borderColor: isCurrentPalier ? palier.couleur : undefined,
                                                // @ts-ignore
                                                "--color": palier.couleur
                                            }}
                                        >
                                            <div className="absolute inset-0 opacity-40">
                                                <Image
                                                    src={`/assets/missions/${
                                                        palier.id <= 3 ? `reve${palier.id}` : 
                                                        palier.id === 4 ? "paradoxe1" : "cauchemar1"
                                                    }.png`}
                                                    alt="Icon"
                                                    fill
                                                    className="object-contain p-1"
                                                />
                                            </div>
                                            <span className="relative z-10 text-caption font-black drop-shadow-md">
                                                {["I", "II", "III", "IV", "V"][idx]}
                                            </span>
                                        </div>
                                        <h3 className={cn(
                                            "text-xs font-black uppercase tracking-[0.2em] transition-opacity",
                                            isCurrentPalier ? "opacity-100" : "opacity-40"
                                        )} style={{ color: palier.couleur }}>
                                            {palier.nom}
                                        </h3>
                                        {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500 opacity-50" />}
                                    </div>

                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                        {palier.etages.map((floor) => {
                                            const isActive = floor === currentFloor;
                                            const isDone = floor < currentFloor;

                                            return (
                                                <button
                                                    key={floor}
                                                    disabled={isUpdating}
                                                    onClick={() => handleFloorClick(floor)}
                                                    className={cn(
                                                        "relative h-12 flex flex-col items-center justify-center rounded-xl border transition-all  active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
                                                        isActive 
                                                            ? "bg-background text-foreground border-border  z-10" 
                                                            : isDone
                                                                ? "bg-surface border-border text-foreground/30"
                                                                : "bg-black/40 border-border text-foreground/60 hover:border-border-strong hover:bg-surface"
                                                    )}
                                                >
                                                    <span className="text-sm font-black">{floor}</span>
                                                    {isDone && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500/40" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    {idx < PALIERS.length - 1 && (
                                        <div className="flex justify-center my-4 opacity-10">
                                            <ChevronRight className="w-4 h-4 rotate-90" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Special Floor: Final Boss */}
                        <div className="pt-4 border-t border-border">
                            <button
                                disabled={isUpdating}
                                onClick={() => handleFloorClick(26)}
                                className={cn(
                                    "w-full h-16 rounded-2xl border-2 flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50",
                                    currentFloor === 26
                                        ? "bg-amber-500 text-warning-foreground border-amber-400 "
                                        : "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative w-10 h-10 shrink-0">
                                        <Image
                                            src="/songes/boss_token.png"
                                            alt="Boss"
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-lg font-black uppercase tracking-[0.2em]">Combat Final</span>
                                        <span className="text-caption font-bold opacity-60 uppercase tracking-widest">Étage 26+</span>
                                    </div>
                                </div>
                                {currentFloor === 26 && <CheckCircle2 className="w-6 h-6 animate-in zoom-in" />}
                            </button>
                        </div>
                    </div>

                    {/* Loader Overlay */}
                    {isUpdating && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
                                <span className="text-xs font-black uppercase tracking-widest text-purple-400/80">Modification...</span>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
