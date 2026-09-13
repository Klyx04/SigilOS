"use client";

import { useEffect, useState, useRef } from "react";
import { useTour, isReplayableTourPhase } from "./tour-provider";
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
        tourPhase,
        requestStepNavigation
    } = useTour();

    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const requestRef = useRef<number | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    /**
     * BUG-6 — mémorise le dernier `href` vers lequel on a **déjà** navigué : une
     * ancre réellement absente ne provoque donc jamais une boucle de navigation
     * (l'overlay retombe sur son saut anti-centrage).
     */
    const navigatedHrefRef = useRef<string | null>(null);
    /**
     * Constat beta (BUG-6) — le texte était **mangé à droite** dans la bulle : la
     * position était calculée avec une largeur/hauteur **codées en dur** (320 ×
     * 180) alors que la bulle est `w-full max-w-[320px] sm:max-w-[340px]`. On
     * mesure donc la **taille réelle** (ResizeObserver) et on recadre la bulle
     * dans la fenêtre : jamais de débordement, jamais de texte tronqué.
     */
    const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 180 });

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Mesure réelle de la bulle (largeur **et** hauteur), à chaque étape.
    useEffect(() => {
        const element = tooltipRef.current;
        if (!element) return;

        const measure = () => {
            const width = element.offsetWidth;
            const height = element.offsetHeight;
            if (width > 0 && height > 0) setTooltipSize({ width, height });
        };

        measure();
        if (typeof ResizeObserver === "undefined") return;

        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [isActive, activeStepData, currentStep]);

    // Watch target element and update position in a loop to handle scrolling/layout shifts smoothly
    useEffect(() => {
        if (!isActive || !activeStepData) {
            setTargetRect(null);
            return;
        }

        let attempts = 0;
        let settled = false;
        /**
         * BUG-6 (constat beta) — l'étape visait une ancre qui vit sur **une autre
         * page** du module (éditeur de jet, forge, publication, négociation) :
         * l'overlay sautait l'étape et le tutoriel « se coupait ». Désormais, si
         * l'étape déclare un `href`, on **navigue** (chemin validé par le
         * provider), on repart à zéro dans l'attente de l'ancre, et le saut
         * anti-centrage ne reste qu'en dernier recours (ancre réellement absente).
         */
        const updatePosition = () => {
            const el = document.querySelector(activeStepData.target);
            if (el) {
                const rect = el.getBoundingClientRect();
                setTargetRect(rect);
                // Scroll into view if offscreen
                if (rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth) {
                    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
                }
                attempts = 0; // reset
            } else {
                attempts++;

                // ~1 s : la page de l'étape n'est pas la page courante → on y va
                // (une seule fois par destination : jamais de boucle).
                if (attempts === 60 && activeStepData.href && navigatedHrefRef.current !== activeStepData.href) {
                    navigatedHrefRef.current = activeStepData.href;
                    requestStepNavigation(activeStepData.href);
                    attempts = 0;
                    requestRef.current = requestAnimationFrame(updatePosition);
                    return;
                }

                // Après ~2s si l'élément est introuvable (module caché/collapsé / sidebar repliée),
                // on SAUTE l'étape au lieu d'afficher un tooltip centralisé inutile (anti-centrage).
                // On avance d'une seule étape (pas de cascade) puis on stoppe la boucle rAF.
                if (attempts > 120 && !settled) {
                    settled = true;
                    // Désactive l'overlay pour éviter un affichage résiduel centré.
                    setTargetRect(null);
                    advance();
                    return; // stoppe la boucle rAF
                }
            }
            requestRef.current = requestAnimationFrame(updatePosition);
        };

        requestRef.current = requestAnimationFrame(updatePosition);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isActive, activeStepData, advance, requestStepNavigation]);

    if (!isActive || !activeStepData || !targetRect) return null;

    // Spotlight settings
    const padding = 8;
    const x = targetRect.left - padding;
    const y = targetRect.top - padding;
    const width = targetRect.width + padding * 2;
    const height = targetRect.height + padding * 2;

    // Calculate tooltip position — dimensions **mesurées** (BUG-6).
    let tooltipStyle: React.CSSProperties = {};
    const tooltipWidth = tooltipSize.width;
    const tooltipHeight = tooltipSize.height;
    const margin = 16;
    // Jamais plus large que la fenêtre (téléphone inclus) : le texte respire.
    const maxWidth = Math.max(240, windowSize.width - margin * 2);

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
            maxWidth,
            top: "auto",
        };
    } else {
        tooltipStyle = { ...tooltipStyle, maxWidth };
    }

    const isAdminPhase = isReplayableTourPhase(tourPhase);
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
                className="absolute border border-violet-500/40 rounded-[18px] transition-all duration-300 pointer-events-none "
                style={{
                    left: x,
                    top: y,
                    width: width,
                    height: height,
                }}
            />

            {/* Tooltip content card */}
            <div
                ref={tooltipRef}
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
                    className="glass-premium rounded-2xl border border-border p-5 bg-background/90 backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col space-y-4 min-w-0"
                >
                    {/* Glowing effect inside tooltip */}
                    <div className="absolute -top-12 -right-12 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 shrink-0 border border-violet-500/20">
                            <Award className="w-4 h-4" />
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                            <h3 className="text-sm font-black uppercase tracking-widest text-foreground leading-tight break-words">
                                {activeStepData.title}
                            </h3>
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed break-words">
                                {activeStepData.description}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        {/* Progress Dots */}
                        <div className="flex gap-1.5 items-center">
                            {Array.from({ length: totalSteps }).map((_, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "h-1 rounded-full transition-all duration-300",
                                        idx + 1 === currentStep 
                                            ? "w-4 bg-violet-500 " 
                                            : "w-1 bg-elevated"
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
                                    className="h-8 px-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-0.5" />
                                    Retour
                                </Button>
                            )}

                            <Button
                                size="sm"
                                onClick={advance}
                                className="h-8 px-3 text-xs font-black uppercase tracking-widest bg-violet-600 hover:bg-violet-700 text-foreground rounded-xl shadow-[0_2px_8px_rgba(139,92,246,0.3)] transition-all active:scale-95 gap-0.5"
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
