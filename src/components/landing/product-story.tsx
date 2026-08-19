"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicLandingScreen } from "@/server/actions/landing-screen-actions";

interface ProductStoryProps {
    /** Screens pilotés par le God (#140) — sinon fallback sur les captures par défaut. */
    screens?: PublicLandingScreen[];
}

interface ProductTab {
    key: string;
    label: string;
    title?: string | null;
    description?: string | null;
    images: PublicLandingScreen[];
}

/**
 * 🖼️ #140 — Groupe les screens par libellé : un libellé partagé par plusieurs screens
 * devient UN onglet avec plusieurs images (galerie cliquable + zoom plein écran).
 */
function groupIntoTabs(screens: PublicLandingScreen[]): ProductTab[] {
    const map = new Map<string, ProductTab>();
    for (const s of screens) {
        const key = (s.label || "").toLowerCase().trim() || s.id;
        const existing = map.get(key);
        if (existing) {
            existing.images.push(s);
        } else {
            map.set(key, {
                key,
                label: s.label || s.id,
                title: s.title,
                description: s.description,
                images: [s],
            });
        }
    }
    return Array.from(map.values());
}

export function ProductStory({ screens = [] }: ProductStoryProps) {
    const tabs = useMemo(() => groupIntoTabs(screens), [screens]);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [imageIdx, setImageIdx] = useState(0);
    const [zoomUrl, setZoomUrl] = useState<string | null>(null);
    // Carrousel : lecture automatique (5s) + pause au survol / bouton lecture-pause.
    const [autoplayOn, setAutoplayOn] = useState(true);
    const [paused, setPaused] = useState(false);

    const activeTab = tabs[activeKey ? Math.max(0, tabs.findIndex((t) => t.key === activeKey)) : 0];

    // Reset de l'image active quand on change d'onglet.
    useEffect(() => {
        setImageIdx(0);
    }, [activeTab?.key]);

    // Pause automatique au survol du carrousel (reprise au départ de la souris).
    const pauseOnHover = () => setPaused(true);
    const resumeOnLeave = () => setPaused(false);

    if (!activeTab) return null;

    const imageCount = activeTab.images.length;
    const safeIdx = Math.min(Math.max(0, imageIdx), Math.max(0, imageCount - 1));
    const activeImage = activeTab.images[safeIdx];
    const isCarousel = imageCount > 1;

    // 🎠 Carrousel : lecture automatique (5s) — suspendue au survol, quand le zoom est ouvert
    // ou quand la lecture est coupée via le bouton.
    const isAutoRunning = isCarousel && autoplayOn && !paused && !zoomUrl;
    useEffect(() => {
        if (!isAutoRunning || imageCount <= 1) return;
        const timer = setInterval(() => {
            setImageIdx((prev) => (prev >= imageCount - 1 ? 0 : prev + 1));
        }, 5000);
        return () => clearInterval(timer);
    }, [isAutoRunning, imageCount]);

    const goPrev = (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.preventDefault();
        if (imageCount <= 1) return;
        setImageIdx((prev) => (prev <= 0 ? imageCount - 1 : prev - 1));
    };
    const goNext = (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.preventDefault();
        if (imageCount <= 1) return;
        setImageIdx((prev) => (prev >= imageCount - 1 ? 0 : prev + 1));
    };
    const onImageKeyDown = (e: React.KeyboardEvent) => {
        if (!isCarousel) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
        if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
    };

    // Navigation du carrousel en plein écran (zoom) : met à jour imageIdx ET l'image zoomée.
    const zoomPrev = () => {
        if (imageCount <= 1) return;
        const nextIdx = safeIdx <= 0 ? imageCount - 1 : safeIdx - 1;
        setImageIdx(nextIdx);
        setZoomUrl(activeTab.images[nextIdx].imageUrl);
    };
    const zoomNext = () => {
        if (imageCount <= 1) return;
        const nextIdx = safeIdx >= imageCount - 1 ? 0 : safeIdx + 1;
        setImageIdx(nextIdx);
        setZoomUrl(activeTab.images[nextIdx].imageUrl);
    };

    const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = tabs.length - 1;
        let next = -1;
        if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
        if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = last;
        if (next >= 0) {
            e.preventDefault();
            setActiveKey(tabs[next].key);
            document.getElementById(`story-tab-${tabs[next].key}`)?.focus();
        }
    };

    return (
        <section id="produit" className="w-full border-t border-border py-20">
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mb-10">
                    <p className="text-caption font-semibold uppercase tracking-[0.14em] text-success mb-4">
                        Produit
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
                        Conçu pour que la guilde joue ensemble.
                    </h2>
                </div>

                {/* Barre d'onglets (scroll horizontal si beaucoup d'onglets) */}
                <div
                    role="tablist"
                    aria-label="Fonctionnalités SigilOS"
                    className="flex gap-1 border-b border-border mb-8 overflow-x-auto overflow-y-hidden no-scrollbar"
                >
                    {tabs.map((t, idx) => (
                        <button
                            key={t.key}
                            role="tab"
                            id={`story-tab-${t.key}`}
                            aria-selected={t.key === activeTab.key}
                            aria-controls={`story-panel-${t.key}`}
                            onClick={() => setActiveKey(t.key)}
                            onKeyDown={(e) => onTabKeyDown(e, idx)}
                            className={cn(
                                "px-4 py-2.5 rounded-t-lg text-body-sm font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px",
                                t.key === activeTab.key
                                    ? "text-foreground border-success"
                                    : "text-muted-foreground border-transparent hover:text-foreground"
                            )}
                        >
                            {t.label}
                            {t.images.length > 1 && (
                                <span className="ml-1.5 text-caption text-success/80 font-bold tabular-nums">{t.images.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                <div
                    role="tabpanel"
                    id={`story-panel-${activeTab.key}`}
                    aria-labelledby={`story-tab-${activeTab.key}`}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
                >
                    <div>
                        <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight mb-3">
                            {activeImage.title || activeImage.label || activeTab.label}
                        </h3>
                        {activeImage.description && (
                            <p className="text-muted-foreground text-[15px] leading-relaxed mb-5">
                                {activeImage.description}
                            </p>
                        )}
                    </div>

                    <div className="space-y-3">
                        {/* Carrousel : image active + flèches + compteur + zoom */}
                        <div
                            className="relative w-full overflow-hidden rounded-xl border border-border bg-surface aspect-[16/10]"
                            onKeyDown={onImageKeyDown}
                            onMouseEnter={pauseOnHover}
                            onMouseLeave={resumeOnLeave}
                            tabIndex={isCarousel ? 0 : undefined}
                            role={isCarousel ? "group" : undefined}
                            aria-roledescription={isCarousel ? "carrousel" : undefined}
                            aria-label={isCarousel ? `Carrousel de ${imageCount} captures` : undefined}
                        >
                            {/* Zoom plein écran au clic */}
                            <button
                                type="button"
                                onClick={() => setZoomUrl(activeImage.imageUrl)}
                                className="absolute inset-0 z-10 cursor-zoom-in"
                                aria-label="Agrandir la capture d'écran"
                            />
                            <Image
                                src={activeImage.imageUrl}
                                alt={activeImage.alt || activeImage.label || "Capture d'écran SigilOS"}
                                fill
                                sizes="(max-width: 768px) 100vw, 520px"
                                className="object-cover object-top"
                            />

                            {/* Flèches carrousel + compteur */}
                            {isCarousel && (
                                <>
                                    <button
                                        type="button"
                                        onClick={goPrev}
                                        aria-label="Capture précédente"
                                        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center border border-white/10 transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goNext}
                                        aria-label="Capture suivante"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center border border-white/10 transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                    <span className="absolute bottom-2 right-2 z-20 text-caption font-bold bg-black/60 text-white px-2 py-0.5 rounded-full tabular-nums">
                                        {safeIdx + 1} / {imageCount}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setAutoplayOn((v) => !v)}
                                        aria-label={autoplayOn && !paused ? "Mettre en pause la lecture automatique" : "Activer la lecture automatique"}
                                        className="absolute bottom-2 left-2 z-20 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/10 transition-colors"
                                    >
                                        {autoplayOn && !paused ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    </button>
                                </>
                            )}
                        </div>


                        {/* Galerie : miniatures quand plusieurs images dans l'onglet */}
                        {activeTab.images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                {activeTab.images.map((img, idx) => (
                                    <button
                                        key={img.id}
                                        type="button"
                                        onClick={() => setImageIdx(idx)}
                                        aria-label={`Voir la capture ${idx + 1}`}
                                        className={cn(
                                            "relative w-24 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer",
                                            idx === imageIdx
                                                ? "border-success"
                                                : "border-transparent opacity-60 hover:opacity-100 hover:border-border"
                                        )}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={img.imageUrl}
                                            alt={img.alt || img.label || ""}
                                            className="w-full h-full object-cover object-top"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 🖼️ #140 — zoom plein écran du screen (+ navigation carrousel) */}
            {zoomUrl && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setZoomUrl(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Capture d'écran agrandie"
                >
                    <div className="relative w-full max-w-6xl max-h-[92vh]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={zoomUrl}
                            alt="Capture d'écran SigilOS agrandie"
                            className="w-full h-full max-h-[92vh] object-contain rounded-xl border border-border shadow-2xl"
                        />
                    </div>

                    {isCarousel && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); zoomPrev(); }}
                                aria-label="Capture précédente"
                                className="fixed left-4 top-1/2 -translate-y-1/2 z-[210] h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 transition-colors"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); zoomNext(); }}
                                aria-label="Capture suivante"
                                className="fixed right-4 top-1/2 -translate-y-1/2 z-[210] h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20 transition-colors"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                            <span className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] text-caption font-bold bg-black/70 text-white px-3 py-1 rounded-full tabular-nums">
                                {safeIdx + 1} / {imageCount}
                            </span>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}

