"use client";

import { useTour, TourPhase } from "./tour-provider";
import { GraduationCap } from "lucide-react";

/**
 * Bouton « Revoir le tour » générique, réutilisable sur TOUS les modules
 * (header de module / actions de `UnifiedModuleHeader`).
 * Visible pour les admins ET les membres : le filtrage se fait au niveau des
 * étapes (module actif + requiresPerm RBAC), pas sur le bouton.
 * Relance le tour du module courant via la prop `phase`.
 */
export function ModuleTourReplayButton({ phase }: { phase: TourPhase }) {
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
