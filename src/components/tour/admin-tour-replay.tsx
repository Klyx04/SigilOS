"use client";

import { useTour } from "./tour-provider";

/**
 * Bouton « Revoir le tour » — rejoue le tour admin dynamique.
 * Adapte le volet selon l'état d'onboarding :
 *  - guilde en cours de config → tour onboarding (admin)
 *  - guilde déjà configurée → tour des modules/briques (adminModules)
 * Visible uniquement par un admin (rendu conditionné côté page).
 */
export function AdminTourReplay({ user }: { user?: any }) {
    const { startTour } = useTour();
    const isOnboardingComplete = !!user?.isOnboardingComplete;

    return (
        <button
            type="button"
            onClick={() => startTour(isOnboardingComplete ? "adminModules" : "admin")}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-zinc-200 transition-all active:scale-95"
        >
            <span aria-hidden>🎓</span>
            Revoir le tour
        </button>
    );
}