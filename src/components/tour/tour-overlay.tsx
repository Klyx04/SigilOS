"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useTour, isReplayableTourPhase } from "./tour-provider";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Award, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Deux rectangles identiques à 0,5 px près (le spotlight ne re-rend pas pour rien). */
function isSameRect(a: DOMRect, b: DOMRect): boolean {
    const tolerance = 0.5;
    return Math.abs(a.top - b.top) < tolerance
        && Math.abs(a.left - b.left) < tolerance
        && Math.abs(a.width - b.width) < tolerance
        && Math.abs(a.height - b.height) < tolerance;
}

export function TourOverlay() {
    const {
        isActive,
        activeStepData,
        currentStep,
        totalSteps,
        advance,
        back,
        skipTour,
        tourPhase,
        requestStepNavigation
    } = useTour();

    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const requestRef = useRef<number | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const tooltipObserverRef = useRef<ResizeObserver | null>(null);
    /**
     * BUG-6 — mémorise le dernier `href` vers lequel on a **déjà** navigué : une
     * ancre réellement absente ne provoque donc jamais une boucle de navigation
     * (l'overlay retombe sur son saut anti-centrage).
     */
    const navigatedHrefRef = useRef<string | null>(null);
    /**
     * BUG-6 — Constat beta : le texte était **mangé à droite** dans la bulle : la
     * position était calculée avec une largeur/hauteur **codées en dur** (320 ×
     * 180) alors que la bulle est `w-full max-w-[320px] sm:max-w-[340px]`. On
     * mesure donc la **taille réelle** et on recadre la bulle dans la fenêtre :
     * jamais de débordement, jamais de texte tronqué.
     *
     * BUG-7 — la mesure ne partait **jamais** : `tooltipRef.current` vaut `null`
     * au premier passage (l'overlay retourne `null` tant que le spotlight n'est
     * pas posé) et l'effet de mesure, dont les dépendances (`isActive`,
     * `activeStepData`, `currentStep`) ne changeaient plus ensuite, ne se
     * relançait pas ⇒ ni la mesure ni le `ResizeObserver` n'étaient branchés, et
     * la bulle restait positionnée avec la hauteur codée en dur (180) alors
     * qu'elle en fait ~230 : sa barre de navigation sortait de l'écran (rognée
     * par le conteneur `overflow-hidden`) ⇒ **plus aucun moyen d'avancer, les
     * gens étaient bloqués**. La mesure est désormais accrochée au **montage
     * réel du nœud** (callback ref) et suit toute variation de taille.
     */
    const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 180 });

    const measureTooltip = useCallback(() => {
        const element = tooltipRef.current;
        if (!element) return;
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        if (width <= 0 || height <= 0) return;
        setTooltipSize(previous => (
            previous.width === width && previous.height === height ? previous : { width, height }
        ));
    }, []);

    const setTooltipNode = useCallback((node: HTMLDivElement | null) => {
        tooltipObserverRef.current?.disconnect();
        tooltipObserverRef.current = null;
        tooltipRef.current = node;
        if (!node) return;

        measureTooltip();
        if (typeof ResizeObserver === "undefined") return;

        const observer = new ResizeObserver(() => measureTooltip());
        observer.observe(node);
        tooltipObserverRef.current = observer;
    }, [measureTooltip]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    /**
     * BUG-7 — **sortie de secours** : `Échap` passe le tutoriel. Aucun
     * utilisateur ne doit rester piégé dans une bulle, quel que soit l'état du
     * layout (et en plus du bouton « Passer » affiché dans la carte).
     */
    useEffect(() => {
        if (!isActive) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            skipTour();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isActive, skipTour]);

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
                // Le spotlight ne bouge pas la plupart du temps : inutile de
                // re-rendre 60 fois par seconde pour un rectangle identique.
                setTargetRect(previous => (previous && isSameRect(previous, rect) ? previous : rect));
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

    // Calculate tooltip position — dimensions **mesurées** (BUG-6 / BUG-7).
    let tooltipStyle: React.CSSProperties = {};
    const tooltipWidth = tooltipSize.width;
    const tooltipHeight = tooltipSize.height;
    const margin = 16;
    /**
     * Largeur de la bulle : **plafonnée par la largeur de design** (les classes
     * `max-w-[320px] sm:max-w-[340px]`) puis par la fenêtre (téléphone inclus),
     * pour que le texte respire.
     *
     * BUG-7 (constat « le tuto sort de l'écran ») — la valeur inline `maxWidth`
     * **écrase** ces classes CSS : la bulle se déployait donc sur **toute la
     * largeur** de la fenêtre (barre de 1900 px, texte perdu à gauche et bouton
     * « Suivant » à 1 mètre à droite). Le plafond de design est donc repris ici.
     */
    const designMaxWidth = windowSize.width >= 640 ? 340 : 320;
    const maxWidth = Math.max(240, Math.min(designMaxWidth, windowSize.width - margin * 2));
    /**
     * BUG-7 — hauteur maximale réellement disponible pour la bulle dans la
     * fenêtre. La bulle est **bornée** à cette hauteur et c'est la **zone de
     * texte** qui défile : la barre « Retour / Suivant » reste toujours visible,
     * donc on ne peut plus être bloqué dans un tutoriel.
     */
    const maxHeight = Math.max(180, windowSize.height - margin * 2);

    const placement = activeStepData.placement;

    // Taille réellement occupée une fois la bulle bornée à la fenêtre.
    const bubbleWidth = Math.min(tooltipWidth, maxWidth);
    const bubbleHeight = Math.min(tooltipHeight, maxHeight);

    // Auto-flip placement if there is not enough space (vertical **et** horizontal).
    let finalPlacement = placement;
    if (placement === "bottom" && y + height + margin + bubbleHeight > windowSize.height) {
        if (y - bubbleHeight - margin > 0) {
            finalPlacement = "top";
        }
    } else if (placement === "top" && y - bubbleHeight - margin < 0) {
        if (y + height + margin + bubbleHeight < windowSize.height) {
            finalPlacement = "bottom";
        }
    } else if (placement === "right" && x + width + margin + bubbleWidth > windowSize.width) {
        if (x - bubbleWidth - margin > 0) {
            finalPlacement = "left";
        }
    } else if (placement === "left" && x - bubbleWidth - margin < 0) {
        if (x + width + margin + bubbleWidth < windowSize.width) {
            finalPlacement = "right";
        }
    }

    /**
     * Recadrage **strict** : la bulle reste intégralement dans la fenêtre, sur
     * les 4 bords (l'overlay racine est en `overflow-hidden` : tout dépassement
     * est rogné, donc invisible et incliquable).
     */
    const clampTop = (value: number) => Math.min(
        Math.max(value, margin),
        Math.max(margin, windowSize.height - bubbleHeight - margin)
    );
    const clampLeft = (value: number) => Math.min(
        Math.max(value, margin),
        Math.max(margin, windowSize.width - bubbleWidth - margin)
    );

    if (finalPlacement === "bottom") {
        tooltipStyle = {
            top: clampTop(y + height + margin),
            left: clampLeft(x + width / 2 - bubbleWidth / 2),
        };
    } else if (finalPlacement === "top") {
        tooltipStyle = {
            top: clampTop(y - bubbleHeight - margin),
            left: clampLeft(x + width / 2 - bubbleWidth / 2),
        };
    } else if (finalPlacement === "right") {
        tooltipStyle = {
            top: clampTop(y + height / 2 - bubbleHeight / 2),
            left: clampLeft(x + width + margin),
        };
    } else if (finalPlacement === "left") {
        tooltipStyle = {
            top: clampTop(y + height / 2 - bubbleHeight / 2),
            left: clampLeft(x - bubbleWidth - margin),
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
                ref={setTooltipNode}
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
                    style={{ maxHeight }}
                    className="glass-premium rounded-2xl border border-border p-5 bg-background/90 backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col space-y-4 min-w-0"
                >
                    {/* Glowing effect inside tooltip */}
                    <div className="absolute -top-12 -right-12 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

                    {/* BUG-7 — seule zone défilante quand la fenêtre est courte : la barre de
                        navigation reste donc toujours visible et cliquable. */}
                    <div className="flex items-start gap-3 min-w-0 flex-1 min-h-0 overflow-y-auto pr-6">
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

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border shrink-0">
                        {/* Progress Dots */}
                        <div className="flex flex-wrap gap-1.5 items-center min-w-0">
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
                        <div className="flex items-center gap-2 shrink-0">
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

                {/* BUG-7 — sortie de secours : on ne laisse jamais un utilisateur bloqué.
                    Placée **hors** du conteneur `space-y-4` (qui imposait une marge au
                    premier élément) et en haut de la carte : elle reste visible même si
                    le contenu est long. */}
                <button
                    type="button"
                    onClick={skipTour}
                    title="Passer le tutoriel"
                    aria-label="Passer le tutoriel"
                    className="absolute top-3 right-3 z-10 w-7 h-7 inline-flex items-center justify-center rounded-lg border border-border bg-surface/70 text-muted-foreground hover:text-foreground hover:bg-surface transition-colors active:scale-95"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
