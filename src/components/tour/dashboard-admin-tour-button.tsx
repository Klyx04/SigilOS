"use client";

import { useTour } from "./tour-provider";
import { GraduationCap } from "lucide-react";

/**
 * Bouton flottant « Revoir le tour » affiché sur le Dashboard pour un admin.
 * Rejoue le tour des modules (adminModules) filtré par RBAC + modules actifs.
 * Le tour reste accessible à tout moment, pendant ou après l'onboarding.
 */
export function DashboardAdminTourButton({ isAdmin }: { isAdmin?: boolean }) {
    const { startTour } = useTour();
    if (!isAdmin) return null;

    return (
        <button
            type="button"
            onClick={() => startTour("adminModules")}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-zinc-200 transition-all active:scale-95"
            aria-label="Revoir le tour des modules"
        >
            <GraduationCap className="w-4 h-4" />
            Revoir le tour
        </button>
    );
}