"use client";

/**
 * Emblème de guilde — registre.
 *
 * L'icône vient de Discord (`cdn.discordapp.com`) : elle peut être absente
 * (guilde sans icône) ou ne plus répondre (URL périmée). L'ancien affichage
 * laissait alors un carré noir sans explication, décoré d'une bordure épaisse et
 * d'une ombre portée pour une simple vignette d'identité.
 *
 * Ici : l'icône réelle quand elle se charge, les initiales de la guilde sinon —
 * jamais de case vide, jamais d'ombre. L'emblème est décoratif (le nom de la
 * guilde est toujours écrit à côté) : `alt` vide + `aria-hidden`, donc rien à
 * annoncer aux lecteurs d'écran.
 */

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type GuildEmblemProps = {
    /** URL de l'icône (Discord ou fichier local). `null` accepté. */
    src?: string | null;
    /** Nom de la guilde : sert au repli en initiales. */
    name: string;
    /** Côté du carré, en pixels. */
    size?: number;
    /** Mise en page du conteneur (alignement, marges). */
    className?: string;
    /** Charge l'icône en priorité (emblème au-dessus de la ligne de flottaison). */
    priority?: boolean;
};

export function GuildEmblem({ src, name, size = 96, className, priority = false }: GuildEmblemProps) {
    const [failed, setFailed] = useState(false);
    const initials = (name || "").trim().slice(0, 2).toUpperCase() || "?";
    const showImage = Boolean(src) && !failed;

    return (
        <span
            aria-hidden="true"
            className={cn(
                "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-strong bg-surface",
                className,
            )}
            style={{ width: size, height: size }}
        >
            {showImage ? (
                <Image
                    src={src as string}
                    alt=""
                    width={size}
                    height={size}
                    priority={priority}
                    unoptimized
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover"
                />
            ) : (
                <span
                    className="reg-mono font-semibold text-muted-foreground"
                    style={{ fontSize: Math.max(11, Math.round(size * 0.3)) }}
                >
                    {initials}
                </span>
            )}
        </span>
    );
}
