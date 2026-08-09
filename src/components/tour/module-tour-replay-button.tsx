"use client";

import { useTour, TourPhase } from "./tour-provider";
import { CircleHelp } from "lucide-react";

/**
 * Bouton « Tutoriel » générique, réutilisable sur TOUS les modules
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
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500/50 text-xs font-black uppercase tracking-widest text-orange-300 transition-all active:scale-95"
        >
            <CircleHelp className="w-4 h-4 text-orange-400" />
            Tutoriel
        </button>
    );
}
