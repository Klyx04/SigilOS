"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getGuildActivityToasts } from "@/server/actions/unified-activity-actions";

/** Identifiant du Toaster **dédié** (monté en haut à droite par `AppToaster`) — jamais celui du bas. */
export const GUILD_ACTIVITY_TOASTER_ID = "guild-activity";

/** Cadence de rafraîchissement : l'activité de guilde n'a pas besoin de la seconde près. */
const POLL_INTERVAL_MS = 30_000;

/** Durée d'affichage d'une bulle (assez pour être lue, assez court pour ne pas gêner). */
const TOAST_DURATION_MS = 8000;

/**
 * Chantier **N**, lot **N-3** — les bulles d'activité de guilde, pour **tous les membres connectés** :
 * « wylan a validé ceci », « wylan passe la barre des 1 000 points de succès ! ».
 *
 * Ce qui n'est **pas** fait ici, volontairement :
 * · aucune copie en base par membre (décision du 15/10/2026) — la bulle est une **conséquence** de
 *   la ligne unique du flux ;
 * · aucun filtre de préférences côté navigateur : `getGuildActivityToasts` filtre **côté serveur**
 *   avec `notificationPrefs`, donc une annonce coupée ne quitte jamais la base ;
 * · pas d'`EventSource` ni de WebSocket : on lit à intervalle régulier, comme la cloche existante
 *   (`notification-bell.tsx:102`, polling 10 s).
 *
 * Le **premier** chargement ne produit **aucune** bulle : sinon, ouvrir la page ferait pleuvoir
 * toutes les dernières lignes à chaque visite. On ne fête donc que ce qui arrive **après** l'arrivée.
 */
export function ActivityToaster({ guildId }: { guildId: string }) {
    const knownIds = useRef<Set<string> | null>(null);

    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            const lines = await getGuildActivityToasts(guildId, 6);
            if (cancelled || !Array.isArray(lines)) return;

            if (knownIds.current === null) {
                // Première photographie du flux : on mémorise, on ne notifie rien.
                knownIds.current = new Set(lines.map((line) => `${line.type}:${line.id}`));
                return;
            }

            const fresh = lines
                .filter((line) => !knownIds.current!.has(`${line.type}:${line.id}`))
                .reverse(); // du plus ancien au plus récent, sinon l'ordre d'arrivée est inversé

            for (const line of fresh) {
                knownIds.current.add(`${line.type}:${line.id}`);
                toast(line.summary, {
                    toasterId: GUILD_ACTIVITY_TOASTER_ID,
                    duration: TOAST_DURATION_MS,
                    // L'**asset de l'objet** annoncé d'abord (illustration de donjon, icône de Dofus,
                    // picto de succès — déjà borné au chemin interne côté serveur), puis l'**avatar**
                    // Discord de l'acteur. Un cadeau visible vaut mieux qu'un texte seul.
                    icon: line.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- chemin interne validé en amont
                        <img src={line.imageUrl} alt="" className="h-6 w-6 rounded-[4px] object-contain" />
                    ) : line.actor?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- avatar distant (Discord), déjà borné
                        <img src={line.actor.image} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : undefined,
                });
            }
        };

        void poll();
        const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [guildId]);

    return null; // aucune UI propre : les bulles vivent dans le Toaster dédié
}
