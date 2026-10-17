import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Icône de jeu : **asset Dofus réel** (`public/assets/dofus/game-icons/`), jamais un glyphe
 * générique ni un emoji — même convention que `public-header.tsx` (« l'asset qui identifie
 * l'entrée en jeu »). Décorative : `alt=""` + `aria-hidden`, le sens est porté par le libellé.
 *
 * Source unique : l'annuaire (`member-directory.tsx`) et le module Membres la consomment.
 *
 * ⚠️ Un chemin **absolu** (`/assets/dofus/modules/…`) est rendu tel quel : certains pictos
 * n'existent que dans `modules/` (l'icône de module est déjà versionnée là, cf.
 * `module-catalog.ts`) — on ne la duplique pas dans `game-icons/`. Constat du 17/10/2026 :
 * l'onglet « Rôles d'ancienneté » demandait `game-icons/ladder.png`, **absent** ⇒ 404 servi
 * par `/_next/image` (issue Sentry `JAVASCRIPT-NEXTJS-1K`).
 */
export function GameIcon({ src, className }: { src: string; className?: string }) {
    const href = src.startsWith("/") ? src : `/assets/dofus/game-icons/${src}`;

    return (
        <Image
            src={href}
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
            className={cn("object-contain", className)}
        />
    );
}

