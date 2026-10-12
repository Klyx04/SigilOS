"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logPublicPageView } from "@/server/actions/telemetry-public-actions";
import { publicScreenKey } from "@/lib/telemetry/public";

/**
 * Balise de comptage des **écrans publics** (D-2bis, itération 6).
 *
 * Ce qu'elle envoie : **un chemin**, rien d'autre. Pas d'identifiant, pas de cookie, pas de
 * stockage local, pas de user-agent fabriqué (le serveur lit celui de la requête pour écarter
 * les robots, sans le conserver).
 *
 * Ce qu'elle fait quand ce n'est pas un écran public (tableau de bord, God, route technique) :
 * **rien** — la garde `publicScreenKey` est une allowlist (`src/lib/telemetry/public.ts`).
 */

/** Un envoi par écran et par chargement de page (le mode strict de React monte deux fois en dev). */
const sentInThisLoad = new Set<string>();

export function PublicViewBeacon() {
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname || publicScreenKey(pathname) === null) return;
        if (sentInThisLoad.has(pathname)) return;
        sentInThisLoad.add(pathname);

        // Tir-et-oublie : la page publique ne dépend jamais de son compteur.
        void logPublicPageView(pathname).catch(() => {});
    }, [pathname]);

    return null;
}
