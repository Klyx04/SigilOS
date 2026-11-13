"use client";
// Songes — surfaces et actions sur les TOKENS du thème (accent unique : info) ; contrat : src/lib/songes/ui.ts

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
                <div className="relative z-10 p-6">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-info" />
                            Progression du Rêve
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Sélectionnez l'étage actuel de la run pour mettre à jour la progression.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
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
                                                isCurrentPalier ? " border-current" : "opacity-40 border-border"
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
                                            <span className="relative z-10 text-caption font-semibold">
                                                {["I", "II", "III", "IV", "V"][idx]}
                                            </span>
                                        </div>
                                        <h3 className={cn(
                                            "text-xs font-semibold uppercase tracking-wider transition-opacity",
                                            isCurrentPalier ? "opacity-100" : "opacity-40"
                                        )} style={{ color: palier.couleur }}>
                                            {palier.nom}
                                        </h3>
                                        {isCompleted && <CheckCircle2 className="w-4 h-4 text-success opacity-50" />}
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
                                                        "relative h-12 flex flex-col items-center justify-center rounded-md border transition-colors disabled:opacity-50",
                                                        isActive
                                                            ? "bg-info/15 border-info/40 text-info"
                                                            : isDone
                                                                ? "bg-surface border-border text-muted-foreground"
                                                                : "bg-elevated/60 border-border text-foreground/70 hover:border-border-strong hover:bg-surface"
                                                    )}
                                                >
                                                    <span className="text-sm font-semibold">{floor}</span>
                                                    {isDone && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-success/40" />}
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
                                    "w-full h-16 rounded-lg border-2 flex items-center justify-center gap-4 transition-all disabled:opacity-50",
                                    currentFloor === 26
                                        ? "bg-warning text-warning-foreground border-warning "
                                        : "bg-warning/10 border-warning/20 text-warning hover:bg-warning/20"
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
                                        <span className="text-lg font-semibold uppercase tracking-wider">Combat Final</span>
                                        <span className="text-caption font-bold opacity-60 uppercase tracking-wider">Étage 26+</span>
                                    </div>
                                </div>
                                {currentFloor === 26 && <CheckCircle2 className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>

                    {/* Loader Overlay */}
                    {isUpdating && (
                        <div className="absolute inset-0 bg-background/80 z-50 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-10 h-10 text-info animate-spin" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-info/80">Modification...</span>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
