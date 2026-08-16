"use client";

import { useTour } from "@/components/tour/tour-provider";
import { Button } from "@/components/ui/button";
import { CircleHelp } from "lucide-react";

/**
 * Bouton « Tutoriel » — relance le tutoriel du profil perso à la demande.
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
            className="border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 hover:text-orange-300 text-orange-300 text-caption font-black uppercase tracking-widest rounded-xl transition-all gap-2"
        >
            <CircleHelp className="w-4 h-4 text-orange-400" />
            Tutoriel
        </Button>
    );
}
