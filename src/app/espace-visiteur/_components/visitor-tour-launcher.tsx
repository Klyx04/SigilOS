"use client";

import { useEffect, useRef } from "react";
import { useTour } from "@/components/tour/tour-provider";
import {
    shouldAutoStartVisitorTour,
    VISITOR_TOUR_QUERY_PARAM,
    VISITOR_TOUR_STORAGE_KEY,
} from "@/lib/public-tour";

type VisitorTourPhase = "visitorSpace" | "visitorOnboarding";

/**
 * Visite de **première arrivée** dans l'espace visiteur.
 *
 * Règles (le tour lui-même vit dans le provider public) :
 *  - elle s'ouvre **une seule fois par navigateur** (`storageKey`) ;
 *  - `?tour=1` la rejoue à la demande, depuis Réglages ;
 *  - elle est **fermable** à tout moment (« Passer », Échap) et **rejouable** ;
 *  - elle n'attend aucune donnée serveur : les ancres sont posées par le rendu
 *    de la page, un court délai laisse le navigateur peindre avant le spotlight.
 *
 * Deux phases : `visitorOnboarding` sur l'écran de création (3 pas, toutes les
 * ancres existent), `visitorSpace` une fois le profil créé (11 pas).
 *
 * Le composant ne rend rien : il ne déplace aucun bloc, il ne fait que démarrer
 * la visite quand les conditions sont réunies.
 */
export function VisitorTourLauncher({
    phase = "visitorSpace",
    storageKey = VISITOR_TOUR_STORAGE_KEY,
}: {
    phase?: VisitorTourPhase;
    storageKey?: string;
}) {
    const { startTour, isActive } = useTour();
    const started = useRef(false);

    useEffect(() => {
        if (started.current || isActive) return;

        const requested = new URLSearchParams(window.location.search).get(VISITOR_TOUR_QUERY_PARAM);
        const stored = window.localStorage.getItem(storageKey);
        if (!shouldAutoStartVisitorTour(stored, requested)) return;

        started.current = true;

        // Rejeu explicite : on retire `?tour=1` pour qu'un rechargement ne relance pas.
        if (requested) {
            window.history.replaceState({}, "", window.location.pathname);
        }

        // Le drapeau n'est posé qu'au **démarrage effectif** : si la page est
        // re-rendue entre-temps (création de profil + `router.refresh()`), le tour
        // n'est pas perdu — le prochain montage le relance.
        const timer = window.setTimeout(() => {
            window.localStorage.setItem(storageKey, "1");
            startTour(phase);
        }, 450);
        return () => window.clearTimeout(timer);
    }, [isActive, phase, startTour, storageKey]);

    return null;
}
