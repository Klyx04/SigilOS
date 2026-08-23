"use client";

import { useContext } from "react";
import { TourContext } from "./tour-provider";
import { CircleHelp } from "lucide-react";

/**
 * Bouton flottant « Tutoriel » affiché sur le Dashboard pour un admin.
 * Rejoue le tour des modules (dashboardBricks) filtré par RBAC + modules actifs.
 * Le tour reste accessible à tout moment, pendant ou après l'onboarding.
 * NB : garde null si le TourContext est absent (ne crash jamais le SSR).
 */
export function DashboardAdminTourButton({ isAdmin }: { isAdmin?: boolean }) {
    const tour = useContext(TourContext);
    if (!isAdmin || !tour) return null;

    return (
        <button
            type="button"
            onClick={() => tour.startTour("dashboardBricks")}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-warning/30 bg-warning/10 hover:bg-warning/20 hover:border-warning/50 text-xs font-semibold uppercase tracking-wider text-warning transition-colors"
            aria-label="Tutoriel du dashboard"
        >
            <CircleHelp className="w-4 h-4 text-warning" />
            Tutoriel
        </button>
    );
}
