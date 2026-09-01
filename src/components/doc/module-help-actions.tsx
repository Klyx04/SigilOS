"use client";

import React from "react";
import { BookOpen, CircleHelp } from "lucide-react";
import { useDocDrawer } from "./doc-drawer-context";
import { useTour, TourPhase } from "@/components/tour/tour-provider";
import { cn } from "@/lib/utils";

interface ModuleHelpActionsProps {
    docSlug?: string;
    docTitle?: string;
    tourPhase?: TourPhase;
    className?: string;
}

export function ModuleHelpActions({
    docSlug,
    docTitle,
    tourPhase,
    className,
}: ModuleHelpActionsProps) {
    const { openDoc } = useDocDrawer();
    let tourContext: ReturnType<typeof useTour> | null = null;
    try {
        tourContext = useTour();
    } catch {
        // Safe fallback if not wrapped in TourProvider
    }

    return (
        <div className={cn("inline-flex items-center gap-2", className)}>
            {/* 1. Bouton Documentation Pro */}
            {docSlug && (
                <button
                    type="button"
                    onClick={() => openDoc(docSlug, docTitle)}
                    title={docTitle ? `Ouvrir la documentation : ${docTitle}` : "Ouvrir la documentation"}
                    className="inline-flex items-center gap-2 px-3.5 h-9 rounded-xl border border-border bg-surface/70 hover:bg-surface hover:border-teal-500/30 text-xs font-bold text-foreground/90 hover:text-teal-300 transition-all duration-200 shadow-sm active:scale-95 group"
                >
                    <BookOpen className="w-3.5 h-3.5 text-teal-400/80 group-hover:text-teal-300 transition-colors shrink-0" />
                    <span>Documentation</span>
                </button>
            )}

            {/* 2. Bouton Tutoriel Pro */}
            {tourPhase && tourContext && (
                <button
                    type="button"
                    onClick={() => tourContext?.startTour(tourPhase)}
                    title="Lancer le tutoriel interactif de ce module"
                    className="inline-flex items-center gap-2 px-3.5 h-9 rounded-xl border border-border bg-surface/50 hover:bg-surface hover:border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200 shadow-sm active:scale-95 group"
                >
                    <CircleHelp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    <span>Tutoriel</span>
                </button>
            )}
        </div>
    );
}
