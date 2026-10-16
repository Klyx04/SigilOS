"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";

import { getAchievementIconUrl } from "@/lib/achievement-icon";
import { cn } from "@/lib/utils";

/**
 * Icône d'un succès — **jamais d'image cassée** (règle unique du rendu).
 *
 * 🐛 Mesure du 16/10/2026 (captures user sur les posts DJ) : trois succès portaient un chemin
 * **mort** (`/game-data/achievements/econome.webp`, `…/intouchable.webp`, `…/temps-qui-court.webp`)
 * — stocké en base, absent du dépôt — et un (`donjon-valide`) n'en portait aucun. Les écrans DJ
 * rendaient `<img>` **sans repli** ⇒ le navigateur affichait son glyphe « image cassée ». Pire :
 * un post garde un **snapshot** des chemins à sa création, donc un chemin mort peut survivre des
 * mois dans la liste.
 *
 * Deux protections, une seule source :
 *   ① le chemin passe par `getAchievementIconUrl` (asset local **ASCII**, sinon proxy interne
 *      `/api/assets-dofus/…`) — l'URL stockée ne part **jamais** brute dans un `src` ;
 *   ② si l'image ne charge pas (`onError`) ou s'il n'y a rien à charger, on rend le **glyphe de
 *      repli** (Trophy) — **même taille** que l'image, donc aucun décalage de mise en page.
 *
 * ⚠️ Ne passer ici que la valeur **stockée** (`iconUrl` brut) : une URL déjà résolue par
 * `getAchievementIconUrl` (ex. `/api/assets-dofus/challenges/977`) serait re-résolue et perdue
 * (la règle ne reconnaît que `/game-data/…` et les URLs DofusDB).
 */
export function AchievementIcon({
    iconUrl,
    slug = null,
    label = null,
    size = 16,
    className,
    fallbackClassName,
}: {
    /** Chemin stocké (`/game-data/…`, `/api/assets-dofus/…`) ou URL DofusDB — jamais un `/uploads/…`. */
    iconUrl?: string | null;
    /** Slug du challenge : repli d'asset local quand la base ne porte aucun chemin. */
    slug?: string | null;
    /** Nom du succès (`alt`) ; `null` ⇒ icône décorative (le libellé est à côté). */
    label?: string | null;
    /** Taille en pixels — appliquée à l'image **et** au repli (jamais deux tailles différentes). */
    size?: number;
    /** Classes de l'image (arrondi, opacité…). */
    className?: string;
    /** Classes du glyphe de repli (couleur). */
    fallbackClassName?: string;
}) {
    const src = getAchievementIconUrl(slug, iconUrl ?? null);
    const [broken, setBroken] = useState(false);

    if (!src || broken) {
        return (
            <Trophy
                aria-hidden
                className={cn("shrink-0 text-muted-foreground/60", fallbackClassName)}
                style={{ width: size, height: size }}
            />
        );
    }

    return (
        <img
            src={src}
            alt={label ?? ""}
            loading="lazy"
            onError={() => setBroken(true)}
            className={cn("shrink-0 object-contain", className)}
            style={{ width: size, height: size }}
        />
    );
}
