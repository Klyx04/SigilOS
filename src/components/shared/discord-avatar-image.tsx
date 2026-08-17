"use client";

import { useEffect, useState } from "react";
import { AvatarImage } from "@/components/ui/avatar";
import {
    normalizeDiscordAvatarUrl,
    discordAvatarErrorFallback,
    extractUserIdFromAvatarUrl,
    getDefaultDiscordAvatar,
} from "@/lib/discord-avatars";

interface DiscordAvatarImageProps {
    src?: string | null;
    alt?: string;
    className?: string;
}

/** Étape du fallback : 0 = CDN principal, 1 = miroir media.discordapp.net, 2 = avatar Discord par défaut. */
type AvatarFallbackStage = 0 | 1 | 2;

/**
 * #23 + #134 — Avatar Discord résilient :
 *  - normalise les URLs OAuth persistées en base (`.png` sans `?size` → webp 256px) ;
 *  - bascule sur le miroir `media.discordapp.net` en cas d'erreur/429 du CDN principal ;
 *  - hash périmé (404 durable → ERR_BLOCKED_BY_ORB) → avatar Discord par défaut
 *    (`embed/avatars/{n}.png`) pour ne plus jamais afficher d'image brisée ;
 *  - en tout dernier recours → rend null pour laisser l'AvatarFallback s'afficher ;
 *  - lazy-loading + décodage asynchrone pour ne pas saturer le CDN sur les longues listes.
 */
export function DiscordAvatarImage({ src, alt, className }: DiscordAvatarImageProps) {
    const [currentSrc, setCurrentSrc] = useState<string | null>(() => (src ? normalizeDiscordAvatarUrl(src, 256) : null));
    const [stage, setStage] = useState<AvatarFallbackStage>(0);

    useEffect(() => {
        setCurrentSrc(src ? normalizeDiscordAvatarUrl(src, 256) : null);
        setStage(0);
    }, [src]);

    const handleError = () => {
        if (!currentSrc) return;
        // 0 → 1 : on tente d'abord le miroir `media.discordapp.net`.
        if (stage === 0) {
            const mirror = discordAvatarErrorFallback(currentSrc);
            if (mirror && mirror !== currentSrc) {
                setStage(1);
                setCurrentSrc(mirror);
                return;
            }
        }
        // 1 → 2 : le miroir a échoué (ou pas de miroir) → avatar Discord par défaut.
        if (stage <= 1) {
            const userId = extractUserIdFromAvatarUrl(currentSrc);
            const defaultAvatar = getDefaultDiscordAvatar(userId);
            if (defaultAvatar) {
                setStage(2);
                setCurrentSrc(defaultAvatar);
                return;
            }
        }
        // 2 → null : même l'avatar par défaut a échoué → AvatarFallback (initiales).
        setCurrentSrc(null);
    };

    if (!currentSrc) return null;

    return (
        <AvatarImage
            src={currentSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoadingStatusChange={(status) => {
                if (status === "error") handleError();
            }}
            className={className}
        />
    );
}
