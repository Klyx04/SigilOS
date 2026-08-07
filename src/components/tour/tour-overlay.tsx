"use client";

import { useEffect, useState, useRef } from "react";
import { useTour } from "./tour-provider";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Award, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TourOverlay() {
    const {
        isActive,
        activeStepData,
        currentStep,
        totalSteps,
        advance,
        back,
        tourPhase
    } = useTour();

    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const requestRef = useRef<number | null>(null);

    // Track window resize and updates
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Watch target element and update position in a loop to handle scrolling/layout shifts smoothly
    useEffect(() => {
        if (!isActive || !activeStepData) {
            setTargetRect(null);
            return;
        }

        let attempts = 0;
        let settled = false;
        const updatePosition = () => {
            const el = document.querySelector(activeStepData.target);
            if (el) {
                const rect = el.getBoundingClientRect();
                setTargetRect(rect);
                // Scroll into view if offscreen
                if (rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                }
                attempts = 0; // reset
            } else {
                attempts++;
                // Après ~2s si l'élément est introuvable (module caché/collapsé), on arrête
                // la boucle et on affiche le tooltip en position centralisée. On N'avance PLUS
                // automatiquement (ce qui déclenchait une cascade de skip à toute vitesse).
                if (attempts > 120 && !settled) {
                    settled = true;
                    setTargetRect({
                        left: window.innerWidth / 2 - 150,
                        top: window.innerHeight / 2 - 90,
                        width: 300,
                        height: 180,
                        right: window.innerWidth / 2 + 150,
                        bottom: window.innerHeight / 2 + 90,
                    } as DOMRect);
                    return; // stoppe la boucle rAF
                }
            }
            requestRef.current = requestAnimationFrame(updatePosition);
        };

        requestRef.current = requestAnimationFrame(updatePosition);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isActive, activeStepData, advance]);

    if (!isActive || !activeStepData || !targetRect) return null;

    // Spotlight settings
    const padding = 8;
    const x = targetRect.left - padding;
    const y = targetRect.top - padding;
    const width = targetRect.width + padding * 2;
    const height = targetRect.height + padding * 2;

    // Calculate tooltip position
    let tooltipStyle: React.CSSProperties = {};
    const tooltipWidth = 320;
    const tooltipHeight = 180; // approximate
    const margin = 16;

    const placement = activeStepData.placement;

    // Auto-flip placement if there is not enough space
    let finalPlacement = placement;
    if (placement === "bottom" && y + height + margin + tooltipHeight > windowSize.height) {
        if (y - tooltipHeight - margin > 0) {
            finalPlacement = "top";
        }
    } else if (placement === "top" && y - tooltipHeight - margin < 0) {
        if (y + height + margin + tooltipHeight < windowSize.height) {
            finalPlacement = "bottom";
        }
    }

    if (finalPlacement === "bottom") {
        tooltipStyle = {
            top: Math.max(margin, Math.min(windowSize.height - tooltipHeight - margin, y + height + margin)),
            left: Math.max(margin, Math.min(windowSize.width - tooltipWidth - margin, x + width / 2 - tooltipWidth / 2)),
        };
    } else if (finalPlacement === "top") {
        tooltipStyle = {
            top: Math.max(margin, Math.min(windowSize.height - tooltipHeight - margin, y - tooltipHeight - margin)),
            left: Math.max(margin, Math.min(windowSize.width - tooltipWidth - margin, x + width / 2 - tooltipWidth / 2)),
        };
    } else if (finalPlacement === "right") {
        tooltipStyle = {
            top: Math.max(margin, Math.min(windowSize.height - tooltipHeight - margin, y + height / 2 - tooltipHeight / 2)),
            left: Math.max(margin, Math.min(windowSize.width - tooltipWidth - margin, x + width + margin)),
        };
    } else if (finalPlacement === "left") {
        tooltipStyle = {
            top: Math.max(margin, Math.min(windowSize.height - tooltipHeight - margin, y + height / 2 - tooltipHeight / 2)),
            left: Math.max(margin, Math.min(windowSize.width - tooltipWidth - margin, x - tooltipWidth - margin)),
        };
    }

    // Fallback for mobile (always dock to the bottom)
    if (windowSize.width < 768) {
        tooltipStyle = {
            bottom: margin,
            left: margin,
            right: margin,
            width: "auto",
            top: "auto"
        };
    }

    const isAdminPhase = !!tourPhase && tourPhase.startsWith("admin");
    const isFirstStepGlobal = tourPhase === "profile" && currentStep === 1;

    return (
        <div className="fixed inset-0 z-[110] overflow-hidden pointer-events-none select-none">
            {/* Dark mask overlay with cut-out hole */}
            <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ mixBlendMode: "multiply" }}>
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            rx="16"
                            ry="16"
                            fill="black"
                        />
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(9, 9, 11, 0.82)"
                    mask="url(#spotlight-mask)"
                />
            </svg>

            {/* Glowing ring around the spotlight */}
            <div
                className="absolute border border-violet-500/40 rounded-[18px] transition-all duration-300 pointer-events-none shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                style={{
                    left: x,
                    top: y,
                    width: width,
                    height: height,
                }}
            />

            {/* Tooltip content card */}
            <div
                className={cn(
                    "absolute pointer-events-auto transition-all duration-300 w-full max-w-[320px] sm:max-w-[340px] z-[120]",
                    windowSize.width < 768 ? "fixed" : ""
                )}
                style={tooltipStyle}
            >
                <motion.div
                    key={`${tourPhase}-${currentStep}`}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="glass-premium rounded-2xl border border-white/10 p-5 bg-zinc-950/90 backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col space-y-4"
                >
                    {/* Glowing effect inside tooltip */}
                    <div className="absolute -top-12 -right-12 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 shrink-0 border border-violet-500/20">
                            <Award className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-black uppercase tracking-widest text-white leading-tight">
                                {activeStepData.title}
                            </h3>
                            <p className="text-xs font-medium text-zinc-400 leading-relaxed pr-1">
                                {activeStepData.description}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        {/* Progress Dots */}
                        <div className="flex gap-1.5 items-center">
                            {Array.from({ length: totalSteps }).map((_, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "h-1 rounded-full transition-all duration-300",
                                        idx + 1 === currentStep 
                                            ? "w-4 bg-violet-500 shadow-[0_0_8px_#8b5cf6]" 
                                            : "w-1 bg-white/20"
                                    )}
                                />
                            ))}
                        </div>

                        {/* Navigation buttons */}
                        <div className="flex items-center gap-2">
                            {!isFirstStepGlobal && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={back}
                                    className="h-8 px-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-0.5" />
                                    Retour
                                </Button>
                            )}

                            <Button
                                size="sm"
                                onClick={advance}
                                className="h-8 px-3 text-xs font-black uppercase tracking-widest bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-[0_2px_8px_rgba(139,92,246,0.3)] transition-all active:scale-95 gap-0.5"
                            >
                                {currentStep === totalSteps ? (
                                    <>
                                        {isAdminPhase || tourPhase === "dashboard" ? "Terminer" : "Suivant"}
                                        <CheckCircle className="w-3.5 h-3.5 ml-1" />
                                    </>
                                ) : (
                                    <>
                                        Suivant
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
