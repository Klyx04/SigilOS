"use client";

import { useEffect } from "react";
import { openGodSession, updateGodSessionHeartbeat, closeGodSession } from "@/server/actions/god-session-actions";

/**
 * R4 — Traqueur de session God (GodSessionLog).
 * "use client" car le layout God est un Server Component ; ce petit composant
 * ouvre / ferme / heartbeat la session active au fil de l'eau.
 * Fail-closed : toutes les actions serveur sont best-effort (ne lèvent jamais).
 */
export function GodSessionTracker() {
    useEffect(() => {
        // Ouvre (ou réutilise) la session active au chargement.
        openGodSession();

        // Heartbeat toutes les 60s pour tenir lastSeenAt à jour.
        const heartbeat = setInterval(() => {
            updateGodSessionHeartbeat();
        }, 60_000);

        // Fermeture propre de la session quand l'utilisateur quitte le panel.
        const close = () => {
            closeGodSession();
        };

        // Fermeture au démontage (navigation / déconnexion).
        window.addEventListener("beforeunload", close);

        return () => {
            clearInterval(heartbeat);
            window.removeEventListener("beforeunload", close);
            closeGodSession();
        };
    }, []);

    return null;
}