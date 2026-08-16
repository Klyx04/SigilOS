"use client";

import { useEffect, useState } from "react";
import { AvatarImage } from "@/components/ui/avatar";
import { normalizeDiscordAvatarUrl, discordAvatarErrorFallback } from "@/lib/discord-avatars";

interface DiscordAvatarImageProps {
    src?: string | null;
    alt?: string;
    className?: string;
}

/**
 * #23 — Avatar Discord résilient :
 *  - normalise les URLs OAuth persistées en base (`.png` sans `?size` → webp 256px) ;
 *  - bascule sur le miroir `media.discordapp.net` en cas d'erreur/429 du CDN principal ;
 *  - hash périmé (404 durable) → rend null pour laisser l'AvatarFallback s'afficher ;
 *  - lazy-loading + décodage asynchrone pour ne pas saturer le CDN sur les longues listes.
 */
export function DiscordAvatarImage({ src, alt, className }: DiscordAvatarImageProps) {
    const [currentSrc, setCurrentSrc] = useState<string | null>(() => (src ? normalizeDiscordAvatarUrl(src, 256) : null));

    useEffect(() => {
        setCurrentSrc(src ? normalizeDiscordAvatarUrl(src, 256) : null);
    }, [src]);

    const handleError = () => {
        if (!currentSrc) return;
        const mirror = discordAvatarErrorFallback(currentSrc);
        if (mirror && mirror !== currentSrc) {
            setCurrentSrc(mirror);
        } else {
            // URL morte (hash périmé) ou miroir déjà tenté → fallback initiales.
            setCurrentSrc(null);
        }
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
