"use client";

import { useEffect, useState, type ReactNode } from "react";

interface MissionArtworkImageProps {
    /** Visuel précis (asset local ou proxy interne). */
    src: string | null;
    /** Repli quand le fichier n'existe pas sur CE serveur (bannière/picto de catégorie). */
    fallbackSrc?: string | null;
    alt: string;
    className?: string;
    /** Rendu final quand aucune image n'est disponible (pictogramme de catégorie). */
    children?: ReactNode;
}

/**
 * Vignette d'illustration de mission avec **repli à deux étages**.
 *
 * Mesure du 17/11/2026 : `public/game-data` est un **bind mount** en production
 * (`sync-assets.sh`), donc plus frais que le dépôt ; un chemin calculé peut désigner un
 * fichier pas encore synchronisé. L'ancien `onError` se contentait de masquer l'image —
 * la carte restait vide. Ici : visuel précis → bannière de catégorie → pictogramme.
 */
export function MissionArtworkImage({
    src,
    fallbackSrc = null,
    alt,
    className,
    children,
}: MissionArtworkImageProps) {
    // 0 = visuel précis, 1 = bannière de repli, 2 = pictogramme
    const [stage, setStage] = useState<0 | 1 | 2>(0);

    // Une nouvelle mission réarme le repli (sinon une carte garderait l'échec de la précédente).
    useEffect(() => {
        setStage(0);
    }, [src, fallbackSrc]);

    const url = stage === 0 ? src ?? fallbackSrc : stage === 1 ? fallbackSrc : null;
    if (!url) return <>{children}</>;

    return (
        <img
            src={url}
            alt={alt}
            className={className}
            loading="lazy"
            onError={() =>
                setStage((current) =>
                    current === 0 && fallbackSrc && fallbackSrc !== src ? 1 : 2,
                )
            }
        />
    );
}
