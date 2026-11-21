"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";

import { getDungeonAchievementIconUrl } from "@/lib/achievement-icon";
import { cn } from "@/lib/utils";

type AchievementLike = {
    imageUrl?: string | null;
    slug?: string | null;
    iconUrl?: string | null;
    challenge?: { slug?: string | null; iconUrl?: string | null } | null;
};

/**
 * Icône d'un succès de donjon — **source unique** : résolution proxy (`getDungeonAchievementIconUrl`)
 * puis repli **rendu** (trophée) quand le fichier manque.
 *
 * 🐛 Mesure du 21/11/2026 : deux surfaces laissaient une **case sombre** — God rendait
 * `challenge.iconUrl` brut, et le tracker faisait `display: none` sur l'image cassée. Un `onError`
 * doit **remplacer** l'image, jamais la masquer.
 */
export function DungeonAchievementIcon({
    achievement,
    className,
    fallbackClassName,
}: {
    achievement: AchievementLike | null | undefined;
    className?: string;
    fallbackClassName?: string;
}) {
    const [broken, setBroken] = useState(false);
    const src = getDungeonAchievementIconUrl(achievement);

    if (!src || broken) {
        return (
            <Trophy
                className={cn("shrink-0 text-muted-foreground", fallbackClassName ?? "h-4 w-4", className)}
                aria-hidden="true"
            />
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setBroken(true)}
            className={cn("shrink-0 object-contain", className)}
        />
    );
}