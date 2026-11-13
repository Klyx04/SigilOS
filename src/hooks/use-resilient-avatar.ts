"use client";

import * as React from "react";
import { nextDiscordAvatarFallback, normalizeDiscordAvatarUrl, type DiscordAvatarStage } from "@/lib/discord-avatars";

/**
 * #23 + #134 — Résolution résiliente d'une URL d'avatar Discord.
 *
 * **La mécanique unique de secours de toute l'application** : les composants
 * d'avatar (`AvatarImage` Radix, `MemberAvatar`) l'appellent, aucun écran ne
 * réimplémente la cascade. Elle porte exactement les quatre étages historiques :
 *
 *  1. normalisation des URLs persistées en base (`/avatars/{id}/{hash}.png` sans
 *     `?size`) en `webp` léger borné à 256 px ;
 *  2. échec/429 du CDN principal → miroir `media.discordapp.net` ;
 *  3. hash périmé (404 durable → `ERR_BLOCKED_BY_ORB`, cf. #134) → avatar par
 *     défaut **officiel** de Discord (`embed/avatars/{n}.png`, jamais 404) ;
 *  4. dernier recours → `src` = `null` : l'appelant affiche ses initiales.
 *
 * L'étage 3 est celui qui manquait hors annuaire : un membre qui change d'avatar
 * sur Discord garde l'ancien hash dans `User.image` jusqu'au prochain
 * `/api/cron/avatar-resync`, et cet ancien hash répond 404.
 */
export function useResilientAvatarSrc(
    src: string | null | undefined,
    size = 256
): { src: string | null; onError: () => void } {
    const [state, setState] = React.useState<{ src: string | null; stage: DiscordAvatarStage }>(() => ({
        src: typeof src === "string" ? normalizeDiscordAvatarUrl(src, size) : null,
        stage: 0,
    }));

    React.useEffect(() => {
        setState({
            src: typeof src === "string" ? normalizeDiscordAvatarUrl(src, size) : null,
            stage: 0,
        });
    }, [src, size]);

    // La décision d'étage est une règle pure (`src/lib/discord-avatars.ts`) :
    // le hook ne porte que l'état React.
    const onError = React.useCallback(() => {
        setState((previous) => nextDiscordAvatarFallback(previous.src, previous.stage));
    }, []);

    return { src: state.src, onError };
}
