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
    /**
     * `standalone` (défaut) : deux boutons bordés, autonomes.
     * `grouped` : items SANS bordure, faits pour vivre dans un contenant commun (`divide-x`) —
     * c'est ce qui rend l'en-tête d'un module uniforme au lieu de juxtaposer des boutons étrangers.
     */
    appearance?: "standalone" | "grouped";
}

/** Item autonome (défaut, inchangé pour les 16 autres modules). */
const STANDALONE_ITEM =
    "inline-flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border bg-surface/40 hover:bg-surface hover:border-border-strong text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors";

/** Item d'un groupe : même hauteur, même padding, même graisse que les autres items du groupe. */
const GROUPED_ITEM =
    "inline-flex items-center gap-2 h-full px-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface transition-colors";

export function ModuleHelpActions({
    docSlug,
    docTitle,
    tourPhase,
    className,
    appearance = "standalone",
}: ModuleHelpActionsProps) {
    const { openDoc } = useDocDrawer();
    let tourContext: ReturnType<typeof useTour> | null = null;
    try {
        tourContext = useTour();
    } catch {
        // Safe fallback if not wrapped in TourProvider
    }

    const itemClass = appearance === "grouped" ? GROUPED_ITEM : STANDALONE_ITEM;

    return (
        <div
            className={cn(
                appearance === "grouped"
                    ? "inline-flex items-center h-full divide-x divide-border"
                    : "inline-flex items-center gap-2",
                className
            )}
        >
            {/* 1. Documentation du module — neutre : l'accent reste à l'action principale */}
            {docSlug && (
                <button
                    type="button"
                    onClick={() => openDoc(docSlug, docTitle)}
                    title={docTitle ? `Ouvrir la documentation : ${docTitle}` : "Ouvrir la documentation"}
                    className={itemClass}
                >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>Documentation</span>
                </button>
            )}

            {/* 2. Tutoriel interactif — même langage visuel que la documentation */}
            {tourPhase && tourContext && (
                <button
                    type="button"
                    onClick={() => tourContext?.startTour(tourPhase)}
                    title="Lancer le tutoriel interactif de ce module"
                    className={itemClass}
                >
                    <CircleHelp className="w-3.5 h-3.5 shrink-0" />
                    <span>Tutoriel</span>
                </button>
            )}
        </div>
    );
}
