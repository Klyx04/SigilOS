"use client";

import { useState } from "react";
import { useTour, TourPhase } from "./tour-provider";
import { ChevronDown, GraduationCap } from "lucide-react";

const ADMIN_TOUR_PHASES: { phase: TourPhase; label: string }[] = [
    { phase: "adminModules", label: "Modules du Dashboard" },
    { phase: "adminSettings", label: "Paramètres Généraux" },
    { phase: "adminPermissions", label: "Rôles & Permissions" },
    { phase: "adminModulesMgmt", label: "Gestion des Modules" },
    { phase: "adminPresentation", label: "Identité de Guilde" },
    { phase: "adminMissions", label: "Gestion des Missions" },
    { phase: "adminValidation", label: "Validation" },
    { phase: "adminMembers", label: "Gestion des Membres" },
    { phase: "adminLogs", label: "Audit Logs" },
];

export function AdminTourReplay({ user }: { user?: any }) {
    const { startTour } = useTour();
    const [open, setOpen] = useState(false);
    const isOnboardingComplete = !!user?.isOnboardingComplete;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-zinc-200 transition-all active:scale-95"
            >
                <GraduationCap className="w-4 h-4" />
                Revoir le tour
                <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-white/10 bg-zinc-950/95 backdrop-blur-xl shadow-2xl p-2 space-y-0.5">
                        <p className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">Tutoriels rejouables</p>
                        {ADMIN_TOUR_PHASES.map(item => (
                            <button
                                key={item.phase}
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    startTour(item.phase);
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                            >
                                {item.label}
                            </button>
                        ))}
                        {!isOnboardingComplete && (
                            <button
                                type="button"
                                onClick={() => { setOpen(false); startTour("admin"); }}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:bg-white/5 hover:text-white transition-colors border-t border-white/5 mt-1"
                            >
                                🚀 Mise en route (obligatoire)
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
