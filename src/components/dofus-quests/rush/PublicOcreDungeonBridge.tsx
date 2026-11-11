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
 */
export function PublicOcreDungeonBridge({
    enabled,
    onLoaded,
}: {
    enabled: boolean;
    onLoaded: (capturedNames: string[]) => void;
}) {
    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        void getPublicOcreProgress()
            .then((result) => {
                if (!alive || !result.success) return;
                onLoaded(
                    result.monsters
                        .filter((monster) => monster.owned > 0)
                        .map((monster) => monster.name)
                );
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
