import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Icône de jeu : **asset Dofus réel** (`public/assets/dofus/game-icons/`), jamais un glyphe
 * générique ni un emoji — même convention que `public-header.tsx` (« l'asset qui identifie
 * l'entrée en jeu »). Décorative : `alt=""` + `aria-hidden`, le sens est porté par le libellé.
 *
 * Source unique : l'annuaire (`member-directory.tsx`) et le module Membres la consomment.
 */
export function GameIcon({ src, className }: { src: string; className?: string }) {
    return (
        <Image
            src={`/assets/dofus/game-icons/${src}`}
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
            className={cn("object-contain", className)}
        />
    );
}
