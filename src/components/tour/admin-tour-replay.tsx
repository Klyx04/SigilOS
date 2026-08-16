"use client";

import { useTour, TourPhase } from "./tour-provider";
import { CircleHelp } from "lucide-react";

/**
 * Bouton « Tutoriel » — relance le tour du MODULE COURANT.
 * Ne liste plus les autres tours : chaque page admin expose son propre tour
 * via la prop `phase` (ex: "adminSettings", "adminPermissions", "adminOverview"...).
 * Le tour reste rejouable à tout moment.
 */
export function AdminTourReplay({ phase }: { phase: TourPhase }) {
    const { startTour } = useTour();

    return (
        <button
            type="button"
            onClick={() => startTour(phase)}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-warning/30 bg-warning/10 hover:bg-warning/20 hover:border-warning/50 text-xs font-black uppercase tracking-widest text-warning transition-all active:scale-95"
        >
            <CircleHelp className="w-4 h-4 text-warning" />
            Tutoriel
        </button>
    );
}