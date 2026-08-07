"use client";

import { useTour, TourPhase } from "./tour-provider";
import { GraduationCap } from "lucide-react";

/**
 * Bouton « Revoir le tour » — relance le tour du MODULE COURANT.
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
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-zinc-200 transition-all active:scale-95"
        >
            <GraduationCap className="w-4 h-4" />
            Revoir le tour
        </button>
    );
}