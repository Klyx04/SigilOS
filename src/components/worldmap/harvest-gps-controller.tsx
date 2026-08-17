"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Navigation, ChevronRight, ChevronLeft, Copy, Check, 
    X, MapPin, Sparkles, Volume2
} from "lucide-react";
import { toast } from "sonner";
import { OptiFarmCircuit } from "./harvest-opti-farm-panel";
import { cn } from "@/lib/utils";

interface HarvestGpsControllerProps {
    circuit: OptiFarmCircuit | null;
    onClose: () => void;
    onGoToCoord: (x: number, y: number) => void;
    completedStepIndices?: Set<number>;
    onToggleStepCompleted?: (stepIdx: number) => void;
}

export function HarvestGpsController({
    circuit,
    onClose,
    onGoToCoord,
    completedStepIndices = new Set(),
    onToggleStepCompleted
}: HarvestGpsControllerProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [copied, setCopied] = useState(false);

    // Reset step index when circuit changes
    useEffect(() => {
        setStepIndex(0);
    }, [circuit]);

    const currentStep = circuit?.path[stepIndex] || null;
    const totalSteps = circuit?.path.length || 0;
    const isStepHarvested = completedStepIndices.has(stepIndex);

    const copyTravelCommand = useCallback(() => {
        if (!currentStep) return;
        const cmd = `/travel ${currentStep.x} ${currentStep.y}`;
        navigator.clipboard.writeText(cmd);
        setCopied(true);
        toast.success(`Copié : ${cmd}`, { duration: 1500 });
        setTimeout(() => setCopied(false), 1200);
        onGoToCoord(currentStep.x, currentStep.y);
    }, [currentStep, onGoToCoord]);

    const nextStep = useCallback(() => {
        if (!circuit) return;
        const nextIdx = (stepIndex + 1) % circuit.path.length;
        setStepIndex(nextIdx);
        const next = circuit.path[nextIdx];
        const cmd = `/travel ${next.x} ${next.y}`;
        navigator.clipboard.writeText(cmd);
        toast.success(`Étape ${nextIdx + 1}/${circuit.path.length} : ${cmd}`, { duration: 1200 });
        onGoToCoord(next.x, next.y);
    }, [circuit, stepIndex, onGoToCoord]);

    const prevStep = useCallback(() => {
        if (!circuit) return;
        const prevIdx = stepIndex === 0 ? circuit.path.length - 1 : stepIndex - 1;
        setStepIndex(prevIdx);
        const prev = circuit.path[prevIdx];
        const cmd = `/travel ${prev.x} ${prev.y}`;
        navigator.clipboard.writeText(cmd);
        toast.success(`Étape ${prevIdx + 1}/${circuit.path.length} : ${cmd}`, { duration: 1200 });
        onGoToCoord(prev.x, prev.y);
    }, [circuit, stepIndex, onGoToCoord]);

    const toggleCurrentHarvested = useCallback(() => {
        if (onToggleStepCompleted) {
            onToggleStepCompleted(stepIndex);
            if (!isStepHarvested) {
                toast.success(`Étape ${stepIndex + 1} validée !`, { duration: 1000 });
                // Passer automatiquement à la suivante après validation
                nextStep();
            }
        }
    }, [onToggleStepCompleted, stepIndex, isStepHarvested, nextStep]);

    // Keyboard navigation (Space or ArrowRight for next step, ArrowLeft for prev step)
    useEffect(() => {
        if (!circuit) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.code === "Space") {
                e.preventDefault();
                toggleCurrentHarvested();
            } else if (e.code === "ArrowRight") {
                e.preventDefault();
                nextStep();
            } else if (e.code === "ArrowLeft") {
                e.preventDefault();
                prevStep();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [circuit, nextStep, prevStep, toggleCurrentHarvested]);

    if (!circuit || !currentStep) return null;

    const isZaapStep = stepIndex === 0 || stepIndex === totalSteps - 1;
    const completedCount = completedStepIndices.size;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 p-2.5 px-4 bg-card/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-2xl shadow-emerald-500/20 text-foreground max-w-[calc(100vw-32px)] overflow-x-auto"
            >
                {/* Zaap badge or Step Icon */}
                <div className="flex items-center gap-2 pr-3 border-r border-border/50">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                        <Navigation className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                            <span>GPS OPTI-FARM</span>
                            <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded text-emerald-300 font-mono font-semibold">
                                {completedCount}/{totalSteps} récoltées
                            </span>
                        </div>
                        <h4 className="text-xs font-semibold text-foreground truncate max-w-[130px]">
                            {circuit.zaapName}
                        </h4>
                    </div>
                </div>

                {/* Coords and Auto-Travel Button */}
                <div className="flex items-center gap-1.5 px-1">
                    <button
                        onClick={copyTravelCommand}
                        className={cn(
                            "px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all border",
                            copied
                                ? "bg-emerald-500 text-white border-emerald-400 scale-105"
                                : "bg-muted/80 text-foreground border-border/60 hover:bg-muted hover:border-emerald-500/50"
                        )}
                        title="Cliquer pour copier /travel"
                    >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>[{currentStep.x}, {currentStep.y}]</span>
                        {isZaapStep && <span className="text-[10px] bg-primary/20 text-primary px-1 py-0.2 rounded font-sans">Zaap</span>}
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>

                    {/* Bouton Récolté / Check */}
                    {onToggleStepCompleted && (
                        <button
                            onClick={toggleCurrentHarvested}
                            className={cn(
                                "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm",
                                isStepHarvested
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
                            )}
                            title="Valider la récolte sur cette case (Espace)"
                        >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isStepHarvested ? "Récolté" : "Valider"}</span>
                        </button>
                    )}
                </div>

                {/* Step Controllers */}
                <div className="flex items-center gap-1 pl-2 border-l border-border/50">
                    <button
                        onClick={prevStep}
                        title="Étape précédente (Flèche Gauche)"
                        className="p-2 rounded-xl bg-muted/50 hover:bg-muted text-foreground transition-colors border border-border/40"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                        onClick={nextStep}
                        title="Étape suivante (Flèche Droite)"
                        className="p-2 rounded-xl bg-muted/50 hover:bg-muted text-foreground transition-colors border border-border/40"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onClose}
                        title="Arrêter le guidage GPS"
                        className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
