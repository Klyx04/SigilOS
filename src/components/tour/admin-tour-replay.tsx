"use client";

import { useTour } from "./tour-provider";

/**
 * Bouton « Revoir le tour » — rejoue le tour admin dynamique.
 * Visible uniquement par un admin (rendu conditionné côté page).
 */
export function AdminTourReplay() {
    const { startTour } = useTour();

    return (
        <button
            type="button"
            onClick={() => startTour("admin")}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-zinc-200 transition-all active:scale-95"
        >
            <span aria-hidden>🎓</span>
            Revoir le tour
        </button>
    );
}