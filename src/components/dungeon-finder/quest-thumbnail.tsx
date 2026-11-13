"use client";

import { useState } from "react";

import { QUEST_ICON_FALLBACK, questThumbnail } from "@/lib/dungeon-finder-utils";
import { cn } from "@/lib/utils";

/**
 * Vignette d'une quête — **jamais d'image cassée** (même promesse que `AchievementIcon`).
 *
 * La règle du chemin reste `questThumbnail` (pure) : visuel curé en God → **carte de lancement**
 * de la quête (`startPosition[].mapId` → `/game-data/hd_maps/{id}.webp`, asset du jeu) → icône de
 * quête Dofus. Ce composant ajoute le seul point qui manquait : si l'image ne charge pas, on
 * retombe sur l'icône de quête **sans boucle** (un repli qui échoue ne se rejoue pas).
 */
export function QuestThumbnail({
    quest,
    className,
}: {
    /** Objet quête : `{ imageUrl }` suffit, `{ startPosition }` est accepté (règle complète). */
    quest: { imageUrl?: string | null; startPosition?: unknown } | null | undefined;
    /** Classes de l'image (cadrage, arrondi…). */
    className?: string;
}) {
    const [src, setSrc] = useState(() => questThumbnail(quest));

    return (
        <img
            src={src}
            alt=""
            loading="lazy"
            onError={() => setSrc((current) => (current === QUEST_ICON_FALLBACK ? current : QUEST_ICON_FALLBACK))}
            className={cn("w-full h-full object-cover", className)}
        />
    );
}
