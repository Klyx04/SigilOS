"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PublicLandingScreen } from "@/server/actions/landing-screen-actions";

interface ProductStoryProps {
    /** Screens pilotés par le God (#140) — sinon fallback sur les captures par défaut. */
    screens?: PublicLandingScreen[];
}

export function ProductStory({ screens = [] }: ProductStoryProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [zoomUrl, setZoomUrl] = useState<string | null>(null);
    const activeIndex = activeId === null
        ? 0
        : Math.max(0, screens.findIndex((s) => s.id === activeId));
    const active = screens[activeIndex];

    if (!active) return null;

    const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = screens.length - 1;
        let next = -1;
        if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
        if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = last;
        if (next >= 0) {
            e.preventDefault();
            setActiveId(screens[next].id);
            document.getElementById(`story-tab-${screens[next].id}`)?.focus();
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

                {/* #140 : vignettes + aperçu actif (progressive disclosure) */}
                <div
                    role="tablist"
                    aria-label="Fonctionnalités SigilOS"
                    className="flex gap-1 border-b border-border mb-8 overflow-x-auto overflow-y-hidden no-scrollbar"
                >
                    {screens.map((s, idx) => (
                        <button
                            key={s.id}
                            role="tab"
                            id={`story-tab-${s.id}`}
                            aria-selected={s.id === active.id}
                            aria-controls={`story-panel-${s.id}`}
                            onClick={() => setActiveId(s.id)}
                            onKeyDown={(e) => onTabKeyDown(e, idx)}
                            className={cn(
                                "px-4 py-2.5 rounded-t-lg text-body-sm font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px",
                                s.id === active.id
                                    ? "text-foreground border-success"
                                    : "text-muted-foreground border-transparent hover:text-foreground"
                            )}
                        >
                            {s.label || `Screen ${idx + 1}`}
                        </button>
                    ))}
                </div>

                <div
                    role="tabpanel"
                    id={`story-panel-${active.id}`}
                    aria-labelledby={`story-tab-${active.id}`}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
                >
                    <div>
                        <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight mb-3">
                            {active.title || (active.label || "SigilOS")}
                        </h3>
                        {active.description && (
                            <p className="text-muted-foreground text-[15px] leading-relaxed mb-5">
                                {active.description}
                            </p>
                        )}
                    </div>
                    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-surface aspect-[16/10]">
                        <button
                            type="button"
                            onClick={() => setZoomUrl(active.imageUrl)}
                            className="absolute inset-0 z-10 cursor-zoom-in"
                            aria-label="Agrandir la capture d'écran"
                        />
                        <Image
                            src={active.imageUrl}
                            alt={active.alt || active.label || "Capture d'écran SigilOS"}
                            fill
                            sizes="(max-width: 768px) 100vw, 520px"
                            className="object-cover object-top"
                        />
                    </div>
                </div>
            </div>

            {/* 🖼️ #140 — zoom plein écran du screen */}
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
                </div>
            )}
        </section>
    );
}
