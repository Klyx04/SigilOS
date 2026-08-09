"use client";

import { useTour } from "@/components/tour/tour-provider";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

/**
 * Bouton « Revoir le tour » — relance le tutoriel du profil perso à la demande.
 * Contextualisé : ne pointe que les blocs du profil visibles par l'utilisateur.
 */
export function ProfileTourReplayButton() {
    const { startTour } = useTour();
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => startTour("profile")}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all gap-2"
        >
            <GraduationCap className="w-4 h-4 text-violet-400" />
            Revoir le tour
        </Button>
    );
}
