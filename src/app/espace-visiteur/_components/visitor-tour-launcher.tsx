"use client";

import { useEffect, useRef } from "react";
import { useTour } from "@/components/tour/tour-provider";
import {
    shouldAutoStartVisitorTour,
    VISITOR_TOUR_QUERY_PARAM,
    VISITOR_TOUR_STORAGE_KEY,
} from "@/lib/public-tour";

/**
 * Visite de **première arrivée** dans l'espace visiteur.
 *
 * Règles (le tour lui-même vit dans le provider public) :
 *  - elle s'ouvre **une seule fois par navigateur** (`VISITOR_TOUR_STORAGE_KEY`) ;
 *  - `?tour=1` la rejoue à la demande, depuis Réglages ;
 *  - elle est **fermable** à tout moment (« Passer », Échap) et **rejouable** ;
 *  - elle n'attend aucune donnée serveur : les ancres sont posées par le rendu
 *    de la page, un court délai laisse le navigateur peindre avant le spotlight.
 *
 * Le composant ne rend rien : il ne déplace aucun bloc, il ne fait que démarrer
 * la visite quand les conditions sont réunies.
 */
export function VisitorTourLauncher() {
    const { startTour, isActive } = useTour();
    const started = useRef(false);

    useEffect(() => {
        if (started.current || isActive) return;

        const requested = new URLSearchParams(window.location.search).get(VISITOR_TOUR_QUERY_PARAM);
        const stored = window.localStorage.getItem(VISITOR_TOUR_STORAGE_KEY);
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
            window.localStorage.setItem(VISITOR_TOUR_STORAGE_KEY, "1");
            startTour("visitorSpace");
        }, 450);
        return () => window.clearTimeout(timer);
    }, [isActive, startTour]);

    return null;
}
