/**
 * Picto Dofus d'une notion Songes (palier/difficulté, objectif, épreuve, salle).
 *
 * Source unique : `asset` du référentiel `src/lib/songes/types.ts` — le même PNG
 * que celui utilisé par les embeds Discord et par les cartes. Plus d'emoji décoratif
 * (🎯💎🏆✨📜) : un picto Dofus officiel, partout, à la même échelle.
 */
import { cn } from "@/lib/utils";

interface SongesPictoProps {
    /** Chemin local (`/assets/missions/reve1.png`, `/assets/dofus/icons/quests.png`). */
    asset?: string | null;
    /** Côté en pixels. Les fichiers sont en 2x : ils restent nets jusqu'à ~48 px. */
    size?: number;
    className?: string;
    /** Renseigné ⇒ icône porteuse de sens (lue par les lecteurs d'écran). */
    title?: string;
}

export function SongesPicto({ asset, size = 16, className, title }: SongesPictoProps) {
    if (!asset) return null;
    return (
        <img
            src={asset}
            alt={title ?? ""}
            title={title}
            draggable={false}
            className={cn("object-contain select-none shrink-0", className)}
            style={{ width: size, height: size }}
            aria-hidden={title ? undefined : true}
        />
    );
}
