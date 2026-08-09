"use client";

import { useTour } from "./tour-provider";
import { CircleHelp } from "lucide-react";

/**
 * Bouton flottant « Tutoriel » affiché sur le Dashboard pour un admin.
 * Rejoue le tour des modules (adminModules) filtré par RBAC + modules actifs.
 * Le tour reste accessible à tout moment, pendant ou après l'onboarding.
 */
export function DashboardAdminTourButton({ isAdmin }: { isAdmin?: boolean }) {
    const { startTour } = useTour();
    if (!isAdmin) return null;

    return (
        <button
            type="button"
            onClick={() => startTour("dashboardBricks")}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500/50 text-xs font-black uppercase tracking-widest text-orange-300 transition-all active:scale-95"
            aria-label="Tutoriel du dashboard"
        >
            <CircleHelp className="w-4 h-4 text-orange-400" />
            Tutoriel
        </button>
    );
}
