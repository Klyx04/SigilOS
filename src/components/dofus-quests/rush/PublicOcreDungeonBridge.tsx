"use client";

import { useEffect } from "react";
import { getPublicOcreProgress } from "@/server/actions/public-profile-actions";

/**
 * V-H — pont **lazy** entre le guide public et la progression Ocre du visiteur connecté.
 *
 * Le guide public n'importe aucun `@/server/` (verrou `rush-public-parity`) : ce composant
 * voisin porte le seul appel. Il ne part **que** quand un panneau donjon ou la fiche détail
 * s'ouvre (`enabled`), et **fail-soft** : un échec laisse la liste vide (`unknown`) — jamais
 * un faux « à capturer ».
 *
 * Chantier 4 (F1) — le pont remonte aussi le **résumé** (captures, étape de la quête
 * Metamob) : la progression « par Dofus » affiche ainsi deux mesures séparées pour l'Ocre,
 * les blocs du guide d'un côté, les captures Metamob de l'autre. Jamais un seul pourcentage.
 */

/** Ce que la page peut afficher de l'Ocre Metamob, sans jamais exposer la clé. */
export type PublicOcreSnapshot = {
    /** Noms des monstres déjà possédés (état « capturé » des donjons). */
    capturedNames: string[];
    captured: number;
    total: number;
    progress: number;
    currentStep: number;
    stepCount: number | null;
};

export function PublicOcreDungeonBridge({
    enabled,
    onLoaded,
}: {
    enabled: boolean;
    onLoaded: (snapshot: PublicOcreSnapshot) => void;
}) {
    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        void getPublicOcreProgress()
            .then((result) => {
                if (!alive || !result.success) return;
                onLoaded({
                    capturedNames: result.monsters
                        .filter((monster) => monster.owned > 0)
                        .map((monster) => monster.name),
                    captured: result.captured,
                    total: result.total,
                    progress: result.progress,
                    currentStep: result.currentStep,
                    stepCount: result.stepCount ?? null,
                });
            })
            .catch(() => {
                // Fail-soft assumé : le panneau reste lisible, l'état ocre sera `unknown`.
            });
        return () => {
            alive = false;
        };
    }, [enabled, onLoaded]);

    return null;
}
